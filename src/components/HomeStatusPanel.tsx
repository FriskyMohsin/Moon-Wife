import React, { useState } from 'react';
import { ChatMessage, VoiceState, EmotionState, WakeWordStatus } from '../types';
import { Camera, Globe, Bookmark, Calendar, Compass, Sparkles, Heart, Mic, MicOff, Video, MessageSquare, ArrowRight, Volume2 } from 'lucide-react';
import { NavTab } from './NavigationSidebar';

interface HomeStatusPanelProps {
  latestMessage: ChatMessage | null; voiceState: VoiceState; emotion: EmotionState; audioLevel: number; isThinking: boolean; isMuted: boolean;
  onToggleMic: () => void; onToggleMute: () => void; onBargeIn: () => void; onSendMessage: (text: string) => void;
  onToggleCamera: () => void; isCameraActive: boolean; wakeWordActive: boolean; wakeWordStatus: WakeWordStatus; enableWakeWord: boolean;
  wakePhrase: string; onTriggerWakeWord: () => void; onOpenMemory: () => void; onOpenToolRunner: () => void; onSelectTab: (tab: NavTab) => void;
}

export const HomeStatusPanel: React.FC<HomeStatusPanelProps> = ({
  latestMessage, voiceState, audioLevel, isThinking, onToggleMic, onBargeIn, onSendMessage,
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
  const message = latestMessage?.sender === 'maryam' ? latestMessage.text : 'Always with you, in every step.';

  return <aside className="h-full rounded-[28px] border border-rose-200/15 bg-[linear-gradient(155deg,rgba(35,7,22,.92),rgba(8,5,11,.96)_58%,rgba(21,7,18,.93))] backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,.42)] p-5 sm:p-6 flex flex-col justify-between gap-4 overflow-y-auto">
    <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-[10px] tracking-[.14em] uppercase text-emerald-300"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Live companion</div><Heart className="w-4 h-4 text-rose-400 fill-rose-500/30" /></div>
    <div><p className="font-serif text-[11px] tracking-[.22em] uppercase text-rose-300/70">A quiet moment with</p><p className="mt-2 text-xl leading-relaxed text-rose-50 font-serif">“{message}”</p></div>
    <div className="rounded-2xl bg-black/25 border border-white/10 p-4 shadow-inner"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className={`w-2.5 h-2.5 rounded-full ${isListening ? 'bg-pink-400 animate-pulse' : isSpeaking ? 'bg-amber-300 animate-pulse' : isThinking || voiceState === 'Thinking' ? 'bg-violet-400 animate-pulse' : 'bg-rose-400'}`} /><p className="text-sm text-white">{state}</p></div><div className="flex items-center gap-1 h-6">{Array.from({ length: 6 }).map((_, i) => <span key={i} className={`w-1 rounded-full ${isListening || isSpeaking ? 'bg-rose-400' : 'bg-rose-950'}`} style={{ height: `${isListening || isSpeaking ? 30 + Math.abs(Math.sin(i + audioLevel * 8)) * 70 : 18}%` }} />)}</div></div><button type="button" onClick={onToggleMic} className={`mt-4 w-full rounded-xl py-3.5 text-xs font-semibold tracking-[.08em] uppercase flex items-center justify-center gap-2 transition-all ${isListening ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/40' : 'bg-gradient-to-r from-rose-800 to-[#7b183e] hover:from-rose-700 hover:to-[#97204d] text-white shadow-lg shadow-black/30'}`}>{isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}{isListening ? 'End conversation' : 'Speak with Maryam'}</button>{isSpeaking && <button type="button" onClick={onBargeIn} className="mt-2 w-full text-[11px] text-rose-300 hover:text-white">Interrupt Maryam</button>}</div>
    <div className="relative"><button type="button" onClick={() => setActionsOpen(v => !v)} className="w-full rounded-xl px-3.5 py-3 flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-rose-100 transition-colors"><span className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-rose-400" />Quick actions</span><span className="text-rose-300">{actionsOpen ? 'Close' : 'Open'}</span></button>{actionsOpen && <div className="absolute z-30 left-0 right-0 bottom-[calc(100%+8px)] rounded-2xl p-2 bg-[#1d0917]/95 border border-rose-400/25 shadow-2xl backdrop-blur-xl grid grid-cols-2 gap-1.5">{actions.map(({label, icon: Icon, action}) => <button key={label} type="button" onClick={() => { action(); setActionsOpen(false); }} className="p-2.5 rounded-xl text-left hover:bg-rose-900/40 text-[11px] text-zinc-200 flex items-center gap-2"><Icon className="w-3.5 h-3.5 text-rose-400" />{label}</button>)}</div>}</div>
    <div className="pt-3 border-t border-white/8 space-y-2"><button type="button" onClick={onTriggerWakeWord} className={`w-full flex items-center gap-2 text-left rounded-xl px-3 py-2.5 text-[11px] border transition-colors ${wakeWordActive ? 'text-rose-100 bg-rose-950/50 border-rose-500/20' : 'text-zinc-400 border-transparent hover:text-zinc-200 hover:bg-white/[.035]'}`}><Volume2 className="w-3.5 h-3.5 text-rose-400" />Wake phrase: <span className="text-rose-100">“{wakePhrase}”</span></button><div className="flex gap-2"><button type="button" onClick={onToggleCamera} className={`flex-1 rounded-xl px-3 py-3 text-xs border ${isCameraActive ? 'bg-rose-700 border-rose-400 text-white' : 'bg-white/[.045] border-white/10 text-zinc-200 hover:bg-white/10'}`}><Video className="inline w-3.5 h-3.5 mr-1.5 text-rose-300" />Camera</button><button type="button" onClick={() => onSelectTab('conversations')} className="flex-1 rounded-xl px-3 py-3 text-xs bg-white/[.045] hover:bg-white/10 border border-white/10 text-zinc-200"><MessageSquare className="inline w-3.5 h-3.5 mr-1.5 text-rose-300" />Chat <ArrowRight className="inline w-3 h-3" /></button></div></div>
  </aside>;
};
