/**
 * Centralized Permanent Female Voice Lock configuration for Maryam.
 * 
 * Rules:
 * 1. Authoritative Female Voice: 'Aoede' (Soft & Melodic female voice).
 * 2. Explicit Female Fallbacks: 'Zephyr' or 'Kore'.
 * 3. Male Voices strictly banned: 'Puck', 'Fenrir', 'Charon'.
 * 4. Deterministic across restarts, reconnects, refreshes, TTS, and Live WebSockets.
 */

export const PREFERRED_FEMALE_VOICE = 'Aoede';
export const FALLBACK_FEMALE_VOICE = 'Zephyr';
export const SECONDARY_FEMALE_VOICE = 'Kore';

export const ALLOWED_FEMALE_VOICES = ['Aoede', 'Zephyr', 'Kore'] as const;
export const BANNED_MALE_VOICES = ['Puck', 'Fenrir', 'Charon'] as const;

export type FemaleVoiceName = typeof ALLOWED_FEMALE_VOICES[number];

export interface VoiceLockDiagnostics {
  preferredVoice: string;
  activeVoice: string;
  fallbackVoice: string;
  voiceSource: 'VoiceLockCentral' | 'UserSelectedFemale' | 'FemaleFallback';
  sessionVoiceLocked: boolean;
  lastVoiceChangeReason: string;
}

/**
 * Resolves a requested voice string to a guaranteed female voice.
 * Never allows a male voice or unverified fallback voice.
 */
export function getLockedFemaleVoice(requestedVoice?: string | null): {
  voiceName: string;
  diagnostics: VoiceLockDiagnostics;
} {
  const req = (requestedVoice || '').trim();

  // If valid female voice requested, honor it (defaulting to Aoede)
  if (ALLOWED_FEMALE_VOICES.includes(req as FemaleVoiceName)) {
    return {
      voiceName: req,
      diagnostics: {
        preferredVoice: PREFERRED_FEMALE_VOICE,
        activeVoice: req,
        fallbackVoice: FALLBACK_FEMALE_VOICE,
        voiceSource: req === PREFERRED_FEMALE_VOICE ? 'VoiceLockCentral' : 'UserSelectedFemale',
        sessionVoiceLocked: true,
        lastVoiceChangeReason: `Guaranteed female voice '${req}' locked successfully.`,
      },
    };
  }

  // If requested voice is male or invalid, override strictly to Aoede
  const isMale = BANNED_MALE_VOICES.includes(req as any);
  const reason = isMale
    ? `Attempted male voice '${req}' blocked. Forced Permanent Female Voice Lock '${PREFERRED_FEMALE_VOICE}'.`
    : `Invalid/unspecified voice '${req}'. Defaulted to Permanent Female Voice Lock '${PREFERRED_FEMALE_VOICE}'.`;

  return {
    voiceName: PREFERRED_FEMALE_VOICE,
    diagnostics: {
      preferredVoice: PREFERRED_FEMALE_VOICE,
      activeVoice: PREFERRED_FEMALE_VOICE,
      fallbackVoice: FALLBACK_FEMALE_VOICE,
      voiceSource: 'VoiceLockCentral',
      sessionVoiceLocked: true,
      lastVoiceChangeReason: reason,
    },
  };
}
