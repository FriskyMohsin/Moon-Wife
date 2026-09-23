/**
 * Audio manager for Realtime Gemini Live voice communication:
 * - 16kHz microphone capture -> linear16 PCM base64 streaming
 * - 24kHz model audio playback queue with smooth gapless scheduling
 * - Barge-in support (instant audio cancellation on user speech)
 * - AnalyserNode for audio reactive voice orb visualization
 */

import { getOwnerVoiceProfile, verifyOwnerVoice } from './voiceProfile';

export interface AudioCallbacks {
  onAudioData: (base64Pcm: string, metadata?: { rms: number; isSpeaking: boolean; captureTimestamp: number; isOwnerSpeech?: boolean }) => void;
  onVoiceStateChange: (state: 'Idle' | 'Listening' | 'Thinking' | 'Speaking') => void;
  onAudioLevel: (level: number) => void;
  onUserSpeechDetected?: () => void;
  onError?: (err: Error) => void;
}

export class GeminiLiveAudioManager {
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;

  private activeSources: AudioBufferSourceNode[] = [];
  private nextPlayTime: number = 0;
  private isMuted: boolean = false;
  private isCapturing: boolean = false;
  private isPlayingResponse: boolean = false;
  private isGuestMode: boolean = false;

  private noiseFloor: number = 0.008;
  private speechThresholdCounter: number = 0;

  private callbacks: AudioCallbacks;
  private animFrameId: number | null = null;

  constructor(callbacks: AudioCallbacks) {
    this.callbacks = callbacks;
  }

  public setGuestMode(guest: boolean) {
    this.isGuestMode = guest;
  }

  public getIsGuestMode(): boolean {
    return this.isGuestMode;
  }

  private micFrameCount: number = 0;
  private micBytes: number = 0;
  private audioBuffersScheduled: number = 0;
  private audioBuffersPlayed: number = 0;
  private isRequestingMic: boolean = false;

  public async startMicrophone(): Promise<boolean> {
    if (this.isRequestingMic) return false;
    this.isRequestingMic = true;
    try {
      // Ensure output AudioContext is initialized & resumed directly during user gesture stack
      await this.ensureOutputAudioContext();

      if (this.isCapturing && this.mediaStream) {
        return true;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Extended WebRTC audio constraints for advanced browser noise reduction
          googEchoCancellation: true,
          googAutoGainControl: true,
          googNoiseSuppression: true,
          googHighpassFilter: true,
          googNoiseSuppression2: true,
          googEchoCancellation2: true,
        } as MediaTrackConstraints,
      });

      console.log('[MIC_PERMISSION_GRANTED]');
      console.log('[MIC_CAPTURE_STARTED]');

