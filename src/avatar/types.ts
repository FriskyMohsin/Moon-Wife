/**
 * Maryam V15.1 Avatar Subsystem Types
 * Dedicated definitions for Avatar state, expressions, lip-sync, and adapter contracts.
 */

export type AvatarState =
  | 'IDLE'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'CAMERA_ACTIVE'
  | 'RECONNECTING'
  | 'OFFLINE_ERROR';

export type AvatarExpression =
  | 'neutral'
  | 'happy'
  | 'smile'
  | 'affectionate'
  | 'concerned'
  | 'surprised'
  | 'thinking'
  | 'listening'
  | 'speaking';

export interface LipSyncState {
  /** Normalized mouth openness from 0.0 (closed) to 1.0 (wide open) */
  mouthOpen: number;
  /** Normalized mouth form factor from 0.0 (round/narrow) to 1.0 (wide/spread) */
  mouthForm: number;
  /** Whether the avatar is currently in speaking mode with active speech audio */
  isSpeaking: boolean;
  /** Instantaneous audio amplitude [0.0 - 1.0] */
  amplitude: number;
  /** Exponentially smoothed audio amplitude [0.0 - 1.0] */
  smoothedAmplitude: number;
}

export interface AvatarConfig {
  /** Selected rendering adapter mode */
  renderer: 'layered-procedural' | 'live2d' | 'placeholder';
  /** Primary character artwork / model asset URL */
  assetUrl?: string;
  /** Scale factor */
  scale?: number;
  /** Breathing animation cycle period in seconds */
  breathingPeriodSeconds?: number;
  /** Smoothing factor for lip sync (0.0 to 1.0) */
  lipSyncSmoothing?: number;
}

export interface IAvatarAdapterProps {
  avatarState: AvatarState;
  expression: AvatarExpression;
  lipSync: LipSyncState;
  audioLevel: number;
  emotion: string;
  isConnected: boolean;
  isCameraActive: boolean;
  isOwner?: boolean;
  onClick?: () => void;
  config?: Partial<AvatarConfig>;
}

export interface IAvatarAdapter {
  id: string;
  name: string;
  isAvailable: boolean;
  render: (props: IAvatarAdapterProps) => React.ReactNode;
}
