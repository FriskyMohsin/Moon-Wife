/**
 * Wake Word Architecture for "Hello Baby"
 * Uses standard Web Speech Recognition API where available in browser context.
 * Honestly reports support status and does not fake continuous background detection
 * if unsupported or blocked by iframe permissions.
 */

// Define SpeechRecognition interface for TypeScript
interface SpeechRecognitionEventLike {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEventLike) => void;
  onerror: (event: { error: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

import { WakeSensitivity, WakeWordStatus, MicPermissionStatus } from '../types';

export type { WakeWordStatus, MicPermissionStatus, WakeSensitivity };

export interface WakeWordCallbacks {
  onWakePhraseDetected: (phrase: string) => void;
  onStatusChange: (status: WakeWordStatus, message?: string) => void;
  onTranscriptPartial?: (transcript: string) => void;
}

export class WakeWordDetector {
  private recognition: SpeechRecognitionLike | null = null;
  private isRunning: boolean = false;
  private callbacks: WakeWordCallbacks;
  private wakePhrase: string;
  private sensitivity: WakeSensitivity;
  private restartTimeoutId: number | null = null;

  constructor(
    callbacks: WakeWordCallbacks,
    wakePhrase: string = 'Hello Baby',
    sensitivity: WakeSensitivity = 'balanced'
  ) {
    this.callbacks = callbacks;
    this.wakePhrase = wakePhrase;
    this.sensitivity = sensitivity;
  }

  public setSensitivity(sensitivity: WakeSensitivity) {
    this.sensitivity = sensitivity;
  }

  public setWakePhrase(phrase: string) {
    this.wakePhrase = phrase;
  }

  public isAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  public static async checkMicPermission(): Promise<MicPermissionStatus> {
    if (typeof navigator === 'undefined' || !navigator.permissions) {
      return 'unknown';
    }
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return result.state as MicPermissionStatus;
    } catch {
      return 'unknown';
    }
  }

  private static isRequestingMic: boolean = false;

  public static async requestMicPermission(): Promise<boolean> {
    if (WakeWordDetector.isRequestingMic) return false;
    WakeWordDetector.isRequestingMic = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      return false;
    } finally {
      WakeWordDetector.isRequestingMic = false;
    }
  }

  /**
   * Matches transcript against "Hello Baby" considering sensitivity and accidental triggers.
   */
  private checkPhraseMatch(rawTranscript: string): string | null {
    const text = rawTranscript.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    if (!text) return null;

    const target = this.wakePhrase.toLowerCase().trim(); // 'hello baby'
    const words = text.split(/\s+/);

    // Accidental trigger prevention:
    // If the user says a long sentence with many unrelated words (e.g. 8+ words)
    // and "hello baby" is not the clear opening invocation, ignore it.
    if (words.length > 7 && !text.startsWith(target)) {
      return null;
    }

    if (this.sensitivity === 'strict') {
      // Must be exact "hello baby" or "hey baby" with minimal surrounding words (max 3 words total)
      if (text === target || text === 'hey baby' || text === 'hello baby') {
        return target;
      }
      if (words.length <= 3 && (text.startsWith(target) || text.endsWith(target))) {
        return target;
      }
      return null;
    }

    if (this.sensitivity === 'balanced') {
      // Matches "hello baby", "hey baby", "suno baby", "hello maryam", "meri jaan"
      const balancedTargets = [
        target,
        'hey baby',
        'baby',
        'hello maryam',
        'suno baby',
        'meri jaan',
      ];
      for (const phrase of balancedTargets) {
        if (text === phrase || text.startsWith(phrase) || text.includes(phrase)) {
          // Reject if it's an unrelated phrase that just contains "baby" as an adjective/noun in a long sentence
          if (phrase === 'baby' && (words.length > 3 || text.includes('baby food') || text.includes('baby clothes'))) {
            continue;
          }
          return phrase;
        }
      }
      return null;
    }

    // 'sensitive' mode: matches any occurrence of hello baby or related wake keywords
    const sensitiveTargets = [target, 'hey baby', 'baby', 'hello maryam', 'suno maryam'];
    for (const phrase of sensitiveTargets) {
      if (text.includes(phrase)) {
        return phrase;
      }
    }

    return null;
  }

  public startListening(): boolean {
    if (!this.isAvailable()) {
      this.callbacks.onStatusChange(
        'unsupported',
        'Web Speech API is not supported in this browser. You can click the Voice Orb to talk.'
      );
      return false;
    }

    try {
      if (this.isRunning && this.recognition) {
        return true;
      }

      this.stopListening();

      const win = window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionLike;
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      };

      const RecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (!RecognitionClass) return false;

      this.recognition = new RecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: SpeechRecognitionEventLike) => {
        const results = event.results;
        for (let i = 0; i < Object.keys(results).length; i++) {
          const item = results[i];
          if (item && item[0]) {
            const transcript = item[0].transcript;
            if (this.callbacks.onTranscriptPartial) {
              this.callbacks.onTranscriptPartial(transcript);
            }

            const matched = this.checkPhraseMatch(transcript);
            if (matched) {
              console.log(`[WakeWord] Detected "${matched}" from speech: "${transcript}"`);
              // IMMEDIATELY stop recognition to free microphone hardware for Gemini Live
              this.stopListening();
              this.callbacks.onStatusChange('detected', `Wake phrase detected: "${matched}"`);
              this.callbacks.onWakePhraseDetected(matched);
              return;
            }
          }
        }
      };

      this.recognition.onerror = (e) => {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        console.warn('[WakeWord] Recognition error:', e.error);
        if (e.error === 'not-allowed') {
          this.isRunning = false;
          this.callbacks.onStatusChange('error', 'Microphone permission denied');
        }
      };

      this.recognition.onend = () => {
        // In mobile browsers and Chrome, SpeechRecognition automatically ends after silence.
        // If still in standby mode, restart cleanly after a small backoff.
        if (this.isRunning) {
          if (this.restartTimeoutId) clearTimeout(this.restartTimeoutId);
          this.restartTimeoutId = window.setTimeout(() => {
            if (this.isRunning && this.recognition) {
              try {
                this.recognition.start();
              } catch {
                // If it fails to restart immediately, re-instantiate
                this.startListening();
              }
            }
          }, 350);
        }
      };

      this.recognition.start();
      this.isRunning = true;
      this.callbacks.onStatusChange('waiting', `Waiting for "${this.wakePhrase}"...`);
      return true;
    } catch (err) {
      console.warn('[WakeWord] Failed to start:', err);
      this.isRunning = false;
      this.callbacks.onStatusChange('error', 'Could not access audio for wake phrase detection');
      return false;
    }
  }

  public stopListening() {
    this.isRunning = false;
    if (this.restartTimeoutId) {
      clearTimeout(this.restartTimeoutId);
      this.restartTimeoutId = null;
    }
    if (this.recognition) {
      try {
        this.recognition.onend = () => {};
        this.recognition.onerror = () => {};
        this.recognition.onresult = () => {};
        this.recognition.stop();
        this.recognition.abort();
      } catch {
        // Ignored
      }
      this.recognition = null;
    }
    this.callbacks.onStatusChange('idle', 'Wake word listener paused');
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }
}
