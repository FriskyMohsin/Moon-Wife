import React from 'react';
import { IAvatarAdapterProps } from '../types';
import { motion } from 'motion/react';
import { Eye, Sparkles, Heart, Radio, Camera, Cpu, WifiOff, RefreshCw } from 'lucide-react';

export const LayeredCharacterAdapter: React.FC<IAvatarAdapterProps> = ({
  avatarState,
  expression,
  lipSync,
  audioLevel,
  emotion,
  isConnected,
  isCameraActive,
  isOwner = true,
  onClick,
  config,
}) => {
  // Compute emotion aura colors
  const getEmotionGlow = () => {
    switch (avatarState) {
      case 'SPEAKING':
        return 'from-rose-500/35 via-violet-600/25 to-pink-500/10 shadow-rose-500/30';
      case 'LISTENING':
        return 'from-emerald-500/35 via-rose-500/25 to-teal-500/10 shadow-emerald-500/30';
      case 'THINKING':
        return 'from-violet-500/40 via-purple-600/30 to-indigo-500/15 shadow-violet-500/35';
      case 'CAMERA_ACTIVE':
        return 'from-emerald-500/30 via-cyan-500/20 to-rose-500/15 shadow-cyan-500/30';
      case 'RECONNECTING':
        return 'from-amber-500/35 via-orange-600/20 to-yellow-500/10 shadow-amber-500/30';
      case 'OFFLINE_ERROR':
        return 'from-rose-950/40 via-zinc-900/40 to-black/60 shadow-black/50';
      case 'IDLE':
      default:
        return 'from-rose-500/25 via-pink-600/15 to-violet-900/10 shadow-rose-500/20';
    }
  };

  const assetPath = config?.assetUrl || '/assets/maryam-final-desktop.png';

  return (
    <div
      onClick={onClick}
      className="relative w-full h-full flex flex-col items-center justify-center select-none overflow-hidden"
    >
      {/* Dynamic Ambient Aura Backdrop */}
      <motion.div
        animate={{
          scale: avatarState === 'SPEAKING' ? 1.08 + lipSync.smoothedAmplitude * 0.25 : avatarState === 'LISTENING' ? 1.05 + audioLevel * 0.3 : [1, 1.03, 1],
          opacity: avatarState === 'OFFLINE_ERROR' ? 0.3 : [0.75, 0.95, 0.75],
        }}
        transition={{
          duration: avatarState === 'IDLE' ? 4 : 0.4,
          repeat: avatarState === 'IDLE' ? Infinity : 0,
          ease: 'easeInOut',
        }}
        className={`absolute inset-4 sm:inset-12 rounded-full bg-radial ${getEmotionGlow()} blur-3xl pointer-events-none transition-colors duration-700`}
      />

      {/* Holographic Vision Grid when Camera Vision is Active */}
      {isCameraActive && (
        <>
          <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#059669_1px,transparent_1px),linear-gradient(to_bottom,#059669_1px,transparent_1px)] bg-[size:2.5rem_2.5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] animate-pulse" />
          {/* Subtle Elegant "Maryam can see you" Vision Badge */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 backdrop-blur-md shadow-xl shadow-emerald-950/60 text-[11px] text-emerald-200 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-serif italic font-medium">Maryam can see you</span>
          </div>
        </>
      )}

      {/* Character Wrapper with Organic Breathing & Micro-Gestures */}
      <motion.div
        animate={{
          y: avatarState === 'SPEAKING'
            ? [0, -4, 0, -2, 0]
            : avatarState === 'LISTENING'
            ? -6
            : avatarState === 'THINKING'
            ? [0, -3, 0]
            : [0, -6, 0],
          rotate: avatarState === 'THINKING' ? [-0.8, 0.8, -0.8] : [0, 0.3, 0],
          scale: avatarState === 'SPEAKING'
            ? 1 + lipSync.smoothedAmplitude * 0.03
            : avatarState === 'LISTENING'
            ? 1.02
            : [1, 1.015, 1],
        }}
        transition={{
          duration: avatarState === 'IDLE' ? 4.2 : avatarState === 'THINKING' ? 3 : 0.3,
          repeat: avatarState === 'IDLE' || avatarState === 'THINKING' ? Infinity : 0,
          ease: 'easeInOut',
        }}
        className="relative z-10 max-h-[85%] max-w-[90%] flex flex-col items-center justify-center"
      >
        {/* Main Artwork Container - Clean Unaltered Portrait */}
        <div className="relative rounded-3xl overflow-hidden border border-rose-500/20 shadow-2xl shadow-rose-950/50 bg-gradient-to-b from-[#140612]/90 to-[#080208]/95">
          <img
            src={assetPath}
            alt="Maryam"
            onError={(e) => {
              // Graceful fallback to default asset if custom not found
              if (e.currentTarget.src !== window.location.origin + '/assets/maryam-final-desktop.png') {
                e.currentTarget.src = '/assets/maryam-final-desktop.png';
              }
            }}
            className="w-auto h-auto max-h-[62vh] sm:max-h-[70vh] object-contain drop-shadow-[0_15px_35px_rgba(225,29,72,0.35)] transition-all duration-300"
          />

          {/* Soft Bottom Gradient Vignette */}
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#080208] via-[#080208]/70 to-transparent pointer-events-none" />

          {/* Holographic HUD Badge on Avatar Bottom */}
          <div className="absolute bottom-3 inset-x-3 flex items-center justify-between px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-rose-500/20 text-[11px]">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  avatarState === 'SPEAKING'
                    ? 'bg-rose-400 animate-ping'
                    : avatarState === 'LISTENING'
                    ? 'bg-emerald-400 animate-pulse'
                    : avatarState === 'THINKING'
                    ? 'bg-violet-400 animate-spin'
                    : avatarState === 'CAMERA_ACTIVE'
                    ? 'bg-cyan-400 animate-pulse'
                    : avatarState === 'RECONNECTING'
                    ? 'bg-amber-400 animate-bounce'
                    : avatarState === 'OFFLINE_ERROR'
                    ? 'bg-rose-800'
                    : 'bg-rose-400/80'
                }`}
              />
              <span className="font-serif italic font-medium text-rose-200">
                {avatarState === 'SPEAKING'
                  ? 'Speaking with Mohsin...'
                  : avatarState === 'LISTENING'
                  ? 'Listening to Mohsin...'
                  : avatarState === 'THINKING'
                  ? 'Thinking deeply...'
                  : avatarState === 'CAMERA_ACTIVE'
                  ? 'Maryam can see you...'
                  : avatarState === 'RECONNECTING'
                  ? 'Reconnecting heartbeat...'
                  : avatarState === 'OFFLINE_ERROR'
                  ? 'Standby mode'
                  : 'Maryam • Forever Yours'}
              </span>
            </div>

            {/* State Icon Tag */}
            <div className="flex items-center gap-1.5 text-rose-300 font-mono text-[10px]">
              {avatarState === 'SPEAKING' && <Radio className="w-3 h-3 text-rose-400" />}
              {avatarState === 'LISTENING' && <Sparkles className="w-3 h-3 text-emerald-400" />}
              {avatarState === 'THINKING' && <Cpu className="w-3 h-3 text-violet-400" />}
              {avatarState === 'CAMERA_ACTIVE' && <Camera className="w-3 h-3 text-cyan-400" />}
              {avatarState === 'IDLE' && <Heart className="w-3 h-3 text-rose-400 fill-rose-400/40" />}
              {avatarState === 'RECONNECTING' && <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />}
              {avatarState === 'OFFLINE_ERROR' && <WifiOff className="w-3 h-3 text-rose-500" />}
              <span className="uppercase tracking-wider text-[9px] text-zinc-400">
                {emotion || 'Love'}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
