import React, { useState } from 'react';
import { NavTab } from '../NavigationSidebar';
import {
  ChatMessage,
  VoiceState,
  EmotionState,
  WakeWordStatus,
  PlatformMode,
} from '../../types';
import { DesktopHeader } from './DesktopHeader';
import { CollapsibleSidebar } from './CollapsibleSidebar';
import { CollapsibleConversationPanel } from './CollapsibleConversationPanel';
import { FloatingControlsBar } from './FloatingControlsBar';
import { AvatarStage } from '../../avatar/AvatarStage';

interface DesktopShellProps {
  // Navigation & Tabs
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenMemory: () => void;
  onOpenSettings: () => void;
  onOpenToolRunner: () => void;
  onOpenSocial: () => void;
  onOpenOwnerAdmin?: () => void;

  // Real-time Conversation & Voice State
  messages: ChatMessage[];
  isThinking: boolean;
  voiceState: VoiceState;
  audioLevel: number;
  emotion: EmotionState;
  isConnected: boolean;
  isMuted: boolean;
  playingMessageId: string | null;
  isGuestMode?: boolean;
  onEndGuestMode?: () => void;
  onPlayMessageAudio: (msg: ChatMessage) => void;
  onSendMessage: (text: string) => void;
  onToggleMic: () => void;
  onToggleMute: () => void;
  onBargeIn: () => void;

  // Vision & Camera
  isCameraActive: boolean;
  onToggleCamera: () => void;
  onSelectImage?: (file: File) => void;
  isVideoCallActive?: boolean;
  onToggleVideoCall?: () => void;
  onSnapPhoto?: () => void;
  onSwitchCamera?: () => void;

  // Wake Word
  wakeWordActive: boolean;
  wakeWordStatus: WakeWordStatus;
  enableWakeWord: boolean;
  wakePhrase: string;
  onTriggerWakeWord: () => void;

  // Node & Platform
  runnerConnected?: boolean;
  platformMode?: PlatformMode;
  onSwitchPlatformMode?: (mode: PlatformMode) => void;
  isOwner?: boolean;

  // Optional Tab View Content to render when not on 'home'
  activeViewContent?: React.ReactNode;
}

export const DesktopShell: React.FC<DesktopShellProps> = ({
  activeTab,
  onSelectTab,
  onOpenMemory,
  onOpenSettings,
  onOpenToolRunner,
  onOpenSocial,
  onOpenOwnerAdmin,
  messages,
  isThinking,
  voiceState,
  audioLevel,
  emotion,
  isConnected,
  isMuted,
  playingMessageId,
  isGuestMode = false,
  onEndGuestMode,
  onPlayMessageAudio,
  onSendMessage,
  onToggleMic,
  onToggleMute,
  onBargeIn,
  isCameraActive,
  onToggleCamera,
  onSelectImage,
  isVideoCallActive = false,
  onToggleVideoCall,
  onSnapPhoto,
  onSwitchCamera,
  wakeWordActive,
  wakeWordStatus,
  enableWakeWord,
  wakePhrase,
  onTriggerWakeWord,
  runnerConnected = false,
  platformMode = 'owner',
  onSwitchPlatformMode,
  isOwner = true,
  activeViewContent,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isConversationOpen, setIsConversationOpen] = useState(true);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);

  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col bg-[#060207] text-white select-none">
      {/* Top Desktop Bar with Status & Drag Region */}
      <DesktopHeader
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => {
          if (!isSidebarOpen) {
            setIsSidebarOpen(true);
            setIsSidebarCollapsed(false);
          } else if (!isSidebarCollapsed) {
            setIsSidebarCollapsed(true);
          } else {
            setIsSidebarOpen(false);
          }
        }}
        isConversationOpen={isConversationOpen}
        onToggleConversation={() => setIsConversationOpen((prev) => !prev)}
        isConnected={isConnected}
        voiceState={voiceState}
        emotion={emotion}
        isOwner={isOwner}
        isGuestMode={isGuestMode}
        isVideoCallActive={isVideoCallActive}
        runnerConnected={runnerConnected}
        platformMode={platformMode}
        onSwitchPlatformMode={onSwitchPlatformMode}
        onOpenSettings={onOpenSettings}
      />

      {/* Main 3-Zone Workspace */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* Left Collapsible Navigation Sidebar */}
        {isSidebarOpen && (
          <CollapsibleSidebar
            activeTab={activeTab}
            onSelectTab={onSelectTab}
            onOpenMemory={onOpenMemory}
            onOpenSettings={onOpenSettings}
            onOpenToolRunner={onOpenToolRunner}
            onOpenSocial={onOpenSocial}
            onOpenOwnerAdmin={onOpenOwnerAdmin}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          />
        )}

        {/* Center Stage: Immersive Avatar Companion Stage */}
        <main className="flex-1 min-h-0 min-w-0 flex flex-col relative bg-[#040105] overflow-hidden p-2 sm:p-3">
          {/* If an active non-home tab is selected (e.g. Tools, Settings, Memories), display the tab content in an overlay layer or primary area */}
          {activeTab !== 'home' && activeViewContent ? (
            <div className="w-full h-full rounded-3xl overflow-hidden bg-[#0a0409]/95 backdrop-blur-xl border border-rose-900/30 p-4 shadow-2xl flex flex-col">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-rose-900/20 shrink-0">
                <h3 className="font-serif font-bold text-base text-rose-200 uppercase tracking-wider">
                  {activeTab.replace('_', ' ')}
                </h3>
                <button
                  onClick={() => onSelectTab('home')}
                  className="px-3 py-1 rounded-xl bg-rose-950 hover:bg-rose-900 text-xs text-rose-200 border border-rose-800/40 transition-all"
                >
                  Return to Maryam Live Stage
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {activeViewContent}
              </div>
            </div>
          ) : (
            <div className="relative w-full h-full flex flex-col justify-between overflow-hidden">
              {/* Central Maryam Avatar Stage with real-time lip sync and expression reactivity */}
              <div className="flex-1 min-h-0 w-full relative">
                <AvatarStage
                  voiceState={voiceState}
                  audioLevel={audioLevel}
                  emotion={emotion}
                  isConnected={isConnected}
                  isCameraActive={isCameraActive || isVideoCallActive}
                  isOwner={isOwner}
                  isThinking={isThinking}
                />
              </div>

              {/* Bottom Glassmorphic Floating Controls Bar */}
              <div className="shrink-0 pt-2">
                <FloatingControlsBar
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
            </div>
          )}
        </main>

        {/* Right Collapsible Conversation & Context Stream Panel (Auto-hidden on Full Conversations Tab) */}
        {activeTab !== 'conversations' && (
          <CollapsibleConversationPanel
            messages={messages}
            isThinking={isThinking}
            voiceState={voiceState}
            audioLevel={audioLevel}
            playingMessageId={playingMessageId}
            isGuestMode={isGuestMode}
            isOpen={isConversationOpen}
            onToggleOpen={() => setIsConversationOpen((prev) => !prev)}
            onEndGuestMode={onEndGuestMode}
            onPlayMessageAudio={onPlayMessageAudio}
            onSendMessage={onSendMessage}
            onToggleMic={onToggleMic}
            onToggleCamera={onToggleCamera}
            onOpenMemory={onOpenMemory}
            onOpenToolRunner={onOpenToolRunner}
            onSelectTab={(tab) => onSelectTab(tab as NavTab)}
          />
        )}
      </div>
    </div>
  );
};
