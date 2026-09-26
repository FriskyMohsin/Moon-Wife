import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AvatarState, AvatarExpression, LipSyncState, AvatarConfig } from './types';
import { LipSyncEngine } from './LipSyncEngine';
import { LayeredCharacterAdapter } from './adapters/LayeredCharacterAdapter';
import { Live2DAdapter } from './adapters/Live2DAdapter';
import { VoiceState } from '../types';

interface AvatarStageProps {
  voiceState: VoiceState;
  audioLevel: number;
  emotion?: string;
  isConnected?: boolean;
  isCameraActive?: boolean;
  isOwner?: boolean;
  isThinking?: boolean;
  config?: Partial<AvatarConfig>;
  children?: React.ReactNode; // Optional overlay children
  onClick?: () => void;
}

export const AvatarStage: React.FC<AvatarStageProps> = ({
  voiceState,
  audioLevel,
  emotion = 'Affectionate',
  isConnected = true,
  isCameraActive = false,
  isOwner = true,
  isThinking = false,
  config,
  children,
  onClick,
}) => {
  const engineRef = useRef<LipSyncEngine>(new LipSyncEngine({
    attackAlpha: config?.lipSyncSmoothing ? 1 - config.lipSyncSmoothing : 0.65,
    decayAlpha: 0.18,
    silenceThreshold: 0.02,
    gain: 2.2,
  }));

  const [lipSyncState, setLipSyncState] = useState<LipSyncState>({
    mouthOpen: 0,
    mouthForm: 0.5,
    isSpeaking: false,
    amplitude: 0,
    smoothedAmplitude: 0,
  });

  const animFrameRef = useRef<number | null>(null);
  const isVisibleRef = useRef<boolean>(true);

  // Derive Avatar State from VoiceState, thinking, camera, and connection
  const deriveAvatarState = useCallback((): AvatarState => {
    if (!isConnected) return 'RECONNECTING';
    if (isThinking || voiceState === 'Thinking') return 'THINKING';
    if (voiceState === 'Speaking') return 'SPEAKING';
    if (voiceState === 'Listening') return 'LISTENING';
    if (isCameraActive) return 'CAMERA_ACTIVE';
    return 'IDLE';
  }, [isConnected, isThinking, voiceState, isCameraActive]);

  // Derive Expression from emotion and voice state
  const deriveExpression = useCallback((): AvatarExpression => {
    if (voiceState === 'Speaking') return 'speaking';
    if (voiceState === 'Listening') return 'listening';
    if (voiceState === 'Thinking' || isThinking) return 'thinking';

    const lowerEmotion = (emotion || '').toLowerCase();
    if (lowerEmotion.includes('happy') || lowerEmotion.includes('joy') || lowerEmotion.includes('laugh')) return 'happy';
    if (lowerEmotion.includes('love') || lowerEmotion.includes('affection') || lowerEmotion.includes('sweet')) return 'affectionate';
    if (lowerEmotion.includes('concern') || lowerEmotion.includes('care') || lowerEmotion.includes('worry')) return 'concerned';
    if (lowerEmotion.includes('surprise') || lowerEmotion.includes('amaz')) return 'surprised';
    return 'smile';
  }, [voiceState, isThinking, emotion]);

  const avatarState = deriveAvatarState();
  const expression = deriveExpression();

  // Resource Throttling: Track document visibility to pause animation loops when minimized/hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === 'visible';
      if (!isVisibleRef.current) {
        engineRef.current.reset();
        setLipSyncState(engineRef.current.getState(false));
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Real-time animation loop for lip-sync calculation
  useEffect(() => {
    let active = true;
    const isSpeaking = voiceState === 'Speaking';

    const updateLoop = () => {
      if (!active) return;
      if (isVisibleRef.current) {
        // Calculate lip sync state from current audio level
        const currentLipSync = engineRef.current.processAudioLevel(audioLevel, isSpeaking);
        setLipSyncState(currentLipSync);
      }
      animFrameRef.current = requestAnimationFrame(updateLoop);
    };

    animFrameRef.current = requestAnimationFrame(updateLoop);

    return () => {
      active = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [audioLevel, voiceState]);

  // Select adapter renderer
  const renderer = config?.renderer || 'layered-procedural';

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#0e040c]/90 via-[#070208] to-[#040105] rounded-3xl border border-rose-900/25 shadow-2xl">
      {/* Active Avatar Renderer */}
      {renderer === 'live2d' ? (
        <Live2DAdapter
          avatarState={avatarState}
          expression={expression}
          lipSync={lipSyncState}
          audioLevel={audioLevel}
          emotion={emotion}
          isConnected={isConnected}
          isCameraActive={isCameraActive}
          isOwner={isOwner}
          onClick={onClick}
          config={config}
        />
      ) : (
        <LayeredCharacterAdapter
          avatarState={avatarState}
          expression={expression}
          lipSync={lipSyncState}
          audioLevel={audioLevel}
          emotion={emotion}
          isConnected={isConnected}
          isCameraActive={isCameraActive}
          isOwner={isOwner}
          onClick={onClick}
          config={config}
        />
      )}

      {/* Floating Children / Picture-In-Picture Overlay */}
      {children && <div className="absolute inset-0 pointer-events-none z-30">{children}</div>}
    </div>
  );
};
