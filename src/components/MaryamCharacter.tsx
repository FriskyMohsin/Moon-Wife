import React, { useMemo } from 'react';
import { VoiceState, EmotionState } from '../types';
import { WifiOff } from 'lucide-react';

interface MaryamCharacterProps {
  voiceState: VoiceState;
  emotion: EmotionState;
  audioLevel: number;
  isConnected: boolean;
  customImageUrl?: string;
  onCharacterClick?: () => void;
  onSelectEmotion?: (emotion: EmotionState) => void;
}

export const MaryamCharacter: React.FC<MaryamCharacterProps> = ({
  voiceState,
  emotion,
  audioLevel,
  isConnected,
  customImageUrl,
  onCharacterClick,
  onSelectEmotion,
}) => {
  // Default Maryam character artwork asset URL
  const defaultImageUrl = customImageUrl || '/assets/maryam-final-desktop.png';

  const [imageSrc, setImageSrc] = React.useState<string>(defaultImageUrl);

  // Active state pill determination for subtle ambient effects
  const isListening = voiceState === 'Listening';
  const isThinking = voiceState === 'Thinking';
  const isSpeaking = voiceState === 'Speaking';
  const isHappy = emotion === 'Happy' || emotion === 'Excited' || emotion === 'Playful';
  const isCaring = emotion === 'Affectionate' || emotion === 'Concerned';

  return (
    <div
      onClick={onCharacterClick}
      className={`relative w-full h-full min-h-[360px] flex flex-col justify-between overflow-hidden bg-transparent cursor-pointer group select-none transition-all duration-700 ${
        !isConnected ? 'brightness-75' : ''
      }`}
    >
      {/* Dynamic State Ambient Glow Layer (Behind Artwork) */}
      <div
        className={`absolute inset-0 z-10 transition-all duration-700 pointer-events-none opacity-60 ${
          isListening
            ? 'bg-rose-600/20 shadow-[inset_0_0_80px_rgba(244,63,94,0.3)]'
            : isThinking
            ? 'bg-violet-600/20 shadow-[inset_0_0_80px_rgba(139,92,246,0.3)]'
            : isSpeaking
            ? 'bg-rose-500/25 shadow-[inset_0_0_100px_rgba(244,63,94,0.4)]'
            : isHappy
            ? 'bg-amber-500/15 shadow-[inset_0_0_60px_rgba(245,158,11,0.2)]'
            : isCaring
            ? 'bg-rose-600/15 shadow-[inset_0_0_60px_rgba(225,29,72,0.2)]'
            : 'bg-transparent'
        }`}
        style={{
          transform: isSpeaking ? `scale(${1 + audioLevel * 0.05})` : 'scale(1)',
        }}
      />

      {/* Main Character Artwork - Upper Body & Scene Presentation */}
      <div className="relative w-full h-full min-h-[360px] flex-1 flex items-center justify-center overflow-hidden">
        <img
          src={imageSrc}
          alt="Maryam AI Companion"
          referrerPolicy="no-referrer"
          onError={() => {
            console.warn('Maryam asset load warning, retrying local asset...');
            setImageSrc('/assets/maryam-final-desktop.png');
          }}
          className={`w-full h-full object-cover object-[47%_45%] filter contrast-[1.02] brightness-[0.98] transition-transform duration-700 group-hover:scale-[1.008] ${
            isSpeaking ? 'animate-pulse' : ''
          }`}
        />

        {/* Blend the cinematic artwork into the page instead of presenting it as a framed card. */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#06040a_0%,transparent_13%,transparent_82%,#06040a_100%),linear-gradient(to_top,#06040a_0%,transparent_22%,transparent_54%)] pointer-events-none" />

        {/* Reconnecting Badge if Offline */}
        {!isConnected && (
          <div className="absolute top-4 right-4 z-30 px-3 py-1 rounded-full bg-amber-950/90 border border-amber-700/50 text-amber-300 text-xs font-medium flex items-center gap-1.5 shadow-lg backdrop-blur-md">
            <WifiOff className="w-3.5 h-3.5" />
            <span>Reconnecting...</span>
          </div>
        )}
      </div>
    </div>
  );
};
