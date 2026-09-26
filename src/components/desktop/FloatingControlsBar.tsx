import React, { useState } from 'react';
import { VoiceState, WakeWordStatus } from '../../types';
import {
  Mic,
  MicOff,
  Send,
  Hand,
  Sparkles,
  Radio,
  Camera,
  CameraOff,
  ImagePlus,
  Video,
  VideoOff,
} from 'lucide-react';
import { motion } from 'motion/react';

interface FloatingControlsBarProps {
  voiceState: VoiceState;
  isMuted: boolean;
  onToggleMic: () => void;
  onToggleMute: () => void;
  onBargeIn: () => void;
  onSendMessage: (text: string) => void;
  disabled: boolean;
  wakeWordActive: boolean;
  wakeWordStatus: WakeWordStatus;
  enableWakeWord: boolean;
  wakePhrase: string;
  onTriggerWakeWord: () => void;
  isCameraActive?: boolean;
  onToggleCamera?: () => void;
  onSelectImage?: (file: File) => void;
  isVideoCallActive?: boolean;
  onToggleVideoCall?: () => void;
  onToggleQuickActions?: () => void;
  isQuickActionsOpen?: boolean;
}

export const FloatingControlsBar: React.FC<FloatingControlsBarProps> = ({
  voiceState,
  isMuted,
  onToggleMic,
  onToggleMute,
  onBargeIn,
  onSendMessage,
  disabled,
  wakeWordActive,
  wakeWordStatus,
  enableWakeWord,
  wakePhrase,
  onTriggerWakeWord,
  isCameraActive = false,
  onToggleCamera,
  onSelectImage,
  isVideoCallActive = false,
  onToggleVideoCall,
  onToggleQuickActions,
  isQuickActionsOpen = false,
}) => {
  const [inputText, setInputText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || disabled) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const isSpeaking = voiceState === 'Speaking';
  const isListening = voiceState === 'Listening';

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 py-2.5 flex flex-col gap-2 relative z-40 select-none">
      {/* Barge-in / Interrupt Action Banner if Maryam is speaking */}
      {isSpeaking && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="flex items-center justify-between px-3.5 py-1.5 rounded-2xl bg-rose-950/90 border border-rose-700/60 text-rose-200 text-xs shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
            <span className="font-serif italic text-[11px]">Maryam is speaking...</span>
          </div>
          <button
            id="btn-barge-in-interrupt"
            onClick={onBargeIn}
            className="px-3 py-1 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-medium flex items-center gap-1.5 text-[11px] shadow transition-all active:scale-95"
          >
            <Hand className="w-3.5 h-3.5" />
            <span>Interrupt Maryam</span>
          </button>
        </motion.div>
      )}

      {/* Main Glassmorphic Dock */}
      <div className="w-full p-2 rounded-3xl bg-[#120512]/90 backdrop-blur-2xl border border-rose-900/40 shadow-2xl shadow-black/90 flex items-center gap-2">
        {/* Primary Mic Toggle Orb */}
        <div className="relative shrink-0">
          <motion.button
            id="btn-toggle-mic"
            type="button"
            onClick={onToggleMic}
            whileTap={{ scale: 0.92 }}
            className={`p-3 sm:p-3.5 rounded-2xl flex items-center justify-center transition-all shadow-lg ${
              isListening
                ? 'bg-gradient-to-tr from-rose-600 to-rose-500 text-white shadow-rose-600/50 ring-2 ring-rose-400 animate-pulse'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-rose-900/40'
            }`}
            title={isListening ? 'Stop listening' : 'Talk with Maryam'}
          >
            {isListening ? <Mic className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-rose-300" />}
          </motion.button>

          {/* Mute toggle indicator badge */}
          {isListening && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleMute();
              }}
              className={`absolute -top-1 -right-1 p-1 rounded-full text-[10px] shadow border border-white/20 transition-all ${
                isMuted ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-300'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
            </button>
          )}
        </div>

        {/* Video Call Toggle Button */}
        {onToggleVideoCall && (
          <motion.button
            id="btn-toggle-video-call"
            type="button"
            onClick={onToggleVideoCall}
            whileTap={{ scale: 0.92 }}
            className={`p-3 rounded-2xl flex items-center justify-center transition-all border shrink-0 ${
              isVideoCallActive
                ? 'bg-rose-600 text-white border-rose-400 ring-2 ring-rose-400 animate-pulse'
                : 'bg-zinc-900 hover:bg-zinc-800 text-rose-300 border-rose-900/40'
            }`}
            title={isVideoCallActive ? 'End Live Video Call' : 'Start Live Video Call with Mohsin'}
          >
            {isVideoCallActive ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </motion.button>
        )}

        {/* Camera Toggle Button for Gemini Vision */}
        {onToggleCamera && (
          <motion.button
            id="btn-toggle-camera"
            type="button"
            onClick={onToggleCamera}
            whileTap={{ scale: 0.92 }}
            className={`p-3 rounded-2xl flex items-center justify-center transition-all shrink-0 ${
              isCameraActive
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/50 ring-2 ring-emerald-400'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-rose-900/40'
            }`}
            title={isCameraActive ? 'Turn Camera OFF' : 'Turn Camera ON for Maryam Vision'}
          >
            {isCameraActive ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
          </motion.button>
        )}

        {/* Image Attachment for Vision */}
        {onSelectImage && (
          <label
            className="p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-rose-900/40 cursor-pointer shrink-0 transition-all"
            title="Attach an image for Maryam Vision Analysis"
          >
            <ImagePlus className="w-4 h-4" />
            <input
              id="input-vision-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) onSelectImage(file);
                event.currentTarget.value = '';
              }}
            />
          </label>
        )}

        {/* Quick Actions Menu Trigger */}
        {onToggleQuickActions && (
          <motion.button
            id="btn-toggle-quick-actions"
            type="button"
            onClick={onToggleQuickActions}
            whileTap={{ scale: 0.92 }}
            className={`p-3 rounded-2xl flex items-center gap-1.5 transition-all shrink-0 ${
              isQuickActionsOpen
                ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-lg ring-2 ring-rose-400'
                : 'bg-zinc-900 hover:bg-zinc-800 text-rose-300 border border-rose-900/40'
            }`}
            title="Quick Actions"
          >
            <Sparkles className="w-4 h-4 text-rose-400 shrink-0" />
          </motion.button>
        )}

        {/* Text Message Input Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-1.5 relative min-w-0">
          <input
            id="input-maryam-message"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Talk with Maryam... (English / Roman Urdu)"
            disabled={disabled}
            className="w-full bg-zinc-900/90 text-xs sm:text-sm text-white placeholder-zinc-500 px-3.5 py-2.5 rounded-2xl border border-rose-900/30 focus:outline-none focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/40 shadow-inner truncate"
          />

          <button
            id="btn-send-message"
            type="submit"
            disabled={!inputText.trim() || disabled}
            className="p-2.5 sm:p-3 rounded-2xl bg-gradient-to-tr from-rose-600 to-violet-700 hover:from-rose-500 hover:to-violet-600 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-rose-950/40 transition-all active:scale-95 shrink-0"
            title="Send Message"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* Wake Word & Continuous Standby Sub-bar */}
      <div className="flex items-center justify-between px-2 text-[10px] text-zinc-400">
        <button
          onClick={onTriggerWakeWord}
          className="flex items-center gap-1 hover:text-rose-300 transition-colors cursor-pointer"
          title={`Click to test "${wakePhrase}"`}
        >
          <Sparkles className="w-3 h-3 text-rose-400" />
          <span>Wake Phrase:</span>
          <span className="text-zinc-200 font-medium underline underline-offset-2 decoration-rose-500/40">
            "{wakePhrase}"
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          {enableWakeWord && wakeWordStatus === 'waiting' && voiceState === 'Idle' ? (
            <span className="flex items-center gap-1 text-rose-300 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              Listening for "Hello Baby"
            </span>
          ) : wakeWordStatus === 'detected' ? (
            <span className="flex items-center gap-1 text-rose-300 font-medium">
              <Radio className="w-3 h-3 animate-spin text-rose-400" />
              Activating Maryam...
            </span>
          ) : (
            <span className="text-zinc-500">
              {wakeWordActive ? '👂 Wake standby active' : 'Wake standby off'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
