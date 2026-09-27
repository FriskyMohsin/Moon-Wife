import React, { useState, useEffect } from 'react';
import {
  Heart,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Minus,
  Square,
  X,
  Radio,
  Cpu,
  ShieldCheck,
  User,
  Sparkles,
  Video,
  LogOut,
} from 'lucide-react';
import { EmotionState, VoiceState } from '../../types';

interface DesktopHeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  isConversationOpen: boolean;
  onToggleConversation: () => void;
  isConnected: boolean;
  voiceState: VoiceState;
  emotion: EmotionState;
  isOwner?: boolean;
  isGuestMode?: boolean;
  isVideoCallActive?: boolean;
  runnerConnected?: boolean;
  platformMode?: string;
  onSwitchPlatformMode?: (mode?: any) => void;
  onOpenSettings?: () => void;
  onSignOut?: () => void;
}

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({
  isSidebarOpen,
  onToggleSidebar,
  isConversationOpen,
  onToggleConversation,
  isConnected,
  voiceState,
  emotion,
  isOwner = true,
  isGuestMode = false,
  isVideoCallActive = false,
  runnerConnected = false,
  platformMode = 'owner',
  onSwitchPlatformMode,
  onOpenSettings,
  onSignOut,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Check if running in Electron environment
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      setIsElectron(true);
      const api = (window as any).electronAPI;
      if (api.onMaximizedChange) {
        api.onMaximizedChange((maximized: boolean) => setIsMaximized(maximized));
      }
    }
  }, []);

  const handleMinimize = () => {
    if ((window as any).electronAPI?.minimize) {
      (window as any).electronAPI.minimize();
    }
  };

  const handleMaximize = () => {
    if ((window as any).electronAPI?.maximize) {
      (window as any).electronAPI.maximize();
    }
  };

  const handleClose = () => {
    if ((window as any).electronAPI?.close) {
      (window as any).electronAPI.close();
    }
  };

  return (
    <header className="shrink-0 h-11 w-full bg-[#0a030b]/95 backdrop-blur-xl border-b border-rose-900/30 flex items-center justify-between px-3 select-none z-50">
      {/* Left Region: Navigation Toggle & Maryam Companion Title */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg text-rose-300/80 hover:text-white hover:bg-rose-950/60 border border-transparent hover:border-rose-800/40 transition-all"
          title={isSidebarOpen ? 'Collapse Navigation Sidebar' : 'Expand Navigation Sidebar'}
        >
          {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </button>

        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-rose-600 to-violet-700 flex items-center justify-center shadow-sm shadow-rose-600/40">
            <Heart className="w-3.5 h-3.5 text-white fill-white/80" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-serif italic font-bold text-sm bg-gradient-to-r from-rose-200 via-pink-100 to-rose-300 bg-clip-text text-transparent">
              Maryam
            </span>
          </div>
        </div>
      </div>

      {/* Center Drag Region & Live Status Chips (Electron Drag Area) */}
      <div
        className="flex-1 h-full flex items-center justify-center gap-2 px-4 cursor-default"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        {/* Heartbeat Status */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 border border-rose-900/30 text-[11px]">
          <span
            className={`w-2 h-2 rounded-full ${
              !isConnected
                ? 'bg-amber-500 animate-ping'
                : voiceState === 'Speaking'
                ? 'bg-rose-400 animate-ping'
                : voiceState === 'Listening'
                ? 'bg-emerald-400 animate-pulse'
                : voiceState === 'Thinking'
                ? 'bg-violet-400 animate-spin'
                : 'bg-emerald-400'
            }`}
          />
          <span className="text-zinc-300 font-medium">
            {!isConnected ? 'Reconnecting' : voiceState === 'Speaking' ? 'Speaking' : voiceState === 'Listening' ? 'Listening' : 'Live Presence'}
          </span>
        </div>

        {/* Emotion Indicator */}
        <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-950/40 border border-rose-800/30 text-[11px] text-rose-300 font-mono">
          <Sparkles className="w-3 h-3 text-rose-400" />
          <span>{emotion || 'Love'}</span>
        </div>

        {/* Video Call Active Pill */}
        {isVideoCallActive && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-900/60 border border-rose-500/50 text-[11px] text-rose-100 animate-pulse">
            <Video className="w-3 h-3 text-rose-300" />
            <span className="font-semibold">Live Video Call</span>
          </div>
        )}

        {/* Local OmniRoute Node Status */}
        {runnerConnected && (
          <div className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/50 border border-emerald-800/30 text-[10px] text-emerald-300 font-mono">
            <Cpu className="w-3 h-3" />
            <span>Local Node</span>
          </div>
        )}
      </div>

      {/* Right Region: Platform Switcher, Chat Toggle & Window Controls */}
      <div className="flex items-center gap-1.5">
        {/* Owner / Guest Mode Switcher */}
        {isOwner && onSwitchPlatformMode && (
          <div className="flex items-center bg-zinc-900/80 rounded-lg p-0.5 border border-rose-900/30 text-[10px]">
            <button
              onClick={() => onSwitchPlatformMode('owner')}
              className={`px-2 py-0.5 rounded-md font-medium transition-all flex items-center gap-1 ${
                platformMode === 'owner'
                  ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Mohsin (Owner) Mode"
            >
              <ShieldCheck className="w-3 h-3" />
              <span className="hidden lg:inline">Mohsin</span>
            </button>
            <button
              onClick={() => onSwitchPlatformMode('public')}
              className={`px-2 py-0.5 rounded-md font-medium transition-all flex items-center gap-1 ${
                platformMode === 'public'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Public / Guest Assistant Mode"
            >
              <User className="w-3 h-3" />
              <span className="hidden lg:inline">Guest</span>
            </button>
          </div>
        )}

        {/* Conversation Panel Toggle */}
        <button
          onClick={onToggleConversation}
          className="p-1.5 rounded-lg text-rose-300/80 hover:text-white hover:bg-rose-950/60 border border-transparent hover:border-rose-800/40 transition-all"
          title={isConversationOpen ? 'Collapse Conversation Panel' : 'Expand Conversation Panel'}
        >
          {isConversationOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
        </button>

        {/* Owner Sign Out (revokes server session, returns to public) */}
        {isOwner && onSignOut && (
          <button
            onClick={onSignOut}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-zinc-400 hover:text-white hover:bg-rose-950/60 border border-transparent hover:border-rose-800/40 transition-all text-[10px] font-medium"
            title="Sign Out (end owner session)"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Sign Out</span>
          </button>
        )}

        {/* Electron Native Window Controls (Minimize, Maximize, Close) */}
        {isElectron && (
          <div className="flex items-center ml-2 pl-2 border-l border-rose-900/30 gap-0.5">
            <button
              onClick={handleMinimize}
              className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              title="Minimize Window"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleMaximize}
              className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              title={isMaximized ? 'Restore Window' : 'Maximize Window'}
            >
              <Square className="w-3 h-3" />
            </button>
            <button
              onClick={handleClose}
              className="p-1.5 rounded hover:bg-rose-600 text-zinc-400 hover:text-white transition-colors"
              title="Close Application"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
