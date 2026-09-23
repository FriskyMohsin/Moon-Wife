import React from 'react';
import {
  Home,
  MessageSquare,
  Brain,
  Calendar,
  Clock,
  Compass,
  Settings,
  Activity,
  X,
  Bot,
  Shield,
  Share2,
  PlusCircle,
  CalendarClock,
  Radio,
} from 'lucide-react';

export type NavTab =
  | 'home'
  | 'conversations'
  | 'create_task'
  | 'scheduled_tasks'
  | 'connectivity'
  | 'memories'
  | 'reminders'
  | 'routines'
  | 'tools'
  | 'settings'
  | 'social';

interface NavigationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenMemory: () => void;
  onOpenSettings: () => void;
  onOpenToolRunner: () => void;
  onOpenDiagnostics: () => void;
  onOpenSocial?: () => void;
  onOpenOwnerAdmin?: () => void;
  isConnected: boolean;
  runnerConnected: boolean;
  omniRouteAvailable: boolean;
}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  onOpenMemory,
  onOpenSettings,
  onOpenToolRunner,
  onOpenDiagnostics,
  onOpenSocial,
  onOpenOwnerAdmin,
  isConnected,
  runnerConnected,
  omniRouteAvailable,
}) => {
  if (!isOpen) return null;

  const navItems: { id: NavTab; label: string; icon: React.FC<{ className?: string }>; action?: () => void }[] = [
    { id: 'home', label: 'Home', icon: Home, action: () => onSelectTab('home') },
    { id: 'conversations', label: 'Conversations', icon: MessageSquare, action: () => onSelectTab('conversations') },
    { id: 'create_task', label: 'Create Task', icon: PlusCircle, action: () => onSelectTab('create_task') },
    { id: 'scheduled_tasks', label: 'Scheduled Tasks', icon: CalendarClock, action: () => onSelectTab('scheduled_tasks') },
    { id: 'connectivity', label: 'Connectivity', icon: Radio, action: () => onSelectTab('connectivity') },
    { id: 'social', label: 'Social Media Manager', icon: Share2, action: onOpenSocial },
    { id: 'memories', label: 'Memories & Journal', icon: Brain, action: onOpenMemory },
    { id: 'reminders', label: 'Reminders & Commitments', icon: Calendar, action: () => onSelectTab('reminders') },
    { id: 'routines', label: 'Routines & Daily Care', icon: Clock, action: () => onSelectTab('routines') },
    { id: 'tools', label: 'Local Tools & OmniRoute', icon: Compass, action: onOpenToolRunner },
    { id: 'settings', label: 'Settings & Diagnostics', icon: Settings, action: onOpenSettings },
  ];

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Slide-out Sidebar Panel */}
      <div className="relative w-80 max-w-[85vw] h-full bg-zinc-950/95 border-r border-rose-900/30 p-5 flex flex-col justify-between shadow-2xl z-10 text-zinc-100 backdrop-blur-xl">
        {/* Top Branding & Close */}
        <div>
          <div className="flex items-center justify-between pb-5 border-b border-rose-900/20 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-rose-600 to-violet-800 p-0.5 shadow-lg shadow-rose-950/50 flex items-center justify-center">
                <Bot className="w-4.5 h-4.5 text-rose-100" />
              </div>
              <div>
                <h2 className="text-base font-serif font-bold text-white tracking-wide">Maryam</h2>
                <p className="text-[10px] text-rose-300 font-serif italic">Mohsin's AI Wife & Companion</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.action) item.action();
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-rose-950/60 border border-rose-800/50 text-rose-200 shadow-md'
                      : 'text-zinc-300 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-rose-400' : 'text-zinc-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {onOpenOwnerAdmin && (
              <button
                onClick={() => {
                  onOpenOwnerAdmin();
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-semibold bg-gradient-to-r from-rose-950/80 to-purple-950/80 border border-rose-600/50 text-rose-200 hover:text-white hover:border-rose-400 shadow-md shadow-rose-950/50 transition-all mt-2 group"
              >
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
                  <span>Owner Admin Control</span>
                </div>
                <span className="px-2 py-0.5 text-[9px] font-bold rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Platform
                </span>
              </button>
            )}
          </nav>
        </div>

        {/* Bottom Section: System Status & Diagnostics Shortcut */}
        <div className="pt-4 border-t border-rose-900/20 space-y-3">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 px-3 py-2 bg-black/40 rounded-xl border border-white/5">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>Gemini Voice: {isConnected ? 'Live' : 'Standby'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${runnerConnected ? 'bg-indigo-400' : 'bg-zinc-600'}`} />
              <span>Runner</span>
            </div>
          </div>

          <button
            onClick={() => {
              onOpenDiagnostics();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-rose-950/40 border border-white/5 hover:border-rose-900/30 text-xs text-zinc-300 hover:text-rose-200 transition-all"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Developer / Diagnostics</span>
          </button>
        </div>
      </div>
    </div>
  );
};
