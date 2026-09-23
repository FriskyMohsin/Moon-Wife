import React, { useState, useEffect } from 'react';
import { AppSettings, GeminiVoiceName, WakeSensitivity, MicPermissionStatus } from '../types';
import { WakeWordDetector } from '../lib/wakeWord';
import {
  getOwnerVoiceProfile,
  saveOwnerVoiceProfile,
  clearOwnerVoiceProfile,
  extractAudioFeatures,
  buildMultiSampleProfile,
  VoiceProfile
} from '../lib/voiceProfile';
import { X, Settings, Volume2, Mic, Sliders, ShieldCheck, CheckCircle2, AlertTriangle, UserCheck, RefreshCw, Trash2, HelpCircle, Lock } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  serverStatus: { hasApiKey: boolean; companion: string; modelLive: string } | null;
  isGuestMode?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  serverStatus,
  isGuestMode = false,
}) => {
  const [micStatus, setMicStatus] = useState<MicPermissionStatus>('unknown');
  const [isRequestingMic, setIsRequestingMic] = useState<boolean>(false);

  // Owner Voice Profile Enrollment State
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(getOwnerVoiceProfile());
  const [isEnrolling, setIsEnrolling] = useState<boolean>(false);
  const [enrollStep, setEnrollStep] = useState<number>(0);
  const [enrollCountdown, setEnrollCountdown] = useState<number>(3);
  const [enrollStatusMsg, setEnrollStatusMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      WakeWordDetector.checkMicPermission().then((status) => {
        setMicStatus(status);
      });
      setVoiceProfile(getOwnerVoiceProfile());
    }
  }, [isOpen]);

  const handleStartEnrollment = async () => {
    if (isGuestMode) {
      setEnrollStatusMsg('Public users are forbidden from enrolling or overwriting Mohsin\'s voiceprint.');
      return;
    }

    try {
      setIsEnrolling(true);
      const collectedSampleFrames: Array<Array<{ pitchHz: number; spectralCentroid: number }>> = [];

      const samplePrompts = [
        'Sample 1/3: Speak naturally ("Hello Maryam, it\'s Mohsin here")...',
        'Sample 2/3: Speak naturally ("Maryam, what tasks do I have today?")...',
        'Sample 3/3: Speak naturally ("Verify my voiceprint identification profile")...',
      ];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);

      for (let sIdx = 0; sIdx < 3; sIdx++) {
        setEnrollStep(sIdx + 1);
        setEnrollStatusMsg(samplePrompts[sIdx]);
        setEnrollCountdown(3);

        const currentSampleFrames: Array<{ pitchHz: number; spectralCentroid: number }> = [];

        let countdown = 3;
        const countdownInterval = setInterval(() => {
          countdown -= 1;
          setEnrollCountdown(Math.max(0, countdown));
        }, 1000);

        const samplerInterval = setInterval(() => {
          const data = new Float32Array(analyser.fftSize);
          analyser.getFloatTimeDomainData(data);
          const features = extractAudioFeatures(data, audioCtx.sampleRate);
          if (features.pitchHz > 60 && features.pitchHz < 380) {
            currentSampleFrames.push(features);
          }
        }, 80);

        await new Promise((resolve) => setTimeout(resolve, 3100));

        clearInterval(countdownInterval);
        clearInterval(samplerInterval);

        collectedSampleFrames.push(currentSampleFrames);
      }

      stream.getTracks().forEach((t) => t.stop());
      audioCtx.close();

      const newProfile = buildMultiSampleProfile(collectedSampleFrames);

      if (newProfile) {
        const saved = saveOwnerVoiceProfile(newProfile, isGuestMode);
        if (saved) {
          setVoiceProfile(newProfile);
          setEnrollStatusMsg(`Enrolled successfully! 3 samples captured (Baseline pitch ~${newProfile.avgPitchHz}Hz, std dev ±${newProfile.pitchStdDev}Hz).`);
        } else {
          setEnrollStatusMsg('Voiceprint update blocked by security policy.');
        }
      } else {
        setEnrollStatusMsg('Voice samples were too quiet or unvoiced. Please speak clearly into the microphone.');
      }

      setIsEnrolling(false);
      setEnrollStep(0);
    } catch (err) {
      console.error('Enrollment error:', err);
      setEnrollStatusMsg('Failed to access microphone for voice enrollment.');
      setIsEnrolling(false);
      setEnrollStep(0);
    }
  };

  const handleResetProfile = () => {
    if (isGuestMode) {
      setEnrollStatusMsg('Public users cannot reset Mohsin\'s voiceprint.');
      return;
    }
    clearOwnerVoiceProfile(isGuestMode);
    setVoiceProfile(null);
    setEnrollStatusMsg('Voice profile reset.');
  };

  const handleRequestMic = async () => {
    setIsRequestingMic(true);
    const granted = await WakeWordDetector.requestMicPermission();
    setMicStatus(granted ? 'granted' : 'denied');
    setIsRequestingMic(false);
  };

  if (!isOpen) return null;

  const voices: { id: GeminiVoiceName; name: string; tag: string; desc: string }[] = [
    { id: 'Aoede', name: 'Aoede (Locked Female Voice - Primary)', tag: 'Soft & Melodic', desc: 'Authoritative persistent female voice, soothing and intimate.' },
    { id: 'Kore', name: 'Kore (Female Backup)', tag: 'Gentle & Calming', desc: 'Warm, relaxed feminine tone with steady pacing.' },
    { id: 'Zephyr', name: 'Zephyr (Female Backup)', tag: 'Bright & Friendly', desc: 'Cheery and expressive female voice.' },
  ];

  const sensitivities: { id: WakeSensitivity; label: string; desc: string }[] = [
    { id: 'strict', label: 'Strict', desc: 'Matches exact "Hello Baby" only. Best for preventing accidental activations in noisy rooms.' },
    { id: 'balanced', label: 'Balanced (Recommended)', desc: 'Matches "Hello Baby", "Hey Baby", and natural invocations with low false-trigger rate.' },
    { id: 'sensitive', label: 'Sensitive', desc: 'Easiest activation with softer whisper or rapid speech. May trigger more easily.' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md max-h-[85vh] bg-zinc-950 border border-white/10 rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-950/60 border border-rose-800/40 text-rose-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Maryam Settings</h3>
              <p className="text-xs text-zinc-400">Voice, wake phrase, and audio controls</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Wake Phrase Detection Section */}
          <div className="p-4 rounded-2xl bg-zinc-900/70 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-violet-400" />
                <span className="text-xs font-semibold text-white uppercase tracking-wider">
                  Wake Phrase Detection
                </span>
              </div>
              <input
                type="checkbox"
                id="checkbox-wake-word-enabled"
                checked={settings.enableWakeWord}
                onChange={(e) => onUpdateSettings({ ...settings, enableWakeWord: e.target.checked })}
                className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
              />
            </div>

            <p className="text-[11px] text-zinc-300 leading-relaxed">
              When active, Maryam remains in low-resource on-device standby mode and activates instantly when you clearly say <span className="text-rose-300 font-semibold">"{settings.wakePhrase}"</span>.
            </p>

            {/* Wake Word Sensitivity */}
            {settings.enableWakeWord && (
              <div className="pt-2 border-t border-white/5 space-y-2">
                <label className="text-[11px] font-medium text-zinc-300 block">
                  Detection Sensitivity
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {sensitivities.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onUpdateSettings({ ...settings, wakeSensitivity: s.id })}
                      className={`px-2.5 py-2 rounded-xl text-xs font-medium border text-center transition-all ${
                        settings.wakeSensitivity === s.id
                          ? 'bg-rose-950/60 border-rose-500 text-white shadow-sm'
                          : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {s.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-400 italic">
                  {sensitivities.find((s) => s.id === settings.wakeSensitivity)?.desc}
                </p>
              </div>
            )}

            {/* Microphone Permission Status */}
            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-zinc-400">Microphone Permission:</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 ${
                    micStatus === 'granted'
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                      : micStatus === 'denied'
                      ? 'bg-red-950/60 text-red-300 border border-red-800/40'
                      : 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                  }`}
                >
                  {micStatus === 'granted' ? (
                    <CheckCircle2 className="w-2.5 h-2.5" />
                  ) : micStatus === 'denied' ? (
                    <AlertTriangle className="w-2.5 h-2.5" />
                  ) : (
                    <HelpCircle className="w-2.5 h-2.5" />
                  )}
                  <span className="capitalize">{micStatus}</span>
                </span>
              </div>

              {micStatus !== 'granted' && (
                <button
                  type="button"
                  onClick={handleRequestMic}
                  disabled={isRequestingMic}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium transition-all"
                >
                  {isRequestingMic ? 'Testing...' : 'Grant Access'}
                </button>
              )}
            </div>

            {/* Mobile Browser Lifecycle Notice */}
            <div className="p-2 rounded-xl bg-black/30 border border-white/5 text-[10px] text-zinc-400 leading-snug">
              <span className="font-semibold text-zinc-300">Android & Mobile Browser Note: </span>
              Standby detection operates locally in foreground browser tabs. Screen-off background wake word requires a native Android foreground service APK.
            </div>
          </div>

          {/* Gemini Live Voice Selection */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="w-4 h-4 text-rose-400" />
              <label className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                Gemini Live Voice
              </label>
            </div>
            <p className="text-[11px] text-zinc-400 mb-2.5">
              Select the voice personality for Maryam's realtime streaming voice.
            </p>
            <div className="grid grid-cols-1 gap-2">
              {voices.map((v) => (
                <button
                  key={v.id}
                  onClick={() => onUpdateSettings({ ...settings, voiceName: v.id })}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-start justify-between gap-2 ${
                    settings.voiceName === v.id
                      ? 'bg-rose-950/40 border-rose-500/50 text-white shadow-sm'
                      : 'bg-zinc-900/50 border-white/5 text-zinc-300 hover:bg-zinc-900 hover:border-white/10'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white">{v.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-rose-300">
                        {v.tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-snug">{v.desc}</p>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 ${
                      settings.voiceName === v.id ? 'border-rose-400 bg-rose-500' : 'border-zinc-600'
                    }`}
                  >
                    {settings.voiceName === v.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Barge-in Interruption */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-medium text-white">Barge-in (Instant Interruption)</span>
              </div>
              <input
                type="checkbox"
                checked={settings.bargeInEnabled}
                onChange={(e) => onUpdateSettings({ ...settings, bargeInEnabled: e.target.checked })}
                className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              When speaking, if you start talking or tap the interrupt button, Maryam will immediately stop speaking and listen to you.
            </p>
          </div>

          {/* Owner Voice Profile (Mohsin) */}
          <div className="p-4 rounded-2xl bg-zinc-900/70 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-semibold text-white uppercase tracking-wider">
                  Speaker Verification
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-400 uppercase font-medium">VOICEPRINT STATUS:</span>
                {voiceProfile?.enrolled ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-700/50 text-emerald-300 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> ENROLLED
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-700/50 text-amber-300 font-semibold">
                    NOT ENROLLED
                  </span>
                )}
              </div>
            </div>

            <p className="text-[11px] text-zinc-300 leading-relaxed">
              {voiceProfile?.enrolled
                ? `Owner Voiceprint Active: Mohsin enrolled with ${voiceProfile.sampleCount || 3} speech samples. Baseline Pitch ~${voiceProfile.avgPitchHz}Hz (range ${voiceProfile.minPitchHz}-${voiceProfile.maxPitchHz}Hz, std dev ±${voiceProfile.pitchStdDev || 15}Hz), Spectral Centroid ~${voiceProfile.avgSpectralCentroid}Hz.`
                : 'Enroll 3 natural speech samples from Mohsin to allow Maryam to verify your voice and reject unknown speakers.'}
            </p>

            {isGuestMode && (
              <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-700/30 text-[10px] text-amber-300 flex items-center gap-1.5">
                <Lock className="w-3 h-3 flex-shrink-0" />
                <span>Public user session: Voiceprint enrollment & reset are protected and reserved for Mohsin only.</span>
              </div>
            )}

            {enrollStatusMsg && (
              <p className="text-[11px] text-rose-300 font-medium bg-rose-950/50 p-2 rounded-xl border border-rose-900/30">
                {enrollStatusMsg}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleStartEnrollment}
                disabled={isEnrolling || isGuestMode}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                {isEnrolling ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Enrolling Sample {enrollStep}/3 ({enrollCountdown}s)...</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5" />
                    <span>{voiceProfile?.enrolled ? 'RE-ENROLL VOICE' : 'Enroll Voice (Mohsin Only)'}</span>
                  </>
                )}
              </button>

              {voiceProfile?.enrolled && !isGuestMode && (
                <button
                  type="button"
                  onClick={handleResetProfile}
                  className="p-2 rounded-xl bg-white/5 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-300 border border-white/5 transition-all"
                  title="Reset Voice Profile"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <p className="text-[10px] text-zinc-500 italic">
              Privacy guarantee: Local acoustic feature extraction only. Temporary raw recordings are discarded immediately after embedding.
            </p>
          </div>

          {/* Auto Speak Text Responses */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-medium text-white">Auto-Speak Text Replies</span>
              </div>
              <input
                type="checkbox"
                checked={settings.autoSpeakText}
                onChange={(e) => onUpdateSettings({ ...settings, autoSpeakText: e.target.checked })}
                className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Automatically synthesize Maryam's female voice whenever a text reply is received.
            </p>
          </div>

          {/* Security & System Info */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 text-[11px] space-y-1.5 text-zinc-400">
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Server-Side API Security</span>
            </div>
            <div>Companion Model: {serverStatus?.modelLive || 'gemini-3.8-live & flash'}</div>
            <div>API Key Status: {serverStatus?.hasApiKey ? 'Securely Loaded on Server' : 'Configured via AI Studio Secrets'}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 bg-zinc-900/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-all"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};

