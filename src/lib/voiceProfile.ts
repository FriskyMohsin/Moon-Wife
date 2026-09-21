/**
 * Owner Voice Profile & Verification Module
 * Provides privacy-conscious, local-only voice feature extraction and speaker confidence scoring.
 * 
 * Note: Uses local fundamental frequency (pitch) autocorrelation and spectral centroid profiling.
 * Does NOT send or store raw microphone recordings externally.
 */

export interface VoiceProfile {
  enrolled: boolean;
  minPitchHz: number;
  maxPitchHz: number;
  avgPitchHz: number;
  avgSpectralCentroid: number;
  enrolledAt: number;
}

const STORAGE_KEY = 'maryam_owner_voiceprint_v1';

export function getOwnerVoiceProfile(): VoiceProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.avgPitchHz === 'number') {
      return parsed as VoiceProfile;
    }
  } catch (err) {
    console.warn('Failed to parse owner voice profile:', err);
  }
  return null;
}

export function saveOwnerVoiceProfile(profile: VoiceProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error('Failed to save owner voice profile:', err);
  }
}

export function clearOwnerVoiceProfile(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear owner voice profile:', err);
  }
}

/**
 * Estimates fundamental frequency (F0) using autocorrelation and spectral centroid.
 */
export function extractAudioFeatures(buffer: Float32Array, sampleRate: number = 16000): { pitchHz: number; spectralCentroid: number } {
  // 1. Calculate Spectral Centroid
  let sumWeightedFreq = 0;
  let sumMag = 0;
  const fftSize = buffer.length;

  for (let i = 0; i < fftSize / 2; i++) {
    const mag = Math.abs(buffer[i]);
    const freq = (i * sampleRate) / fftSize;
    sumWeightedFreq += freq * mag;
    sumMag += mag;
  }

  const spectralCentroid = sumMag > 0.001 ? sumWeightedFreq / sumMag : 0;

  // 2. Autocorrelation for Pitch (F0) Estimation
  const minLag = Math.floor(sampleRate / 400); // Max pitch 400 Hz
  const maxLag = Math.floor(sampleRate / 70);  // Min pitch 70 Hz

  let bestLag = -1;
  let maxCorr = 0;

  // Calculate energy for normalization
  let totalEnergy = 0;
  for (let i = 0; i < buffer.length; i++) {
    totalEnergy += buffer[i] * buffer[i];
  }

  if (totalEnergy < 0.001) {
    return { pitchHz: 0, spectralCentroid: 0 };
  }

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < buffer.length - lag; i++) {
      corr += buffer[i] * buffer[i + lag];
    }
    if (corr > maxCorr) {
      maxCorr = corr;
      bestLag = lag;
    }
  }

  const normCorr = maxCorr / totalEnergy;
  const pitchHz = (bestLag > 0 && normCorr > 0.3) ? sampleRate / bestLag : 0;

  return { pitchHz, spectralCentroid };
}

/**
 * Scores incoming audio against the enrolled owner profile.
 */
export function verifyOwnerVoice(
  buffer: Float32Array,
  sampleRate: number,
  profile: VoiceProfile | null
): { isOwner: boolean; confidence: number; reason: string; isVoiced: boolean; pitchHz: number; spectralCentroid: number } {
  const { pitchHz, spectralCentroid } = extractAudioFeatures(buffer, sampleRate);

  if (!profile || !profile.enrolled) {
    const isVoiced = pitchHz > 0;
    return {
      isOwner: true,
      confidence: isVoiced ? 0.7 : 0.0,
      reason: isVoiced ? 'Voiced speech frame (Owner voice profile not enrolled)' : 'Unvoiced / ambient noise frame',
      isVoiced,
      pitchHz,
      spectralCentroid,
    };
  }

  if (pitchHz === 0) {
    // Unvoiced noise, door slam, fan hum, or room ambient frame
    return {
      isOwner: false,
      confidence: 0.0,
      reason: 'Unvoiced / ambient room noise frame',
      isVoiced: false,
      pitchHz: 0,
      spectralCentroid,
    };
  }

  // Pitch similarity check
  const minAllowed = Math.max(50, profile.minPitchHz - 40);
  const maxAllowed = profile.maxPitchHz + 40;
  const isPitchInRange = pitchHz >= minAllowed && pitchHz <= maxAllowed;

  const pitchDiff = Math.abs(pitchHz - profile.avgPitchHz);
  const pitchScore = Math.max(0, 1 - pitchDiff / 100);

  // Spectral centroid similarity
  const centroidDiff = Math.abs(spectralCentroid - profile.avgSpectralCentroid);
  const centroidScore = Math.max(0, 1 - centroidDiff / 2000);

  const confidence = Math.round((pitchScore * 0.65 + centroidScore * 0.35) * 100) / 100;
  const isOwner = isPitchInRange && confidence >= 0.40;

  return {
    isOwner,
    confidence,
    reason: isOwner
      ? `Owner voice match (${Math.round(confidence * 100)}% confidence, F0: ${Math.round(pitchHz)}Hz)`
      : `Different speaker / background voice (F0: ${Math.round(pitchHz)}Hz vs Owner Profile: ${Math.round(profile.avgPitchHz)}Hz)`,
    isVoiced: true,
    pitchHz,
    spectralCentroid,
  };
}