      this.mediaStream = stream;

      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.inputAudioCtx = new AudioCtxClass({ sampleRate: 16000 });
      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }

      this.inputSource = this.inputAudioCtx.createMediaStreamSource(stream);
      this.inputAnalyser = this.inputAudioCtx.createAnalyser();
      this.inputAnalyser.fftSize = 256;
      this.inputAnalyser.smoothingTimeConstant = 0.5;

      // ScriptProcessor for 16kHz linear PCM extraction
      this.processor = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);

      this.inputSource.connect(this.inputAnalyser);
      this.inputAnalyser.connect(this.processor);
      this.processor.connect(this.inputAudioCtx.destination);

      this.speechThresholdCounter = 0;
      this.micFrameCount = 0;
      this.micBytes = 0;
      this.audioBuffersScheduled = 0;
      this.audioBuffersPlayed = 0;

      this.processor.onaudioprocess = (e) => {
        if (this.isMuted) return;

        const inputChannel = e.inputBuffer.getChannelData(0);

        // Calculate RMS volume
        let sum = 0;
        for (let i = 0; i < inputChannel.length; i++) {
          sum += inputChannel[i] * inputChannel[i];
        }
        const rms = Math.sqrt(sum / inputChannel.length);

        // Continuous Adaptive Noise Floor Tracking
        if (rms < this.noiseFloor) {
          this.noiseFloor = this.noiseFloor * 0.90 + rms * 0.10;
        } else {
          this.noiseFloor = this.noiseFloor * 0.998 + rms * 0.002;
        }
        this.noiseFloor = Math.max(0.003, Math.min(0.04, this.noiseFloor));

        // Signal-to-Noise Ratio
        const snr = rms / Math.max(0.002, this.noiseFloor);

        // Verify Owner Voice Profile
        const voiceProfile = getOwnerVoiceProfile();
        const verification = verifyOwnerVoice(inputChannel, 16000, voiceProfile);
        const { isOwner, confidence, isVoiced, pitchHz, reason } = verification;

        // 1. Requirement for Foreground Speech (voiced + clear signal above ambient noise floor)
        const isForegroundSpeech = isVoiced && rms > 0.038 && snr > 3.2 && pitchHz >= 70 && pitchHz <= 400;

        // 2. Interruption Qualification Gating
        let allowInterruption = false;

        if (this.isGuestMode) {
          // Guest Mode Active: Accept any sustained human voiced speech
          allowInterruption = isForegroundSpeech;
        } else if (voiceProfile && voiceProfile.enrolled) {
          // Owner Mode with Enrolled Profile: Require pitch profile match & acoustic confidence
          allowInterruption = isForegroundSpeech && isOwner && confidence >= 0.40;
        } else {
          // Owner Mode without Enrolled Profile: Require strong foreground speech signal
          allowInterruption = isForegroundSpeech && snr > 3.8 && rms > 0.045;
        }

        // 3. Multi-Frame Sustained Speech Interruption Gate (requires 4 consecutive frames, ~250ms)
        if (this.isPlayingResponse && allowInterruption) {
          this.speechThresholdCounter++;
          if (this.speechThresholdCounter >= 4) {
            this.bargeIn();
            this.speechThresholdCounter = 0;
            if (this.callbacks.onUserSpeechDetected) {
              this.callbacks.onUserSpeechDetected();
            }
          }
        } else {
          // Ambient noise / TV burst / short transient: reset counter safely without stopping Maryam
          this.speechThresholdCounter = 0;
        }

        const isSpeaking = isForegroundSpeech && (this.isGuestMode || (voiceProfile?.enrolled ? isOwner : true));

        if (isForegroundSpeech && this.micFrameCount % 20 === 0) {
          console.log(
            `[SPEAKER_VERIFICATION] Match: ${isOwner ? 'YES' : 'NO'} | Confidence: ${Math.round(
              confidence * 100
            )}% | Reason: ${reason}`
          );
        }

        // Convert Float32 to 16-bit linear PCM
        const pcm16 = new Int16Array(inputChannel.length);
        for (let i = 0; i < inputChannel.length; i++) {
          const s = Math.max(-1, Math.min(1, inputChannel[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Convert to Base64
        const binary = String.fromCharCode(...new Uint8Array(pcm16.buffer));
        const base64 = btoa(binary);

        this.micFrameCount++;
        this.micBytes += pcm16.byteLength;
        if (this.micFrameCount === 1 || this.micFrameCount % 50 === 0) {
          console.log(`[LIVE_MIC_DIAGNOSTICS] micChunks=${this.micFrameCount} micBytes=${this.micBytes}`);
        }

        this.callbacks.onAudioData(base64, {
          rms,
          isSpeaking,
          captureTimestamp: performance.now(),
          isOwnerSpeech: isSpeaking,
        });
      };

      this.isCapturing = true;
      this.startLevelLoop();
      return true;
    } catch (err: any) {
      const errName = err?.name || '';
      const errMsg = err?.message || String(err);
      const isDenied = errName === 'NotAllowedError' || errName === 'PermissionDeniedError' || errMsg.includes('Permission denied') || errMsg.includes('NotAllowedError');
      if (isDenied) {
        console.warn('[MIC_PERMISSION_DENIED] Microphone access was denied or restricted by browser settings.');
      } else {
        console.error('Failed to start microphone:', err);
        if (this.callbacks.onError) {
          this.callbacks.onError(err as Error);
        }
      }
      return false;
    } finally {
      this.isRequestingMic = false;
    }
  }

  public stopMicrophone() {
    this.isCapturing = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.inputSource) {
      this.inputSource.disconnect();
      this.inputSource = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.inputAudioCtx) {
      console.log('[AUDIO_CONTEXT_CLOSE_CALLED] source=audioManager.stopMicrophone reason=stopping_mic');
      this.inputAudioCtx.close();
      this.inputAudioCtx = null;
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsCapturing(): boolean {
    return this.isCapturing;
  }

  /**
   * Initializes or gets the output AudioContext for Gemini Live audio playback
   * Default constructor matches system hardware sample rate to prevent autoplay blocking/suspension.
   */
  public async ensureOutputAudioContext(): Promise<AudioContext> {
    if (!this.outputAudioCtx || this.outputAudioCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.outputAudioCtx = new AudioCtxClass();
      this.outputAnalyser = this.outputAudioCtx.createAnalyser();
      this.outputAnalyser.fftSize = 256;
      this.outputAnalyser.smoothingTimeConstant = 0.5;
      this.outputAnalyser.connect(this.outputAudioCtx.destination);
    }
    if (this.outputAudioCtx.state === 'suspended') {
      try {
        await this.outputAudioCtx.resume();
      } catch (err) {
        console.warn('Failed to resume output AudioContext:', err);
      }
    }
    console.log(`[AUDIO_CONTEXT_STATE] state=${this.outputAudioCtx.state} sampleRate=${this.outputAudioCtx.sampleRate}`);
    return this.outputAudioCtx;
  }

  /**
   * Schedules a base64 PCM audio chunk seamlessly into the output buffer queue
   */
  public async playChunk(base64Pcm: string, mimeType?: string) {
    try {
      const ctx = await this.ensureOutputAudioContext();

      // Convert base64 to byte array safely
      const binary = atob(base64Pcm);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const samplesCount = Math.floor(bytes.byteLength / 2);
      const int16Array = new Int16Array(bytes.buffer, bytes.byteOffset, samplesCount);
      console.log(`[AUDIO_BYTES_DECODED] bytes=${bytes.byteLength}`);
      console.log(`[AUDIO_DECODED] samples=${samplesCount}`);

      // Convert Int16 to Float32 [-1.0, 1.0]
      const float32 = new Float32Array(samplesCount);
      for (let i = 0; i < samplesCount; i++) {
        float32[i] = int16Array[i] / (int16Array[i] < 0 ? 32768 : 32767);
      }

      // Determine sample rate from mimeType or default 24000Hz (native Gemini Live rate)
      let sampleRate = 24000;
      if (mimeType && mimeType.includes('rate=')) {
        const match = mimeType.match(/rate=(\d+)/);
        if (match && match[1]) {
          sampleRate = parseInt(match[1], 10);
        }
      }

      // Create audio buffer (browser Web Audio API automatically resamples buffer rate to hardware output rate)
      const audioBuffer = ctx.createBuffer(1, float32.length, sampleRate);
      audioBuffer.getChannelData(0).set(float32);
      console.log('[AUDIO_BUFFER_CREATED]');

      const sourceNode = ctx.createBufferSource();
      sourceNode.buffer = audioBuffer;

      if (this.outputAnalyser) {
        sourceNode.connect(this.outputAnalyser);
      }
      sourceNode.connect(ctx.destination);
      console.log('[AUDIO_SOURCE_CONNECTED]');

      const currentTime = ctx.currentTime;
      // Schedule gaplessly
      const startTime = Math.max(currentTime, this.nextPlayTime);
      sourceNode.start(startTime);
      console.log('[AUDIO_SOURCE_STARTED]');
      this.audioBuffersScheduled++;
      console.log(`[LIVE_PLAYBACK_DIAGNOSTICS] audioBuffersScheduled=${this.audioBuffersScheduled} contextState=${ctx.state} sampleRate=${ctx.sampleRate}`);
      this.nextPlayTime = startTime + audioBuffer.duration;

      this.activeSources.push(sourceNode);
      this.isPlayingResponse = true;
      this.callbacks.onVoiceStateChange('Speaking');

      sourceNode.onended = () => {
        console.log('[AUDIO_PLAYBACK_ENDED]');
        console.log('[AUDIO_SOURCE_ENDED]');
        this.audioBuffersPlayed++;
        console.log(`[LIVE_PLAYBACK_DIAGNOSTICS] audioBuffersPlayed=${this.audioBuffersPlayed}`);
        const idx = this.activeSources.indexOf(sourceNode);
        if (idx !== -1) {
          this.activeSources.splice(idx, 1);
        }
        if (this.activeSources.length === 0 && ctx.currentTime >= this.nextPlayTime - 0.05) {
          this.isPlayingResponse = false;
          this.callbacks.onVoiceStateChange(this.isCapturing ? 'Listening' : 'Idle');
        }
      };
    } catch (err) {
      console.error('Error playing audio chunk:', err);
    }
  }

  /**
   * Barge-in interruption: instantly cuts off all playing audio
   */
  public bargeIn() {
    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // Ignored
      }
    }
    this.activeSources = [];
    if (this.outputAudioCtx) {
      this.nextPlayTime = this.outputAudioCtx.currentTime;
    }
    this.isPlayingResponse = false;
    this.callbacks.onVoiceStateChange(this.isCapturing ? 'Listening' : 'Idle');
  }

  private startLevelLoop() {
    const update = () => {
      let maxLevel = 0;

      // Check model output audio level first
      if (this.isPlayingResponse && this.outputAnalyser) {
        const data = new Uint8Array(this.outputAnalyser.frequencyBinCount);
        this.outputAnalyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          sum += data[i];
        }
        maxLevel = (sum / data.length) / 255;
      } else if (this.isCapturing && !this.isMuted && this.inputAnalyser) {
        // Check input mic level
        const data = new Uint8Array(this.inputAnalyser.frequencyBinCount);
        this.inputAnalyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          sum += data[i];
        }
        maxLevel = (sum / data.length) / 255;
      }

      this.callbacks.onAudioLevel(maxLevel);
      this.animFrameId = requestAnimationFrame(update);
    };

    this.animFrameId = requestAnimationFrame(update);
  }

  public destroy() {
    this.stopMicrophone();
    this.bargeIn();
    if (this.outputAudioCtx) {
      console.log('[AUDIO_CONTEXT_CLOSE_CALLED] source=audioManager.destroy reason=destroying_audio_manager');
      this.outputAudioCtx.close();
      this.outputAudioCtx = null;
    }
  }
}
