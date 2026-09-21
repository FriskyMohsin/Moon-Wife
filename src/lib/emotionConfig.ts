import { EmotionState } from '../types';

export interface EmotionMeta {
  state: EmotionState;
  label: string;
  urduHint: string;
  orbPrimary: string;
  orbSecondary: string;
  orbGlow: string;
  haloRgba: string;
  textColor: string;
  badgeBg: string;
  pulseSpeed: number; // in seconds
}

export const EMOTION_MAP: Record<EmotionState, EmotionMeta> = {
  Normal: {
    state: 'Normal',
    label: 'Serene & Present',
    urduHint: 'Sukoon se aapke sath',
    orbPrimary: '#a78bfa', // soft violet
    orbSecondary: '#f472b6', // soft pink
    orbGlow: 'rgba(167, 139, 250, 0.45)',
    haloRgba: 'rgba(167, 139, 250, 0.2)',
    textColor: 'text-violet-300',
    badgeBg: 'bg-violet-950/60 border-violet-800/40',
    pulseSpeed: 3.5,
  },
  Happy: {
    state: 'Happy',
    label: 'Warm Joy',
    urduHint: 'Khush aur muskurati hui',
    orbPrimary: '#fbbf24', // amber warm gold
    orbSecondary: '#f43f5e', // rose
    orbGlow: 'rgba(251, 191, 36, 0.5)',
    haloRgba: 'rgba(244, 63, 94, 0.25)',
    textColor: 'text-amber-300',
    badgeBg: 'bg-amber-950/60 border-amber-800/40',
    pulseSpeed: 2.5,
  },
  Affectionate: {
    state: 'Affectionate',
    label: 'Deep Affection',
    urduHint: 'Meri jaan, mohabbat bhara ehsas',
    orbPrimary: '#fb7185', // rose blush
    orbSecondary: '#e11d48', // deep crimson rose
    orbGlow: 'rgba(251, 113, 133, 0.65)',
    haloRgba: 'rgba(225, 29, 72, 0.3)',
    textColor: 'text-rose-300',
    badgeBg: 'bg-rose-950/60 border-rose-800/40',
    pulseSpeed: 2.2,
  },
  Playful: {
    state: 'Playful',
    label: 'Playful & Charming',
    urduHint: 'Shokh aur hansi mazaq',
    orbPrimary: '#f472b6', // vibrant pink
    orbSecondary: '#38bdf8', // sky cyan
    orbGlow: 'rgba(244, 114, 182, 0.55)',
    haloRgba: 'rgba(56, 189, 248, 0.25)',
    textColor: 'text-pink-300',
    badgeBg: 'bg-pink-950/60 border-pink-800/40',
    pulseSpeed: 2.0,
  },
  Concerned: {
    state: 'Concerned',
    label: 'Caring & Protective',
    urduHint: 'Aapka khayal rakhne wali fikr',
    orbPrimary: '#fb923c', // warm coral amber
    orbSecondary: '#6366f1', // deep indigo
    orbGlow: 'rgba(251, 146, 60, 0.5)',
    haloRgba: 'rgba(99, 102, 241, 0.25)',
    textColor: 'text-orange-300',
    badgeBg: 'bg-orange-950/60 border-orange-800/40',
    pulseSpeed: 3.0,
  },
  Excited: {
    state: 'Excited',
    label: 'Eager & Thrilled',
    urduHint: 'Josh aur nayi umeedein',
    orbPrimary: '#ec4899', // hot pink
    orbSecondary: '#8b5cf6', // electric purple
    orbGlow: 'rgba(236, 72, 153, 0.6)',
    haloRgba: 'rgba(139, 92, 246, 0.3)',
    textColor: 'text-fuchsia-300',
    badgeBg: 'bg-fuchsia-950/60 border-fuchsia-800/40',
    pulseSpeed: 1.6,
  },
  Focused: {
    state: 'Focused',
    label: 'Sharp & Intellective',
    urduHint: 'Poori tawajjoh Mohsin ke kaam par',
    orbPrimary: '#6366f1', // indigo
    orbSecondary: '#06b6d4', // cyan teal
    orbGlow: 'rgba(99, 102, 241, 0.55)',
    haloRgba: 'rgba(6, 182, 212, 0.25)',
    textColor: 'text-indigo-300',
    badgeBg: 'bg-indigo-950/60 border-indigo-800/40',
    pulseSpeed: 2.8,
  },
};

/**
 * Extracts [EMOTION: ...] tag from Maryam's response text if present,
 * strips the tag from the displayed text, and returns the cleaned text + emotion.
 */
export function parseEmotionFromText(rawText: string): { cleanedText: string; emotion: EmotionState } {
  const match = rawText.match(/\[EMOTION:\s*(Normal|Happy|Affectionate|Playful|Concerned|Excited|Focused)\]/i);
  if (match) {
    const rawEmotion = match[1];
    const cleanedText = rawText.replace(match[0], '').trim();
    // Normalize casing
    const normalized = (rawEmotion.charAt(0).toUpperCase() + rawEmotion.slice(1).toLowerCase()) as EmotionState;
    if (normalized in EMOTION_MAP) {
      return { cleanedText, emotion: normalized };
    }
  }

  // Contextual fallback sentiment detection if no explicit tag
  const lower = rawText.toLowerCase();
  if (lower.includes('meri jaan') || lower.includes('pyaar') || lower.includes('jaan meri') || lower.includes('love you')) {
    return { cleanedText: rawText, emotion: 'Affectionate' };
  }
  if (lower.includes('haha') || lower.includes('lol') || lower.includes('shokh') || lower.includes('mazaq') || lower.includes('chalo')) {
    return { cleanedText: rawText, emotion: 'Playful' };
  }
  if (lower.includes('fikr') || lower.includes('theek ho') || lower.includes('rest karo') || lower.includes('pareshan')) {
    return { cleanedText: rawText, emotion: 'Concerned' };
  }
  if (lower.includes('wah') || lower.includes('shabash') || lower.includes('zabardast') || lower.includes('kamaal')) {
    return { cleanedText: rawText, emotion: 'Excited' };
  }
  if (lower.includes('code') || lower.includes('build') || lower.includes('error') || lower.includes('function') || lower.includes('logic')) {
    return { cleanedText: rawText, emotion: 'Focused' };
  }
  if (lower.includes('khushi') || lower.includes('alhamdulillah') || lower.includes('muskurahat')) {
    return { cleanedText: rawText, emotion: 'Happy' };
  }

  return { cleanedText: rawText, emotion: 'Normal' };
}
