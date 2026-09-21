import { CompanionVoice } from './hoorviaTypes';

export interface VoiceOption {
  id: CompanionVoice;
  name: string;
  gender: 'female' | 'male' | 'neutral';
  tag: string;
  desc: string;
  sampleText: string;
}

export const HOORVIA_VOICES: VoiceOption[] = [
  {
    id: 'Aoede',
    name: 'Aoede',
    gender: 'female',
    tag: 'Warm Female',
    desc: 'Soft, melodic, and deeply comforting voice.',
    sampleText: "Hello there! I'm Aoede. Warm, expressive, and happy to accompany you.",
  },
  {
    id: 'Kore',
    name: 'Kore',
    gender: 'female',
    tag: 'Gentle Female',
    desc: 'Calm, gentle, and relaxing feminine tone.',
    sampleText: "Hi! I'm Kore. Gentle, calm, and always here to listen.",
  },
  {
    id: 'Zephyr',
    name: 'Zephyr',
    gender: 'female',
    tag: 'Soft Female',
    desc: 'Bright, soft, and cheery expressive voice.',
    sampleText: "Hello! I'm Zephyr. Soft, bright, and ready for our session.",
  },
  {
    id: 'Charon',
    name: 'Charon',
    gender: 'male',
    tag: 'Deep Male',
    desc: 'Deep, steady, and resonant masculine tone.',
    sampleText: "Greetings. I'm Charon. Calm, focused, and steady.",
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    gender: 'male',
    tag: 'Resonant Male',
    desc: 'Strong, energetic, and engaging male voice.',
    sampleText: "Hey! I'm Fenrir. Strong, confident, and ready to go.",
  },
  {
    id: 'Puck',
    name: 'Puck',
    gender: 'neutral',
    tag: 'Playful Neutral',
    desc: 'Upbeat, lighthearted, and expressive neutral voice.',
    sampleText: "Hey there! I'm Puck. Playful, quick-witted, and fun!",
  },
];

let activeSpeechStopFn: (() => void) | null = null;

export function playVoiceSample(
  voiceId: CompanionVoice,
  onStart?: () => void,
  onEnd?: () => void
): () => void {
  if (activeSpeechStopFn) {
    activeSpeechStopFn();
    activeSpeechStopFn = null;
  }

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onStart) onStart();
    setTimeout(() => {
      if (onEnd) onEnd();
    }, 1500);
    return () => {};
  }

  window.speechSynthesis.cancel();

  const voiceConfig = HOORVIA_VOICES.find((v) => v.id === voiceId);
  const sampleText = voiceConfig ? voiceConfig.sampleText : `This is a preview of the ${voiceId} voice.`;

  const utterance = new SpeechSynthesisUtterance(sampleText);

  if (voiceId === 'Charon') {
    utterance.pitch = 0.65;
    utterance.rate = 0.95;
  } else if (voiceId === 'Fenrir') {
    utterance.pitch = 0.75;
    utterance.rate = 1.05;
  } else if (voiceId === 'Aoede') {
    utterance.pitch = 1.1;
    utterance.rate = 1.0;
  } else if (voiceId === 'Kore') {
    utterance.pitch = 1.0;
    utterance.rate = 0.9;
  } else if (voiceId === 'Zephyr') {
    utterance.pitch = 1.25;
    utterance.rate = 1.05;
  } else if (voiceId === 'Puck') {
    utterance.pitch = 1.35;
    utterance.rate = 1.15;
  }

  const stop = () => {
    try {
      window.speechSynthesis.cancel();
    } catch {}
    activeSpeechStopFn = null;
    if (onEnd) onEnd();
  };

  utterance.onstart = () => {
    if (onStart) onStart();
  };

  utterance.onend = () => {
    activeSpeechStopFn = null;
    if (onEnd) onEnd();
  };

  utterance.onerror = () => {
    activeSpeechStopFn = null;
    if (onEnd) onEnd();
  };

  activeSpeechStopFn = stop;
  window.speechSynthesis.speak(utterance);

  return stop;
}
