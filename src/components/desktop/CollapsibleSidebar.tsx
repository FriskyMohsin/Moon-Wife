import React from 'react';
import { NavTab } from '../NavigationSidebar';
import {
  Home,
  MessageSquare,
  Brain,
  Calendar,
  Clock,
  Compass,
  Settings,
  Share2,
  Bot,
  Sparkles,
  Heart,
  ShieldCheck,
  PlusCircle,
  CalendarClock,
  Radio,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface CollapsibleSidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenMemory: () => void;
  onOpenSettings: () => void;
  onOpenToolRunner: () => void;
  onOpenSocial: () => void;
  onOpenOwnerAdmin?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenMemory,
  onOpenSettings,
  onOpenToolRunner,
  onOpenSocial,
  onOpenOwnerAdmin,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const navItems: { id: NavTab; label: string; icon: React.FC<{ className?: string }>; action: () => void }[] = [
    { id: 'home', label: 'Home', icon: Home, action: () => onSelectTab('home') },
    { id: 'conversations', label: 'Conversations', icon: MessageSquare, action: () => onSelectTab('conversations') },
    { id: 'create_task', label: 'Create Task', icon: PlusCircle, action: () => onSelectTab('create_task') },
    { id: 'scheduled_tasks', label: 'Scheduled Tasks', icon: CalendarClock, action: () => onSelectTab('scheduled_tasks') },
    { id: 'connectivity', label: 'Connectivity', icon: Radio, action: () => onSelectTab('connectivity') },
    { id: 'memories', label: 'Memories', icon: Brain, action: onOpenMemory },
    { id: 'reminders', label: 'Reminders', icon: Calendar, action: () => onSelectTab('reminders') },
    { id: 'routines', label: 'Routines', icon: Clock, action: () => onSelectTab('routines') },
    { id: 'tools', label: 'Tools', icon: Compass, action: onOpenToolRunner },
    { id: 'social', label: 'Social Media', icon: Share2, action: onOpenSocial },
    { id: 'settings', label: 'Settings', icon: Settings, action: onOpenSettings },
  ];

  return (
    <aside
      className={`shrink-0 h-full min-h-0 flex flex-col justify-between bg-[#080208]/95 backdrop-blur-xl border-r border-rose-900/30 text-zinc-100 select-none z-30 transition-all duration-300 ${
        isCollapsed ? 'w-16 p-2' : 'w-60 xl:w-64 p-3.5'
      }`}
    >
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Header / Collapse Toggle */}
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-rose-900/20 shrink-0">
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-600 to-violet-800 p-0.5 shadow-md shadow-rose-950/50 flex items-center justify-center">
                <Bot className="w-4 h-4 text-rose-100" />
              </div>
              <div>
                <h2 className="text-sm font-serif font-bold text-white tracking-wide flex items-center gap-1.5">
                  Maryam
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-950/80 border border-rose-500/40 text-[9px] text-rose-300">
                    <Sparkles className="w-2.5 h-2.5 text-rose-300" />
                  </span>
                </h2>
                <p className="text-[10px] text-rose-300/80 font-serif italic">AI Companion</p>
              </div>
            </div>
          ) : (
            <div className="mx-auto w-8 h-8 rounded-full bg-gradient-to-tr from-rose-600 to-violet-800 flex items-center justify-center shadow-md">
              <Bot className="w-4 h-4 text-rose-100" />
            </div>
          )}

          {onToggleCollapse && !isCollapsed && (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-rose-950/50 transition-colors"
              title="Collapse to icons"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Scrollable Navigation Items */}
        <nav className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={item.action}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'
                } rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-rose-950/70 border border-rose-700/50 text-rose-100 shadow-md shadow-rose-950/40 font-semibold'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-rose-400' : 'text-zinc-500'}`} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}

          {onOpenOwnerAdmin && (
            <button
              onClick={onOpenOwnerAdmin}
              title={isCollapsed ? 'Owner Admin' : undefined}
              className={`w-full mt-2 flex items-center ${
                isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
              } rounded-xl text-xs font-semibold bg-gradient-to-r from-rose-950/90 to-purple-950/90 border border-rose-600/50 text-rose-200 hover:text-white hover:border-rose-400 shadow-md transition-all group shrink-0`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform shrink-0" />
                {!isCollapsed && <span>Owner Admin</span>}
              </div>
              {!isCollapsed && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  PRO
                </span>
              )}
            </button>
          )}
        </nav>
      </div>

      {/* Expand trigger when collapsed */}
      {isCollapsed && onToggleCollapse && (
        <div className="pt-2 border-t border-rose-900/20 flex justify-center">
          <button
            onClick={onToggleCollapse}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-rose-950/50 transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bottom Profile Info */}
      {!isCollapsed && (
        <div className="p-2.5 rounded-xl bg-[#140711] border border-rose-900/30 flex items-center justify-between text-xs text-rose-200 shadow-inner shrink-0 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-rose-950 border border-rose-800/40 flex items-center justify-center text-rose-300 font-serif font-bold text-xs">
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
      )}
    </aside>
  );
};
