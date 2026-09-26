/**
 * Maryam V15.1 Lip-Sync Engine
 * Real-time audio amplitude-to-viseme/mouth mapping with asymmetric attack-decay Exponential Moving Average (EMA) smoothing and noise gating.
 *
 * NOTE: This engine operates strictly on incoming audio amplitude streams from Maryam's existing audio playback.
 * It does NOT instantiate duplicate TTS or alternate playback pipelines.
 */

import { LipSyncState } from './types';

export interface LipSyncOptions {
  /** Attack smoothing factor (0.0 to 1.0) - higher means faster mouth opening */
  attackAlpha: number;
  /** Decay smoothing factor (0.0 to 1.0) - higher means smoother/slower mouth closing */
  decayAlpha: number;
  /** Silence gate threshold [0.0 - 1.0] below which mouth remains closed */
  silenceThreshold: number;
  /** Max mouth opening multiplier */
  gain: number;
}

const DEFAULT_OPTIONS: LipSyncOptions = {
  attackAlpha: 0.65, // fast response on incoming speech bursts
  decayAlpha: 0.18,  // natural, organic mouth closure
  silenceThreshold: 0.02,
  gain: 2.2,
};

export class LipSyncEngine {
  private options: LipSyncOptions;
  private smoothedAmplitude: number = 0;
  private mouthOpen: number = 0;
  private mouthForm: number = 0.5; // neutral shape

  constructor(options: Partial<LipSyncOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Process a new audio level sample and compute the resulting lip-sync state.
   * @param rawAmplitude Raw normalized amplitude [0.0 - 1.0] from the active audio stream.
   * @param isSpeaking Whether Maryam's speech playback is currently active.
   */
  public processAudioLevel(rawAmplitude: number, isSpeaking: boolean): LipSyncState {
    const clampedRaw = Math.max(0, Math.min(1, rawAmplitude || 0));

    // If not speaking or below silence threshold, decay to silence
    if (!isSpeaking || clampedRaw < this.options.silenceThreshold) {
      this.smoothedAmplitude = Math.max(0, this.smoothedAmplitude * (1 - this.options.decayAlpha));
      this.mouthOpen = Math.max(0, this.mouthOpen * (1 - this.options.decayAlpha));
      return {
        mouthOpen: Number(this.mouthOpen.toFixed(4)),
        mouthForm: 0.5,
        isSpeaking,
        amplitude: clampedRaw,
        smoothedAmplitude: Number(this.smoothedAmplitude.toFixed(4)),
      };
    }

    // Dynamic Attack / Decay EMA filtering
    const isRising = clampedRaw > this.smoothedAmplitude;
    const alpha = isRising ? this.options.attackAlpha : this.options.decayAlpha;
    this.smoothedAmplitude = this.smoothedAmplitude * (1 - alpha) + clampedRaw * alpha;

    // Map smoothed amplitude to mouth open using non-linear curve for organic speech feel
    const amplified = Math.min(1, this.smoothedAmplitude * this.options.gain);
    // Non-linear power curve for natural mouth dynamics
    const targetMouthOpen = Math.pow(amplified, 0.85);

    // Smooth mouth open value
    const mouthAlpha = isRising ? 0.7 : 0.25;
    this.mouthOpen = this.mouthOpen * (1 - mouthAlpha) + targetMouthOpen * mouthAlpha;

    // Modulate mouth width / form (wider on loud vowels, rounder on subtle sounds)
    this.mouthForm = 0.4 + this.mouthOpen * 0.4;

    return {
      mouthOpen: Number(Math.max(0, Math.min(1, this.mouthOpen)).toFixed(4)),
      mouthForm: Number(Math.max(0, Math.min(1, this.mouthForm)).toFixed(4)),
      isSpeaking,
      amplitude: clampedRaw,
      smoothedAmplitude: Number(this.smoothedAmplitude.toFixed(4)),
    };
  }

  /**
   * Reset the engine state to resting closed mouth.
   */
  public reset(): void {
    this.smoothedAmplitude = 0;
    this.mouthOpen = 0;
    this.mouthForm = 0.5;
  }

  /**
   * Get the current lip sync state.
   */
  public getState(isSpeaking: boolean = false): LipSyncState {
    return {
      mouthOpen: Number(this.mouthOpen.toFixed(4)),
      mouthForm: Number(this.mouthForm.toFixed(4)),
      isSpeaking,
      amplitude: 0,
      smoothedAmplitude: Number(this.smoothedAmplitude.toFixed(4)),
    };
  }

  /**
   * Update engine configuration options dynamically.
   */
  public updateOptions(options: Partial<LipSyncOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

// Export singleton instance for convenience
export const globalLipSyncEngine = new LipSyncEngine();
