import React, { useState, useEffect } from 'react';
import { ChatMessage, VoiceState, WakeWordStatus } from '../../types';
import { ConversationView } from '../ConversationView';
import { Camera, Globe, Bookmark, Calendar, Compass, Sparkles, Heart, X, ChevronRight, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CollapsibleConversationPanelProps {
  messages: ChatMessage[];
  isThinking: boolean;
  voiceState: VoiceState;
  audioLevel: number;
  playingMessageId: string | null;
  isGuestMode?: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
  onEndGuestMode?: () => void;
  onPlayMessageAudio: (msg: ChatMessage) => void;
  onSendMessage: (text: string) => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onOpenMemory: () => void;
  onOpenToolRunner: () => void;
  onSelectTab: (tab: string) => void;
}

export const CollapsibleConversationPanel: React.FC<CollapsibleConversationPanelProps> = ({
  messages,
  isThinking,
  voiceState,
  audioLevel,
  playingMessageId,
  isGuestMode,
  isOpen,
  onToggleOpen,
  onEndGuestMode,
  onPlayMessageAudio,
  onSendMessage,
  onToggleMic,
  onToggleCamera,
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

  if (!isOpen) {
    return (
      <div className="shrink-0 h-full flex flex-col items-center justify-between py-4 px-1.5 bg-[#0a0409]/95 backdrop-blur-xl border-l border-rose-900/30 select-none z-30">
        <button
          onClick={onToggleOpen}
          className="p-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition-all flex flex-col items-center gap-1.5 shadow-lg"
          title="Open Conversation Panel"
        >
          <MessageSquare className="w-4 h-4" />
          <span className="text-[9px] font-mono [writing-mode:vertical-lr] tracking-widest uppercase">Chat</span>
        </button>

        {/* Unread / Total Messages Counter */}
        <div className="flex flex-col items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
          <span className="text-[10px] font-mono text-zinc-400">{messages.length}</span>
        </div>
      </div>
    );
  }

  return (
    <aside className="w-80 lg:w-96 xl:w-[420px] shrink-0 h-full min-h-0 flex flex-col justify-between bg-[#0a0409]/95 backdrop-blur-xl border-l border-rose-900/30 overflow-hidden shadow-2xl relative z-30 transition-all duration-300">
      {/* Top Header Bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-rose-900/25 bg-[#0f060d]/80 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
          <span className="font-medium text-emerald-300 text-[11px]">Conversation Continuity Active</span>
        </div>

        <div className="flex items-center gap-1.5 text-rose-200/90 font-serif italic text-xs">
          <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400/50" />
          <span>With You Always</span>
        </div>

        <button
          onClick={onToggleOpen}
          className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Collapse Panel"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Guest Mode Active Banner */}
      {isGuestMode && (
        <div className="shrink-0 px-3.5 py-1.5 bg-amber-950/60 border-b border-amber-800/40 text-amber-200 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="font-semibold text-[11px] text-amber-100">Guest Mode</span>
          </div>
          {onEndGuestMode && (
            <button
              onClick={onEndGuestMode}
              className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium text-[10px] transition-all"
            >
              End
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

      {/* Floating Quick Actions Popover */}
      <AnimatePresence>
        {isQuickActionsOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
              onClick={() => setIsQuickActionsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="absolute bottom-16 left-3 right-3 z-50 p-3 bg-[#120712]/98 backdrop-blur-2xl border border-rose-800/50 rounded-2xl shadow-2xl space-y-2"
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-rose-900/30">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-200">
                  <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                  <span>Quick Actions</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuickActionsOpen(false)}
                  className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
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
                      className="flex items-center gap-2 p-2 rounded-xl text-xs font-medium text-zinc-200 hover:text-rose-100 bg-white/5 hover:bg-rose-900/40 border border-white/5 hover:border-rose-700/50 transition-all text-left truncate active:scale-95"
                    >
                      <Icon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span className="truncate text-[11px]">{act.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Animated Sound Wave Bar when listening/speaking */}
      {(isListening || isSpeaking) && (
        <div className="shrink-0 px-4 py-1.5 bg-rose-950/50 border-t border-rose-800/30 flex items-center justify-between text-xs text-rose-200">
          <span className="font-serif italic text-[11px]">
            {isListening ? "Listening to Mohsin's voice..." : "Speaking in Maryam's voice..."}
          </span>
          <div className="flex items-center gap-1 h-3">
            {[...Array(8)].map((_, i) => (
              <span
                key={i}
                className="w-1 bg-rose-400 rounded-full animate-pulse"
                style={{
                  height: `${Math.max(20, Math.min(100, Math.sin(i + audioLevel * 10) * 100))}%`,
                  animationDelay: `${i * 100}ms`,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
