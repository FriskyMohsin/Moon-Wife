import React, { useState } from 'react';
import { ChatMessage, VoiceState, EmotionState, WakeWordStatus } from '../types';
import { Camera, Globe, Bookmark, Calendar, Compass, Sparkles, Mic, MicOff, Video, MessageSquare, ArrowRight, Volume2, Bot } from 'lucide-react';
import { NavTab } from './NavigationSidebar';

interface HomeStatusPanelProps {
  latestMessage: ChatMessage | null;
  voiceState: VoiceState;
  emotion: EmotionState;
  audioLevel: number;
  isThinking: boolean;
  isMuted: boolean;
  onToggleMic: () => void;
  onToggleMute: () => void;
  onBargeIn: () => void;
  onSendMessage: (text: string) => void;
  onToggleCamera: () => void;
  isCameraActive: boolean;
  wakeWordActive: boolean;
  wakeWordStatus: WakeWordStatus;
  enableWakeWord: boolean;
  wakePhrase: string;
  onTriggerWakeWord: () => void;
  onOpenMemory: () => void;
  onOpenToolRunner: () => void;
  onSelectTab: (tab: NavTab) => void;
}

export const HomeStatusPanel: React.FC<HomeStatusPanelProps> = ({
  voiceState, audioLevel, isThinking, onToggleMic, onBargeIn, onSendMessage,
  onToggleCamera, isCameraActive, wakeWordActive, wakePhrase, onTriggerWakeWord, onOpenMemory, onOpenToolRunner, onSelectTab,
}) => {
  const [actionsOpen, setActionsOpen] = useState(false);
  const isListening = voiceState === 'Listening';
  const isSpeaking = voiceState === 'Speaking';
  const state = isListening ? 'Listening' : isSpeaking ? 'Speaking' : isThinking || voiceState === 'Thinking' ? 'Thinking' : 'Idle';
  const actions = [
    { label: 'Take a photo', icon: Camera, action: onToggleCamera },
    { label: 'Browse for me', icon: Globe, action: () => onSendMessage('Maryam, please search the web for the latest tech news today.') },
    { label: 'Remember this', icon: Bookmark, action: onOpenMemory },
    { label: 'Set a reminder', icon: Calendar, action: () => onSelectTab('reminders') },
    { label: 'Run a tool', icon: Compass, action: onOpenToolRunner },
    { label: "Let's talk", icon: Sparkles, action: () => onSelectTab('conversations') },
  ];

  return (
    <aside className="h-full rounded-[28px] border border-rose-200/15 bg-[linear-gradient(155deg,rgba(35,7,22,.92),rgba(8,5,11,.96)_58%,rgba(21,7,18,.93))] backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,.42)] p-5 sm:p-6 flex flex-col justify-between gap-4 overflow-y-auto">
      {/* Top Header with AI Companion Avatar Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] tracking-[.14em] uppercase text-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live companion
        </div>
        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-rose-600 to-purple-800 p-0.5 flex items-center justify-center shadow-sm shadow-rose-950/60" title="Maryam AI Companion">
          <div className="w-full h-full rounded-full bg-black/60 flex items-center justify-center">
            <Bot className="w-3 h-3 text-rose-200" />
          </div>
        </div>
      </div>

      {/* Minimal Animated Maryam Presence Visual Area */}
      <div className="py-4 px-3 rounded-2xl bg-gradient-to-b from-rose-950/30 to-black/40 border border-rose-900/30 backdrop-blur-md flex flex-col items-center justify-center text-center relative overflow-hidden">
        <div className="relative mb-2.5 flex items-center justify-center">
          <div className={`w-12 h-12 rounded-full bg-gradient-to-tr from-rose-800/60 via-pink-900/40 to-purple-900/60 border border-rose-400/30 p-1 flex items-center justify-center shadow-lg shadow-rose-950/60 transition-transform ${isSpeaking || isListening ? 'scale-105' : ''}`}>
            <div className="w-full h-full rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center relative">
              <span className={`w-2.5 h-2.5 rounded-full ${isListening ? 'bg-pink-400 shadow-md shadow-pink-400/80 animate-ping' : isSpeaking ? 'bg-amber-300 shadow-md shadow-amber-300/80 animate-pulse' : isThinking || voiceState === 'Thinking' ? 'bg-violet-400 animate-spin' : 'bg-rose-400 shadow-sm shadow-rose-400/50'}`} />
              <div className="absolute inset-0 rounded-full border border-rose-400/20 animate-pulse" />
            </div>
          </div>
          <div className={`absolute -inset-1 rounded-full border border-rose-500/20 ${isListening || isSpeaking ? 'animate-ping' : 'animate-pulse'}`} />
        </div>

        <div className="space-y-0.5 relative z-10">
          <div className="flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            <p className="text-xs font-semibold text-rose-100 tracking-wide">Maryam Presence</p>
          </div>
          <p className="text-[10px] text-rose-300/70 font-serif italic">
            {isListening ? 'Listening attentively...' : isSpeaking ? 'Speaking...' : isThinking || voiceState === 'Thinking' ? 'Reflecting...' : 'Attentive & Connected'}
          </p>
        </div>
      </div>

      {/* Voice & Controls */}
      <div className="rounded-2xl bg-black/25 border border-white/10 p-4 shadow-inner">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full ${isListening ? 'bg-pink-400 animate-pulse' : isSpeaking ? 'bg-amber-300 animate-pulse' : isThinking || voiceState === 'Thinking' ? 'bg-violet-400 animate-pulse' : 'bg-rose-400'}`} />
            <p className="text-sm text-white">{state}</p>
          </div>
          <div className="flex items-center gap-1 h-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className={`w-1 rounded-full ${isListening || isSpeaking ? 'bg-rose-400' : 'bg-rose-950'}`}
                style={{ height: `${isListening || isSpeaking ? 30 + Math.abs(Math.sin(i + audioLevel * 8)) * 70 : 18}%` }}
              />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleMic}
          className={`mt-4 w-full rounded-xl py-3.5 text-xs font-semibold tracking-[.08em] uppercase flex items-center justify-center gap-2 transition-all ${isListening ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/40' : 'bg-gradient-to-r from-rose-800 to-[#7b183e] hover:from-rose-700 hover:to-[#97204d] text-white shadow-lg shadow-black/30'}`}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          {isListening ? 'End conversation' : 'Speak with Maryam'}
        </button>
        {isSpeaking && (
          <button type="button" onClick={onBargeIn} className="mt-2 w-full text-[11px] text-rose-300 hover:text-white">
            Interrupt Maryam
          </button>
        )}
      </div>

      {/* Quick Actions Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setActionsOpen(v => !v)}
          className="w-full rounded-xl px-3.5 py-3 flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-rose-100 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-rose-400" />
            Quick actions
          </span>
          <span className="text-rose-300">{actionsOpen ? 'Close' : 'Open'}</span>
        </button>
        {actionsOpen && (
          <div className="absolute z-30 left-0 right-0 bottom-[calc(100%+8px)] rounded-2xl p-2 bg-[#1d0917]/95 border border-rose-400/25 shadow-2xl backdrop-blur-xl grid grid-cols-2 gap-1.5">
            {actions.map(({ label, icon: Icon, action }) => (
              <button
                key={label}
                type="button"
                onClick={() => { action(); setActionsOpen(false); }}
                className="p-2.5 rounded-xl text-left hover:bg-rose-900/40 text-[11px] text-zinc-200 flex items-center gap-2"
              >
                <Icon className="w-3.5 h-3.5 text-rose-400" />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Shortcuts */}
      <div className="pt-3 border-t border-white/8 space-y-2">
        <button
          type="button"
          onClick={onTriggerWakeWord}
          className={`w-full flex items-center gap-2 text-left rounded-xl px-3 py-2.5 text-[11px] border transition-colors ${wakeWordActive ? 'text-rose-100 bg-rose-950/50 border-rose-500/20' : 'text-zinc-400 border-transparent hover:text-zinc-200 hover:bg-white/[.035]'}`}
        >
          <Volume2 className="w-3.5 h-3.5 text-rose-400" />
          Wake phrase: <span className="text-rose-100">“{wakePhrase}”</span>
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onToggleCamera}
            className={`flex-1 rounded-xl px-3 py-3 text-xs border ${isCameraActive ? 'bg-rose-700 border-rose-400 text-white' : 'bg-white/[.045] border-white/10 text-zinc-200 hover:bg-white/10'}`}
          >
            <Video className="inline w-3.5 h-3.5 mr-1.5 text-rose-300" />
            Camera
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('conversations')}
            className="flex-1 rounded-xl px-3 py-3 text-xs bg-white/[.045] hover:bg-white/10 border border-white/10 text-zinc-200"
          >
            <MessageSquare className="inline w-3.5 h-3.5 mr-1.5 text-rose-300" />
            Chat <ArrowRight className="inline w-3 h-3" />
          </button>
        </div>
      </div>
    </aside>
  );
};
