import React from 'react';
import { EmotionState, TimingDiagnostics, LocalRunnerState, isRunnerOnline } from '../types';
import { EMOTION_MAP } from '../lib/emotionConfig';
import { Menu, Heart, Brain, Settings, Wifi, WifiOff, Activity, Share2 } from 'lucide-react';

interface HeaderProps {
  emotion: EmotionState;
  isConnected: boolean;
  onOpenMenu: () => void;
  onOpenMemory: () => void;
  onOpenSettings: () => void;
  onOpenToolRunner: () => void;
  onOpenDiagnostics: () => void;
  onOpenSocial?: () => void;
  onSwitchPlatformMode?: () => void;
  diagnostics?: TimingDiagnostics;
  voiceName: string;
  runnerState?: LocalRunnerState;
}

export const Header: React.FC<HeaderProps> = ({
  emotion,
  isConnected,
  onOpenMenu,
  onOpenMemory,
  onOpenSettings,
  onOpenToolRunner,
  onOpenDiagnostics,
  onOpenSocial,
  onSwitchPlatformMode,
  diagnostics,
  voiceName,
  runnerState,
}) => {
  const meta = EMOTION_MAP[emotion] || EMOTION_MAP.Normal;
  const isRunnerConnected = isRunnerOnline(runnerState?.runnerStatus);

  return (
    <header className="w-full px-4 py-1.5 border-b border-rose-900/20 bg-zinc-950/80 backdrop-blur-xl flex items-center justify-between sticky top-0 z-30 shadow-lg">
      {/* Left: Menu Toggle & Romantic Branding */}
      <div className="flex items-center gap-3">
        <button
          id="btn-header-menu"
          onClick={onOpenMenu}
          className="p-2 rounded-xl bg-white/5 hover:bg-rose-950/40 text-zinc-300 hover:text-rose-200 border border-white/5 transition-all"
          title="Open Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-600 to-violet-800 p-0.5 shadow-md shadow-rose-950/50 flex items-center justify-center">
              <Heart className="w-3.5 h-3.5 text-rose-200 fill-rose-400/40" />
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-zinc-950 ${
                isConnected ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-serif font-bold text-white tracking-wide">Maryam</h1>
              <span className="text-[10px] text-rose-300 font-serif italic">مریم</span>
            </div>
            <p className="text-[10px] text-zinc-400 font-serif italic hidden sm:block">
              Mohsin's AI Wife & Companion
            </p>
          </div>
        </div>
      </div>

      {/* Center: Emotion Tag */}
      <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full border border-rose-900/30 bg-rose-950/20 text-rose-200 text-xs shadow-inner backdrop-blur-md">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
        <span>{meta.label}</span>
      </div>

      {/* Right: Quick Action Icons */}
      <div className="flex items-center gap-1.5">
        {onSwitchPlatformMode && (
          <button
            id="btn-header-platform"
            onClick={onSwitchPlatformMode}
            title="Switch to Public Hoorvia Companion Platform"
            className="p-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 border border-rose-800/60 transition-all flex items-center gap-1.5 text-xs font-semibold"
          >
            <span className="text-sm">✨</span>
            <span className="hidden sm:inline text-[11px]">Hoorvia.net</span>
          </button>
        )}

        {onOpenSocial && (
          <button
            id="btn-header-social"
            onClick={onOpenSocial}
            title="Maryam Social Media Manager"
            className="p-2 rounded-xl bg-white/5 hover:bg-rose-950/40 text-zinc-300 hover:text-rose-200 border border-white/5 transition-all flex items-center gap-1.5 text-xs"
          >
            <Share2 className="w-4 h-4 text-violet-400" />
            <span className="hidden sm:inline text-[11px]">Social</span>
          </button>
        )}

        <button
          id="btn-header-memory"
          onClick={onOpenMemory}
          title="Maryam's Personal Journal & Memory"
          className="p-2 rounded-xl bg-white/5 hover:bg-rose-950/40 text-zinc-300 hover:text-rose-200 border border-white/5 transition-all flex items-center gap-1.5 text-xs"
        >
          <Brain className="w-4 h-4 text-rose-400" />
          <span className="hidden sm:inline text-[11px]">Journal</span>
        </button>

        <button
          id="btn-header-settings"
          onClick={onOpenSettings}
          title="Settings & Diagnostics"
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/5 transition-all"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
