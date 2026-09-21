import React from 'react';
import { motion } from 'motion/react';
import { EmotionState, VoiceState, WakeWordStatus } from '../types';
import { EMOTION_MAP } from '../lib/emotionConfig';
import { Sparkles, Mic, Volume2, Radio } from 'lucide-react';

interface VoiceOrbProps {
  voiceState: VoiceState;
  emotion: EmotionState;
  audioLevel: number;
  onOrbClick: () => void;
  isMuted: boolean;
  wakeWordStatus?: WakeWordStatus;
  enableWakeWord?: boolean;
  wakePhrase?: string;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  voiceState,
  emotion,
  audioLevel,
  onOrbClick,
  isMuted,
  wakeWordStatus = 'idle',
  enableWakeWord = false,
  wakePhrase = 'Hello Baby',
}) => {
  const meta = EMOTION_MAP[emotion] || EMOTION_MAP.Normal;

  // Audio level amplification for visual flare
  const dynamicScale = 1 + Math.min(audioLevel * 1.8, 0.45);
  const glowIntensity = Math.min(0.4 + audioLevel * 1.2, 0.95);

  const isStandbyWaiting = voiceState === 'Idle' && enableWakeWord && wakeWordStatus === 'waiting';
  const isWakeDetected = wakeWordStatus === 'detected';

  return (
    <div className="relative flex flex-col items-center justify-center py-6 select-none">
      {/* Outer ambient glow halo */}
      <div
        className="absolute rounded-full transition-all duration-700 pointer-events-none blur-3xl opacity-70"
        style={{
          width: '260px',
          height: '260px',
          background: `radial-gradient(circle, ${meta.orbGlow} 0%, ${meta.haloRgba} 50%, transparent 75%)`,
          transform: `scale(${dynamicScale * (voiceState === 'Speaking' ? 1.3 : 1.1)})`,
        }}
      />

      {/* Floating secondary particle rings */}
      <motion.div
        animate={{
          rotate: [0, 360],
          scale: voiceState === 'Speaking' ? [1, 1.08, 1] : [1, 1.03, 1],
        }}
        transition={{
          rotate: { duration: 18, repeat: Infinity, ease: 'linear' },
          scale: { duration: meta.pulseSpeed, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="absolute w-52 h-52 rounded-full border border-white/10 pointer-events-none"
        style={{
          boxShadow: `0 0 40px ${meta.haloRgba}`,
        }}
      />

      <motion.div
        animate={{
          rotate: [360, 0],
          scale: voiceState === 'Listening' ? [1.02, 1.15, 1.02] : [1, 1.05, 1],
        }}
        transition={{
          rotate: { duration: 24, repeat: Infinity, ease: 'linear' },
          scale: { duration: meta.pulseSpeed * 0.9, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="absolute w-44 h-44 rounded-full border border-dashed border-white/15 pointer-events-none"
      />

      {/* Central Interactive Voice Orb */}
      <motion.button
        id="maryam-voice-orb-button"
        onClick={onOrbClick}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        animate={{
          scale: dynamicScale,
        }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="relative z-10 w-36 h-36 rounded-full cursor-pointer flex items-center justify-center overflow-hidden focus:outline-none focus:ring-2 focus:ring-rose-400/50 shadow-2xl"
        style={{
          background: `radial-gradient(circle at 35% 30%, #ffffff 0%, ${meta.orbPrimary} 35%, ${meta.orbSecondary} 75%, #180924 100%)`,
          boxShadow: `0 0 ${40 * glowIntensity}px ${meta.orbGlow}, inset 0 0 25px rgba(255,255,255,0.4)`,
        }}
      >
        {/* Shimmer overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-white/20 rounded-full" />

        {/* State Icon / Graphic */}
        <div className="relative z-20 flex flex-col items-center justify-center text-white drop-shadow-md">
          {voiceState === 'Speaking' ? (
            <motion.div
              animate={{ scale: [1, 1.25, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="flex items-center gap-1"
            >
              <Volume2 className="w-8 h-8 text-white animate-pulse" />
            </motion.div>
          ) : voiceState === 'Listening' ? (
            <motion.div
              animate={{ scale: [1, 1.18, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="flex items-center justify-center"
            >
              <Mic className="w-8 h-8 text-white" />
            </motion.div>
          ) : voiceState === 'Thinking' ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.8, ease: 'linear' }}
            >
              <Sparkles className="w-8 h-8 text-amber-200" />
            </motion.div>
          ) : isWakeDetected ? (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 0.5 }}
              className="flex items-center justify-center"
            >
              <Radio className="w-8 h-8 text-rose-300 animate-pulse" />
            </motion.div>
          ) : (
            <div className="flex flex-col items-center">
              <span className="text-xl font-light tracking-wider font-serif text-white/90">مریم</span>
              <span className="text-[10px] uppercase tracking-widest text-white/70 font-sans mt-0.5">Maryam</span>
            </div>
          )}
        </div>

        {/* Dynamic soundwaves inside orb when speaking */}
        {voiceState === 'Speaking' && (
          <div className="absolute bottom-4 flex items-end gap-1 h-5">
            {[0.4, 0.9, 0.6, 1.0, 0.5, 0.8].map((h, i) => (
              <motion.span
                key={i}
                animate={{ height: ['20%', `${Math.min(100, (h + audioLevel) * 90)}%`, '25%'] }}
                transition={{ repeat: Infinity, duration: 0.4 + i * 0.1, ease: 'easeInOut' }}
                className="w-1 bg-white/80 rounded-full"
              />
            ))}
          </div>
        )}
      </motion.button>

      {/* Status label under orb */}
      <div className="mt-4 flex flex-col items-center gap-1 z-10">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              voiceState === 'Speaking'
                ? 'bg-emerald-400 animate-ping'
                : voiceState === 'Listening'
                ? 'bg-rose-400 animate-pulse'
                : voiceState === 'Thinking'
                ? 'bg-amber-400 animate-spin'
                : isWakeDetected
                ? 'bg-rose-400 animate-ping'
                : isStandbyWaiting
                ? 'bg-violet-400 animate-pulse'
                : 'bg-zinc-500'
            }`}
          />
          <span className="text-xs font-medium tracking-wide text-zinc-300">
            {voiceState === 'Speaking'
              ? 'Maryam is speaking...'
              : voiceState === 'Listening'
              ? (isMuted ? 'Mic is muted' : 'Listening to Mohsin...')
              : voiceState === 'Thinking'
              ? 'Maryam is thinking meri jaan...'
              : isWakeDetected
              ? 'Wake phrase detected! Activating...'
              : isStandbyWaiting
              ? `Waiting for "${wakePhrase}"...`
              : 'Tap to talk with Maryam'}
          </span>
        </div>

        {isStandbyWaiting ? (
          <span className="text-[11px] text-rose-300/80">
            Say <span className="font-semibold text-rose-300">"{wakePhrase}"</span> clearly or tap orb
          </span>
        ) : (
          <span className="text-[11px] text-zinc-400 italic">
            "{meta.urduHint}"
          </span>
        )}
      </div>
    </div>
  );
};
