import React, { useState, useEffect } from 'react';
import { ChatMessage, VoiceState, WakeWordStatus } from '../types';
import { ConversationView } from './ConversationView';
import { ControlsBar } from './ControlsBar';
import { Camera, Globe, Bookmark, Calendar, Compass, Sparkles, Heart, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RightConversationPanelProps {
  messages: ChatMessage[];
  isThinking: boolean;
  voiceState: VoiceState;
  isMuted: boolean;
  audioLevel: number;
  playingMessageId: string | null;
  isGuestMode?: boolean;
  onEndGuestMode?: () => void;
  onPlayMessageAudio: (msg: ChatMessage) => void;
  onSendMessage: (text: string) => void;
  onToggleMic: () => void;
  onToggleMute: () => void;
  onBargeIn: () => void;
  onToggleCamera: () => void;
  onSelectImage?: (file: File) => void;
  isVideoCallActive?: boolean;
  onToggleVideoCall?: () => void;
  isCameraActive: boolean;
  wakeWordActive: boolean;
  wakeWordStatus: WakeWordStatus;
  enableWakeWord: boolean;
  wakePhrase: string;
  onTriggerWakeWord: () => void;
  onOpenMemory: () => void;
  onOpenToolRunner: () => void;
  onSelectTab: (tab: string) => void;
}

export const RightConversationPanel: React.FC<RightConversationPanelProps> = ({
  messages,
  isThinking,
  voiceState,
  isMuted,
  audioLevel,
  playingMessageId,
  isGuestMode,
  onEndGuestMode,
  onPlayMessageAudio,
  onSendMessage,
  onToggleMic,
  onToggleMute,
  onBargeIn,
  onToggleCamera,
  onSelectImage,
  isVideoCallActive,
  onToggleVideoCall,
  isCameraActive,
  wakeWordActive,
  wakeWordStatus,
  enableWakeWord,
  wakePhrase,
  onTriggerWakeWord,
  onOpenMemory,
  onOpenToolRunner,
  onSelectTab,
}) => {
  const [now, setNow] = useState(new Date());
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsQuickActionsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const quickActions = [
    { label: 'Take a Photo', icon: Camera, action: onToggleCamera },
    { label: 'Browse for Me', icon: Globe, action: () => onSendMessage('Maryam, please search the web for the latest tech news today.') },
    { label: 'Remember This', icon: Bookmark, action: onOpenMemory },
    { label: 'Set a Reminder', icon: Calendar, action: () => onSelectTab('reminders') },
    { label: 'Run a Tool', icon: Compass, action: onOpenToolRunner },
    { label: "Let's Talk", icon: Sparkles, action: onToggleMic },
  ];

  const isListening = voiceState === 'Listening';
  const isSpeaking = voiceState === 'Speaking';

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col justify-between rounded-3xl border border-rose-900/30 bg-[#0a0409]/90 backdrop-blur-xl overflow-hidden shadow-2xl relative">
      {/* Top Header Bar */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-rose-900/25 bg-[#0f060d]/80 text-xs">
        {/* Status Pill */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
          <span className="font-medium text-emerald-300">Online</span>
        </div>

        {/* Romantic Center Text */}
        <div className="flex items-center gap-1.5 text-rose-200/90 font-serif italic text-xs">
          <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400/50" />
          <span>With You Always</span>
        </div>

        {/* Real Date & Time Display */}
        <div className="text-zinc-400 text-[11px] font-mono flex items-center gap-2">
          <span>{formattedDate}</span>
          <span className="text-rose-300 font-semibold">{formattedTime}</span>
        </div>
      </div>

      {/* Guest Mode Active Banner */}
      {isGuestMode && (
        <div className="shrink-0 px-4 py-2 bg-amber-950/60 border-b border-amber-800/40 text-amber-200 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="font-semibold text-amber-100">Guest Mode Active:</span>
            <span className="text-[11px] text-amber-300/90 hidden sm:inline">
              Formal assistant tone active. Private core memories & sensitive actions protected.
            </span>
          </div>
          {onEndGuestMode && (
            <button
              onClick={onEndGuestMode}
              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-[11px] transition-all"
            >
              End Guest Mode
            </button>
          )}
        </div>
      )}

      {/* Main Conversation Stream */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <ConversationView
          messages={messages}
          isThinking={isThinking}
          onPlayMessageAudio={onPlayMessageAudio}
          playingMessageId={playingMessageId}
          onSelectSuggestion={onSendMessage}
        />
      </div>

      {/* Floating Quick Actions Popover Panel */}
      <AnimatePresence>
        {isQuickActionsOpen && (
          <>
            {/* Click Outside Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
              onClick={() => setIsQuickActionsOpen(false)}
            />

            {/* Compact Floating Menu Panel */}
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="absolute bottom-[76px] left-3 right-3 sm:left-auto sm:right-4 z-50 sm:w-80 p-3.5 bg-[#120712]/98 backdrop-blur-2xl border border-rose-800/50 rounded-2xl shadow-2xl shadow-black/90 space-y-2.5"
            >
              <div className="flex items-center justify-between pb-2 border-b border-rose-900/30">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-200">
                  <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                  <span>Quick Actions</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuickActionsOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                  title="Close Quick Actions"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {quickActions.map((act, idx) => {
                  const Icon = act.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        act.action();
                        setIsQuickActionsOpen(false);
                      }}
                      className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium text-zinc-200 hover:text-rose-100 bg-white/5 hover:bg-rose-900/40 border border-white/5 hover:border-rose-700/50 transition-all text-left truncate active:scale-95"
                    >
                      <Icon className="w-4 h-4 text-rose-400 shrink-0" />
                      <span className="truncate text-[11px]">{act.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Animated Sound Wave Visualizer Bar when listening or speaking */}
      {(isListening || isSpeaking) && (
        <div className="shrink-0 px-4 py-1.5 bg-rose-950/50 border-t border-rose-800/30 flex items-center justify-between text-xs text-rose-200">
          <span className="font-serif italic text-[11px]">
            {isListening ? "I'm listening to you, Mohsin..." : "Speaking in Maryam's voice..."}
          </span>
          <div className="flex items-center gap-1 h-3">
            {[...Array(8)].map((_, i) => (
              <span
                key={i}
                className="w-1 bg-rose-400 rounded-full animate-pulse"
                style={{
                  height: `${Math.max(20, Math.min(100, Math.sin(i + (audioLevel * 10)) * 100))}%`,
                  animationDelay: `${i * 100}ms`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bottom Composer Controls Bar */}
      <ControlsBar
        voiceState={voiceState}
        isMuted={isMuted}
        onToggleMic={onToggleMic}
        onToggleMute={onToggleMute}
        onBargeIn={onBargeIn}
        onSendMessage={onSendMessage}
        disabled={isThinking}
        wakeWordActive={wakeWordActive}
        wakeWordStatus={wakeWordStatus}
        enableWakeWord={enableWakeWord}
        wakePhrase={wakePhrase}
        onTriggerWakeWord={onTriggerWakeWord}
        isCameraActive={isCameraActive}
        onToggleCamera={onToggleCamera}
        onSelectImage={onSelectImage}
        isVideoCallActive={isVideoCallActive}
        onToggleVideoCall={onToggleVideoCall}
        onToggleQuickActions={() => setIsQuickActionsOpen((prev) => !prev)}
        isQuickActionsOpen={isQuickActionsOpen}
      />
    </div>
  );
};
