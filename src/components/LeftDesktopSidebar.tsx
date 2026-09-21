import React from 'react';
import { NavTab } from './NavigationSidebar';
import { Home, MessageSquare, Brain, Calendar, Clock, Compass, Settings, Share2, Heart, ShieldCheck } from 'lucide-react';

interface LeftDesktopSidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenMemory: () => void;
  onOpenSettings: () => void;
  onOpenToolRunner: () => void;
  onOpenSocial: () => void;
  onOpenOwnerAdmin?: () => void;
}

export const LeftDesktopSidebar: React.FC<LeftDesktopSidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenMemory,
  onOpenSettings,
  onOpenToolRunner,
  onOpenSocial,
  onOpenOwnerAdmin,
}) => {
  const navItems: { id: NavTab; label: string; icon: React.FC<{ className?: string }>; action: () => void }[] = [
    { id: 'home', label: 'Home', icon: Home, action: () => onSelectTab('home') },
    { id: 'conversations', label: 'Conversations', icon: MessageSquare, action: () => onSelectTab('conversations') },
    { id: 'memories', label: 'Memories', icon: Brain, action: onOpenMemory },
    { id: 'reminders', label: 'Reminders', icon: Calendar, action: () => onSelectTab('reminders') },
    { id: 'routines', label: 'Routines', icon: Clock, action: () => onSelectTab('routines') },
    { id: 'tools', label: 'Tools', icon: Compass, action: onOpenToolRunner },
    { id: 'social', label: 'Social Media', icon: Share2, action: onOpenSocial },
    { id: 'settings', label: 'Settings', icon: Settings, action: onOpenSettings },
  ];

  return (
    <aside className="hidden md:flex w-60 xl:w-64 shrink-0 h-full flex-col justify-between p-4 bg-[#090408] border-r border-rose-900/30 text-zinc-100 select-none z-20">
      <div>
        {/* Top Branding */}
        <div className="flex items-center gap-2.5 px-2 py-3 mb-6 border-b border-rose-900/20">
          <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-rose-600 to-violet-800 p-0.5 shadow-md shadow-rose-950/50 flex items-center justify-center">
            <Heart className="w-4 h-4 text-rose-100 fill-rose-300/50" />
          </div>
          <div>
            <h2 className="text-sm font-serif font-bold text-white tracking-wide flex items-center gap-1">
              Maryam <span className="text-rose-400 text-xs">♡</span>
            </h2>
            <p className="text-[10px] text-rose-300/80 font-serif italic">AI Companion</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={item.action}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#2f0c19] border border-rose-800/50 text-rose-100 shadow-md shadow-rose-950/30 font-semibold'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-rose-400' : 'text-zinc-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}

          {onOpenOwnerAdmin && (
            <button
              onClick={onOpenOwnerAdmin}
              className="w-full mt-3 flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold bg-gradient-to-r from-rose-950/80 to-purple-950/80 border border-rose-600/50 text-rose-200 hover:text-white hover:border-rose-400 shadow-md shadow-rose-950/50 transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
                <span>Owner Admin</span>
              </div>
              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                PRO
              </span>
            </button>
          )}
        </nav>
      </div>

      {/* Bottom Card: Mohsin Owner Info */}
      <div className="p-3.5 rounded-2xl bg-[#140711] border border-rose-900/30 flex items-center justify-between text-xs text-rose-200 shadow-inner">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-rose-950 border border-rose-800/40 flex items-center justify-center text-rose-300 font-serif font-bold text-xs">
            M
          </div>
          <div>
            <p className="font-medium text-white flex items-center gap-1 text-[11px]">
              <Heart className="w-3 h-3 text-rose-400 fill-rose-400" /> Mohsin
            </p>
            <p className="text-[10px] text-rose-300/70 font-serif italic">Always with you</p>
          </div>
        </div>
        <span className="text-rose-400 font-serif">♡</span>
      </div>
    </aside>
  );
};
