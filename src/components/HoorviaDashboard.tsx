import React, { useState, useEffect, useRef } from 'react';
import {
  Home,
  Bot,
  MessageSquare,
  Mic,
  Brain,
  Volume2,
  Key,
  BarChart2,
  Settings,
  LogOut,
  Sparkles,
  Send,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  User,
  Heart,
  GraduationCap,
  Users,
  BookOpen,
  VolumeX,
  Play,
  Square,
  Search,
  Compass,
  Briefcase,
  HeartPulse,
  DollarSign,
  Palette,
  Sun,
  X,
  ChevronRight,
  AlertCircle,
  Lock,
  Globe,
  Radio,
  PhoneOff,
  Loader2,
  MicOff,
} from 'lucide-react';
import { GeminiLiveAudioManager } from '../lib/audioManager';
import { CompanionProfile, CompanionVoice, CompanionTone, isMohsinMaryam } from '../lib/hoorviaTypes';
import { HOORVIA_VOICES, playVoiceSample } from '../lib/voicePreview';
import { SearchableLanguagePicker } from './SearchableLanguagePicker';
import { HoorviaLogo } from './HoorviaLogo';
import { isRtlLanguage, getLanguageByCodeOrName } from '../lib/languageCatalog';
import {
  CatalogItem,
  POPULAR_PRESETS,
  CATALOG_CATEGORIES,
  searchCatalogItems,
  parseCustomCompanionPrompt,
  buildCatalogSystemPrompt,
} from '../lib/companionCatalog';

interface HoorviaDashboardProps {
  token: string;
  user: any;
  initialCompanion: CompanionProfile;
  onLogout: () => void;
  onOpenOwnerAdmin?: () => void;
}

export const HoorviaDashboard: React.FC<HoorviaDashboardProps> = ({
  token,
  user,
  initialCompanion,
  onLogout,
  onOpenOwnerAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<
    'home' | 'companion' | 'chat' | 'live' | 'memory' | 'voice' | 'provider' | 'usage' | 'settings'
  >('home');

  const [companion, setCompanion] = useState<CompanionProfile>(initialCompanion);
  const [memories, setMemories] = useState<any[]>([]);
  const [hasBYOK, setHasBYOK] = useState<boolean>(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [usage, setUsage] = useState<any>({ requestCount: 0, liveMinutesUsed: 0 });
  const [policy, setPolicy] = useState<any>({ freeTierDailyLimit: 100 });

  // Chat state
  const [chatInput, setChatInput] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'companion'; text: string; time: string }>>([]);
  const [isSendingChat, setIsSendingChat] = useState<boolean>(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // New Memory state
  const [newMemoryFact, setNewMemoryFact] = useState<string>('');
  const [newMemoryCategory, setNewMemoryCategory] = useState<string>('preference');

  // Provider BYOK state
  const [inputApiKey, setInputApiKey] = useState<string>('');
  const [isSavingKey, setIsSavingKey] = useState<boolean>(false);
  const [providerMessage, setProviderMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [diagnosticReport, setDiagnosticReport] = useState<any>(null);
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState<boolean>(false);

  const handleRunDiagnostic = async () => {
    setIsRunningDiagnostic(true);
    setDiagnosticReport(null);
    try {
      const res = await fetch('/api/hoorvia/provider/diagnostics', {
        headers: { 'X-Hoorvia-Token': token },
      });
      const data = await res.json();
      if (data.report) {
        setDiagnosticReport(data.report);
      }
    } catch (err: any) {
      console.error('Failed to run diagnostics:', err);
    } finally {
      setIsRunningDiagnostic(false);
    }
  };

  // Live Voice state & engine
  type LiveSessionState = 'IDLE' | 'REQUESTING_MIC' | 'CONNECTING' | 'LISTENING' | 'SPEAKING' | 'ERROR';
  const [liveState, setLiveState] = useState<LiveSessionState>('IDLE');
  const [liveStatus, setLiveStatus] = useState<string>('Ready to start live voice session');
  const [liveError, setLiveError] = useState<string | null>(null);
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied' | 'unavailable'>('prompt');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [liveDuration, setLiveDuration] = useState<number>(0);
  const [connectedLiveModel, setConnectedLiveModel] = useState<string | null>(null);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);

  const audioManagerRef = useRef<GeminiLiveAudioManager | null>(null);
  const liveWsRef = useRef<WebSocket | null>(null);
  const durationTimerRef = useRef<any>(null);

  // Catalog & Search State in Dashboard
  const [isExploreOpen, setIsExploreOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('all');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isGeneratingCustom, setIsGeneratingCustom] = useState<boolean>(false);
  const [activeDisclaimer, setActiveDisclaimer] = useState<string | null>(null);

  const handleSelectCatalogPreset = async (item: CatalogItem) => {
    const newSysPrompt = buildCatalogSystemPrompt(item);
    const updatedComp: CompanionProfile = {
      ...companion,
      name: item.title,
      type: item.id as any,
      gender: item.suggestedGender,
      voice: item.suggestedVoice,
      language: item.defaultLanguage,
      personality: item.personality,
      communicationStyle: item.communicationStyle,
      tone: item.suggestedTone,
      systemPrompt: newSysPrompt,
    };

    setCompanion(updatedComp);
    setActiveDisclaimer(item.disclaimer || null);
    setIsExploreOpen(false);
    await handleSaveProfile(updatedComp);
  };

  const handleGenerateCustomCompanionDashboard = async () => {
    if (!customPrompt.trim()) return;
    setIsGeneratingCustom(true);

    try {
      let parsed: any = null;
      try {
        const res = await fetch('/api/hoorvia/companion/auto-generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Hoorvia-Token': token,
          },
          body: JSON.stringify({ prompt: customPrompt }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.companion) parsed = data.companion;
        }
      } catch {}

      if (!parsed) {
        parsed = parseCustomCompanionPrompt(customPrompt);
      }

      if (parsed) {
        const newSysPrompt = buildCatalogSystemPrompt(parsed);
        const updatedComp: CompanionProfile = {
          ...companion,
          name: parsed.name || parsed.title || 'Nova',
          type: (parsed.type || 'custom') as any,
          gender: parsed.suggestedGender || parsed.gender || 'neutral',
          voice: parsed.suggestedVoice || parsed.voice || 'Puck',
          language: parsed.defaultLanguage || parsed.language || 'English',
          personality: parsed.personality || companion.personality,
          communicationStyle: parsed.communicationStyle || companion.communicationStyle,
          tone: parsed.suggestedTone || parsed.tone || 'Friendly',
          systemPrompt: newSysPrompt,
        };

        setCompanion(updatedComp);
        if (parsed.disclaimer) setActiveDisclaimer(parsed.disclaimer);
        setIsExploreOpen(false);
        await handleSaveProfile(updatedComp);
      }
    } catch (err) {
      console.error('Error auto-generating custom companion:', err);
    } finally {
      setIsGeneratingCustom(false);
    }
  };

  const handleToggleVoicePreview = (vId: CompanionVoice, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewingVoice === vId) {
      playVoiceSample(vId, undefined, () => setPreviewingVoice(null))();
      setPreviewingVoice(null);
    } else {
      setPreviewingVoice(vId);
      playVoiceSample(
        vId,
        () => setPreviewingVoice(vId),
        () => setPreviewingVoice(null)
      );
    }
  };

  // Load User Data
  const fetchUserData = async () => {
    try {
      const res = await fetch('/api/hoorvia/auth/me', {
        headers: { 'X-Hoorvia-Token': token },
      });
      const data = await res.json();
      if (res.ok) {
        if (data.companion) setCompanion(data.companion);
        setHasBYOK(data.hasBYOK);
        setMaskedKey(data.maskedKey);
        if (data.selectedModel) setSelectedModel(data.selectedModel);
        if (data.availableModels) setAvailableModels(data.availableModels);
        if (data.usage) setUsage(data.usage);
        if (data.policy) setPolicy(data.policy);
      }
    } catch (err) {
      console.error('Error fetching dashboard user data:', err);
    }
  };

  const fetchMemories = async () => {
    try {
      const res = await fetch('/api/hoorvia/memories', {
        headers: { 'X-Hoorvia-Token': token },
      });
      const data = await res.json();
      if (res.ok && data.memories) {
        setMemories(data.memories);
      }
    } catch (err) {
      console.error('Error fetching memories:', err);
    }
  };

  useEffect(() => {
    fetchUserData();
    fetchMemories();
  }, [token]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Handle Save Companion Profile
  const handleSaveProfile = async (dataToUpdate: Partial<CompanionProfile>) => {
    try {
      const res = await fetch('/api/hoorvia/companion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hoorvia-Token': token,
        },
        body: JSON.stringify(dataToUpdate),
      });

      const data = await res.json();
      if (res.ok && data.companion) {
        setCompanion(data.companion);
      }
    } catch (err) {
      console.error('Error updating companion profile:', err);
    }
  };

  // Handle Send Chat
  const handleSendChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isSendingChat) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setChatMessages((prev) => [...prev, { sender: 'user', text: userMsg, time: timeStr }]);

    // Mandatory BYOK Check for Public Users
    if (!hasBYOK && user.role !== 'owner') {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'companion',
          text: 'Your own API key is required to activate your companion. Please connect your Google Gemini API key in AI Provider settings to enable chat.',
          time: timeStr,
        },
      ]);
      return;
    }

    setIsSendingChat(true);

    try {
      const res = await fetch('/api/hoorvia/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hoorvia-Token': token,
        },
        body: JSON.stringify({
          message: userMsg,
          history: chatMessages.slice(-8),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to get response.');
      }

      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'companion',
          text: data.reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      if (data.usage) setUsage(data.usage);
      fetchMemories(); // refresh memories if any fact was auto-extracted
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'companion',
          text: `[Error: ${err.message || 'Unable to connect'}]`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsSendingChat(false);
    }
  };

  // Handle Memory Operations
  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryFact.trim()) return;

    try {
      const res = await fetch('/api/hoorvia/memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hoorvia-Token': token,
        },
        body: JSON.stringify({ fact: newMemoryFact.trim(), category: newMemoryCategory }),
      });

      if (res.ok) {
        setNewMemoryFact('');
        fetchMemories();
      }
    } catch (err) {
      console.error('Error adding memory:', err);
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    try {
      await fetch(`/api/hoorvia/memories/${memoryId}`, {
        method: 'DELETE',
        headers: { 'X-Hoorvia-Token': token },
      });
      fetchMemories();
    } catch (err) {
      console.error('Error deleting memory:', err);
    }
  };

  const handleResetMemories = async () => {
    if (!window.confirm('Are you sure you want to reset all memories for your companion?')) return;
    try {
      await fetch('/api/hoorvia/memories/reset', {
        method: 'POST',
        headers: { 'X-Hoorvia-Token': token },
      });
      fetchMemories();
    } catch (err) {
      console.error('Error resetting memories:', err);
    }
  };

  // Handle BYOK Connection
  const handleConnectApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputApiKey.trim() || isSavingKey) return;

    setIsSavingKey(true);
    setProviderMessage(null);

    try {
      const res = await fetch('/api/hoorvia/provider/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hoorvia-Token': token,
        },
        body: JSON.stringify({ apiKey: inputApiKey.trim() }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Validation failed.');
      }

      setHasBYOK(true);
      setMaskedKey(data.maskedKey);
      if (data.selectedModel) setSelectedModel(data.selectedModel);
      if (data.availableModels) setAvailableModels(data.availableModels);
      setInputApiKey('');
      setProviderMessage({
        type: 'success',
        text: `Google Gemini API key verified & encrypted successfully! Compatible model selected: ${data.selectedModel || 'gemini-2.0-flash'}`,
      });
    } catch (err: any) {
      setProviderMessage({ type: 'error', text: err.message || 'Key validation failed.' });
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleDisconnectApiKey = async () => {
    try {
      await fetch('/api/hoorvia/provider/disconnect', {
        method: 'POST',
        headers: { 'X-Hoorvia-Token': token },
      });
      setHasBYOK(false);
      setMaskedKey(null);
      setSelectedModel(null);
      setAvailableModels([]);
      setProviderMessage({ type: 'success', text: 'API Key disconnected.' });
    } catch (err) {
      console.error('Error disconnecting API key:', err);
    }
  };

  // Real-time Live Voice Engine
  const stopLiveSession = (notifyUser: boolean = true, source: string = 'user_action') => {
    console.log(`[CLIENT_CLOSE_CALLED] source=${source} notifyUser=${notifyUser}`);

    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    if (liveWsRef.current) {
      const activeWs = liveWsRef.current;
      liveWsRef.current = null;
      try {
        if (activeWs.readyState === WebSocket.OPEN || activeWs.readyState === WebSocket.CONNECTING) {
          activeWs.close(1000, source);
        }
      } catch {
        // Ignore
      }
    }

    if (audioManagerRef.current) {
      try {
        audioManagerRef.current.destroy();
      } catch {
        // Ignore
      }
      audioManagerRef.current = null;
    }

    setAudioLevel(0);
    setLiveState((prev) => (prev === 'ERROR' ? 'ERROR' : 'IDLE'));
    if (notifyUser) {
      setLiveStatus('Voice session ended.');
    }
  };

  const startLiveSession = async () => {
    setLiveError(null);

    // BYOK Key Check
    if (!hasBYOK && user.role !== 'owner') {
      setLiveState('ERROR');
      setLiveError(
        'Your own API key is required to activate your companion. Please connect your AI provider in Provider Settings.'
      );
      return;
    }

    // Microphone Permission & Audio Context Initialization during user gesture
    setLiveState('REQUESTING_MIC');
    setLiveStatus('Requesting microphone access...');

    const audioManager = new GeminiLiveAudioManager({
      onAudioData: (base64Pcm) => {
        if (liveWsRef.current && liveWsRef.current.readyState === WebSocket.OPEN) {
          liveWsRef.current.send(
            JSON.stringify({
              type: 'realtime_input',
              mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: base64Pcm }],
            })
          );
        }
      },
      onVoiceStateChange: (state) => {
        if (state === 'Speaking') {
          setLiveState('SPEAKING');
        } else if (state === 'Listening') {
          setLiveState('LISTENING');
        }
      },
      onAudioLevel: (level) => {
        setAudioLevel(level);
      },
      onUserSpeechDetected: () => {
        // Barge-in handled internally
      },
      onError: (err) => {
        console.error('[Live Audio Manager error]', err);
      },
    });

    audioManager.setGuestMode(true);
    audioManagerRef.current = audioManager;

    try {
      const micStarted = await audioManager.startMicrophone();
      if (!micStarted) {
        setMicPermission('denied');
        setLiveState('ERROR');
        setLiveError('Microphone permission is required for Live Voice. Please allow microphone access in your browser settings.');
        stopLiveSession(false, 'mic_permission_failed');
        return;
      }
      setMicPermission('granted');
    } catch (err: any) {
      console.error('Microphone access error:', err);
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      setMicPermission(isDenied ? 'denied' : 'unavailable');
      setLiveState('ERROR');
      setLiveError(
        isDenied
          ? 'Microphone permission is required for Live Voice. Please allow microphone access in your browser settings.'
          : 'No microphone found or device is unavailable. Please check your audio hardware.'
      );
      stopLiveSession(false, 'mic_error');
      return;
    }

    // Connect to WebSocket
    setLiveState('CONNECTING');
    setLiveStatus(`Connecting to Live Voice AI (${companion.voice})...`);

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/hoorvia/live-ws?token=${encodeURIComponent(token)}`;
      console.log(`[CLIENT_WS_CREATED] URL: ${protocol}//${window.location.host}/api/hoorvia/live-ws?token=***`);

      const ws = new WebSocket(wsUrl);
      liveWsRef.current = ws;

      ws.onopen = () => {
        console.log('[CLIENT_WS_OPEN]');
        setLiveStatus(`Live session initializing with ${companion.name}...`);
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ready') {
            console.log(`[SETUP_COMPLETE_RECEIVED] Model: ${data.model || 'gemini-3.8-live'}`);
            console.log(`[HOORVIA_SETUP_COMPLETE] Model: ${data.model || 'gemini-3.8-live'}`);
            setConnectedLiveModel(data.model);
            setLiveState('LISTENING');
            setLiveStatus(`Live with ${data.companionName || companion.name} (${data.voice || companion.voice}) • ${data.model || 'gemini-3.8-live'}`);
            setLiveDuration(0);
            if (durationTimerRef.current) clearInterval(durationTimerRef.current);
            durationTimerRef.current = setInterval(() => {
              setLiveDuration((prev) => prev + 1);
            }, 1000);
          } else if (data.type === 'audio' && data.audio) {
            setLiveState('SPEAKING');
            console.log(`[BROWSER_AUDIO_RECEIVED] bytes=${data.audio.length}`);
            console.log(`[AUDIO_CHUNK_RECEIVED_BROWSER] bytes=${data.audio.length}`);
            audioManagerRef.current?.playChunk(data.audio, data.mimeType);
          } else if (data.type === 'interrupted') {
            audioManagerRef.current?.bargeIn();
            setLiveState('LISTENING');
          } else if (data.type === 'turnComplete') {
            setLiveState('LISTENING');
          } else if (data.type === 'error') {
            console.error('[CLIENT_WS_SERVER_ERROR]', data.message);
            setLiveState('ERROR');
            setLiveError(data.message || 'Live Voice encountered an issue.');
            stopLiveSession(false, 'server_error');
          }
        } catch (err) {
          console.error('[Hoorvia Live WS parse error]', err);
        }
      };

      ws.onerror = (e) => {
        console.error('[CLIENT_WS_ERROR]', e);
      };

      ws.onclose = (event) => {
        console.log(`[CLIENT_WS_CLOSE] code=${event.code} reason=${event.reason || 'Normal close'}`);
        if (liveWsRef.current === ws) {
          stopLiveSession(false, `ws_onclose_code_${event.code}`);
        }
      };
    } catch (err: any) {
      console.error('[CLIENT_WS_INIT_FAILED]', err);
      setLiveState('ERROR');
      setLiveError(err.message || 'Failed to start Live Voice session.');
      stopLiveSession(false, 'init_exception');
    }
  };

  const handleToggleLive = () => {
    if (liveState === 'CONNECTING' || liveState === 'LISTENING' || liveState === 'SPEAKING') {
      stopLiveSession(true, 'user_toggle_end');
    } else {
      startLiveSession();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[CLIENT_CLOSE_CALLED] source=HoorviaDashboard.useEffect_unmount');
      if (liveWsRef.current) {
        stopLiveSession(false, 'unmount');
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0A070B] text-slate-100 flex flex-col md:flex-row font-sans selection:bg-rose-500/30">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 md:h-screen md:sticky md:top-0 md:overflow-y-auto bg-slate-950/90 border-r border-rose-950/40 p-4 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo Branding */}
          <div className="mb-5 pb-3 border-b border-rose-950/40 px-1">
            <HoorviaLogo size="sm" />
          </div>

          {/* Active User Card */}
          <div className="px-3 py-2.5 mb-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-rose-950 text-rose-300 border border-rose-800/50 flex items-center justify-center font-bold uppercase shrink-0">
                {user.name?.[0] || 'U'}
              </div>
              <div className="truncate">
                <p className="font-semibold text-white truncate">{user.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
            {user.role === 'owner' && onOpenOwnerAdmin && (
              <button
                onClick={onOpenOwnerAdmin}
                title="Owner Control Center"
                className="px-2 py-1 rounded bg-rose-950 text-rose-300 border border-rose-700/60 text-[10px] font-bold hover:bg-rose-900"
              >
                👑 Admin
              </button>
            )}
          </div>

          {/* Nav Items */}
          <nav className="space-y-1">
            {[
              { id: 'home', label: 'Home', icon: Home },
              { id: 'companion', label: 'My Companion', icon: Bot },
              { id: 'chat', label: 'Chat', icon: MessageSquare },
              { id: 'live', label: 'Live Voice', icon: Mic },
              { id: 'memory', label: 'Memory', icon: Brain },
              { id: 'voice', label: 'Voice & Persona', icon: Volume2 },
              { id: 'provider', label: 'AI Provider', icon: Key },
              { id: 'usage', label: 'Usage & Quotas', icon: BarChart2 },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-rose-950/80 text-rose-200 border border-rose-800/60 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-rose-400' : 'text-slate-400'}`} />
                  {item.label}
                </button>
              );
            })}

            {user.role === 'owner' && onOpenOwnerAdmin && (
              <button
                onClick={onOpenOwnerAdmin}
                className="w-full mt-2 flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all bg-gradient-to-r from-rose-950/90 to-purple-950/90 border border-rose-600/60 text-rose-200 hover:text-white hover:border-rose-400 shadow-md shadow-rose-950/50 group"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
                  <span>Owner Admin</span>
                </div>
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Control
                </span>
              </button>
            )}
          </nav>
        </div>

        {/* Footer Logout */}
        <div className="pt-4 border-t border-slate-800/80 space-y-2">
          {hasBYOK ? (
            <div className="px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-[10px] text-rose-300 flex items-center justify-between">
              <span>BYOK Connected</span>
              <CheckCircle className="w-3 h-3 text-rose-400" />
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Free Tier Quota</span>
              <span className="font-mono">{usage.requestCount}/{policy.freeTierDailyLimit}</span>
            </div>
          )}

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-medium transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Log Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 max-w-5xl mx-auto w-full min-h-screen">
        {/* TAB 1: HOME */}
        {activeTab === 'home' && (
          <div className="space-y-6 animate-fadeIn">
            {!hasBYOK && user.role !== 'owner' && (
              <div className="p-4 rounded-2xl bg-amber-950/70 border border-amber-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-200 text-xs">
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <strong className="text-amber-100">Companion Activation Pending:</strong> Your own API key is required to activate your companion and start chatting.
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('provider')}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs shrink-0"
                >
                  Connect AI Provider
                </button>
              </div>
            )}

            {/* Greeting Header */}
            <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-r from-rose-950/60 via-slate-900 to-slate-950 border border-rose-900/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-rose-400 px-3 py-1 rounded-full bg-rose-950 border border-rose-800/40">
                  {companion.type.toUpperCase()} COMPANION
                </span>
                <h2 className="text-3xl font-extrabold text-white mt-3">
                  Hello, {user.name}! {companion.name} is online.
                </h2>
                <p className="text-xs text-slate-400 mt-1 max-w-xl">
                  {companion.personality}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('chat')}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg flex items-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" /> Start Chat
                </button>
                <button
                  onClick={() => setActiveTab('live')}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-semibold border border-rose-900/40 flex items-center gap-2"
                >
                  <Mic className="w-4 h-4 text-rose-400" /> Live Voice
                </button>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-rose-400" /> Stored Memories
                </span>
                <p className="text-2xl font-black text-white mt-2">{memories.length}</p>
                <p className="text-[11px] text-slate-500 mt-1">Isolated fact bank for {companion.name}</p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-rose-400" /> Selected Voice
                </span>
                <p className="text-2xl font-black text-white mt-2">{companion.voice}</p>
                <p className="text-[11px] text-slate-500 mt-1">Language: {companion.language}</p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-rose-400" /> AI Key Provider
                </span>
                <p className="text-2xl font-black text-white mt-2">
                  {hasBYOK ? 'Active & Encrypted' : user.role === 'owner' ? 'Owner Instance' : 'Key Required'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {hasBYOK ? maskedKey : user.role === 'owner' ? 'Private Maryam' : 'Connect your API key to activate'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MY COMPANION PROFILE */}
        {activeTab === 'companion' && (
          <div className="space-y-6 max-w-2xl animate-fadeIn">
            <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Companion Profile</h2>
                <p className="text-xs text-slate-400">Configure companion name, relationship style, and persona.</p>
              </div>
              <button
                onClick={() => setIsExploreOpen(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2"
              >
                <Compass className="w-4 h-4" />
                Explore Preset Catalog
              </button>
            </div>

            {activeDisclaimer && (
              <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-800/60 text-xs text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{activeDisclaimer}</span>
              </div>
            )}

            <div className="space-y-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Companion Name</label>
                <input
                  type="text"
                  value={companion.name}
                  onChange={(e) => setCompanion({ ...companion, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Companion Type</label>
                  <select
                    value={companion.type}
                    onChange={(e) => setCompanion({ ...companion, type: e.target.value as any })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-rose-500"
                  >
                    <option value="girlfriend">AI Girlfriend</option>
                    <option value="boyfriend">AI Boyfriend</option>
                    <option value="teacher">Teacher / Tutor</option>
                    <option value="helper">Personal Helper</option>
                    <option value="support">Supportive Companion</option>
                    <option value="study_partner">Study Partner</option>
                    <option value="custom">Custom Entity</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Gender / Presentation</label>
                  <select
                    value={companion.gender}
                    onChange={(e) => setCompanion({ ...companion, gender: e.target.value as any })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-rose-500"
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="nonbinary">Non-Binary</option>
                    <option value="neutral">Neutral</option>
                  </select>
                </div>
              </div>

              {/* Searchable Language Picker */}
              <SearchableLanguagePicker
                selectedLanguage={companion.language || 'English'}
                onSelectLanguage={(newLang) => setCompanion({ ...companion, language: newLang })}
                autoMatchLanguage={companion.autoMatchLanguage || false}
                onToggleAutoMatch={(enabled) => setCompanion({ ...companion, autoMatchLanguage: enabled })}
                readOnly={isMohsinMaryam(user.id, companion.id)}
              />

              {isMohsinMaryam(user.id, companion.id) && (
                <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-800/60 text-xs text-purple-200 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>
                    <strong>Owner Maryam Hard Lock:</strong> Maryam's natural Roman Urdu language and voice settings are permanently locked to preserve her private configuration.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Personality Traits</label>
                <textarea
                  value={companion.personality}
                  onChange={(e) => setCompanion({ ...companion, personality: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">System Prompt Directive</label>
                <textarea
                  value={companion.systemPrompt}
                  onChange={(e) => setCompanion({ ...companion, systemPrompt: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <button
                onClick={() => handleSaveProfile(companion)}
                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md"
              >
                Save Profile Changes
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: TEXT CHAT */}
        {activeTab === 'chat' && (() => {
          const chatLangObj = getLanguageByCodeOrName(companion.language || 'English');
          const isChatRtl = isRtlLanguage(companion.language || 'English');

          return (
            <div className="h-[calc(100vh-8rem)] flex flex-col bg-slate-900/60 rounded-3xl border border-rose-950/60 overflow-hidden shadow-2xl animate-fadeIn">
              {/* Chat Top Bar */}
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-rose-950 text-rose-300 border border-rose-800/60 flex items-center justify-center font-bold">
                    {companion.name[0]}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{companion.name}</h3>
                    <p className="text-[10px] text-slate-400 capitalize">{companion.type} Companion • {companion.tone}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                    <Globe className="w-3.5 h-3.5 text-rose-400" />
                    <span>{chatLangObj.name}</span>
                    {chatLangObj.nativeName !== chatLangObj.name && (
                      <span className="text-slate-400 font-sans">({chatLangObj.nativeName})</span>
                    )}
                    {companion.autoMatchLanguage && (
                      <span className="text-[10px] text-amber-400 font-semibold">• Auto Match</span>
                    )}
                    {isChatRtl && (
                      <span className="text-[9px] bg-rose-950 px-1 rounded text-rose-300 font-mono">RTL</span>
                    )}
                  </div>
                  <span className={`text-[10px] px-2.5 py-1 rounded-full border ${hasBYOK ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40' : user.role === 'owner' ? 'bg-purple-950/60 text-purple-300 border-purple-800/40' : 'bg-rose-950 text-rose-300 border-rose-800/50'}`}>
                    AI Provider: {hasBYOK ? 'Connected' : user.role === 'owner' ? 'Owner Instance' : 'Key Required'}
                  </span>
                </div>
              </div>

              {!hasBYOK && user.role !== 'owner' && (
                <div className="px-6 py-2.5 bg-amber-950/80 border-b border-amber-800/80 flex items-center justify-between text-xs text-amber-200">
                  <span>Your own API key is required to activate your companion.</span>
                  <button
                    onClick={() => setActiveTab('provider')}
                    className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px]"
                  >
                    Connect Key
                  </button>
                </div>
              )}

              {/* Chat Messages */}
              <div
                ref={chatScrollRef}
                dir={isChatRtl ? 'rtl' : 'ltr'}
                className="flex-1 p-6 overflow-y-auto space-y-4"
              >
                {chatMessages.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 text-xs space-y-2" dir="ltr">
                    <Bot className="w-10 h-10 mx-auto text-rose-400/40" />
                    <p>Start a conversation with {companion.name} in {chatLangObj.name} ({chatLangObj.nativeName}).</p>
                    <p className="text-[10px] text-slate-600">
                      Your chats and memories are strictly isolated to your user ID.
                    </p>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-lg px-4 py-3 rounded-2xl text-xs leading-relaxed ${
                          msg.sender === 'user'
                            ? 'bg-rose-600 text-white rounded-br-none shadow-md'
                            : 'bg-slate-950 text-slate-200 border border-slate-800 rounded-bl-none shadow-md'
                        }`}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[9px] text-slate-500 mt-1 px-1">{msg.time}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendChat} className="p-4 bg-slate-950 border-t border-slate-800 flex gap-2">
                <input
                  type="text"
                  dir={isChatRtl ? 'rtl' : 'ltr'}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={`Message ${companion.name} in ${chatLangObj.name}...`}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500"
                />
                <button
                  type="submit"
                  disabled={isSendingChat || !chatInput.trim()}
                  className="px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> Send
                </button>
              </form>
            </div>
          );
        })()}

        {/* TAB 4: LIVE VOICE */}
        {activeTab === 'live' && (
          <div className="p-8 rounded-3xl bg-slate-900/60 border border-rose-950/60 text-center space-y-6 animate-fadeIn">
            {!hasBYOK && user.role !== 'owner' && (
              <div className="p-4 rounded-2xl bg-amber-950/70 border border-amber-800/80 flex items-center justify-between text-amber-200 text-xs text-left">
                <div className="flex items-center gap-2.5">
                  <Key className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Your own API key is required to activate your companion. Connect your Google Gemini API key to enable real-time Live Voice.</span>
                </div>
                <button
                  onClick={() => setActiveTab('provider')}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0"
                >
                  Connect Key
                </button>
              </div>
            )}

            {/* Live Voice Visual Orb */}
            <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
              {/* Outer Glowing Ripple */}
              {(liveState === 'LISTENING' || liveState === 'SPEAKING') && (
                <div
                  className={`absolute inset-0 rounded-full blur-xl transition-all duration-300 ${
                    liveState === 'SPEAKING'
                      ? 'bg-rose-500/40 animate-pulse'
                      : 'bg-emerald-500/30'
                  }`}
                  style={{
                    transform: `scale(${1 + Math.min(audioLevel * 1.5, 0.8)})`,
                  }}
                />
              )}

              {/* Middle Border Ring */}
              <div
                className={`w-28 h-28 rounded-full p-1 transition-all duration-300 shadow-2xl ${
                  liveState === 'SPEAKING'
                    ? 'bg-gradient-to-br from-rose-500 to-amber-500 shadow-rose-900/80'
                    : liveState === 'LISTENING'
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-500 shadow-emerald-900/80'
                    : liveState === 'CONNECTING' || liveState === 'REQUESTING_MIC'
                    ? 'bg-gradient-to-br from-amber-500 to-rose-500 shadow-amber-900/80 animate-spin'
                    : liveState === 'ERROR'
                    ? 'bg-gradient-to-br from-rose-700 to-red-900 shadow-rose-950/80'
                    : 'bg-gradient-to-br from-rose-900/60 to-purple-950/60 shadow-slate-950'
                }`}
              >
                <div className="w-full h-full rounded-full bg-slate-950 flex flex-col items-center justify-center text-slate-100">
                  {liveState === 'CONNECTING' || liveState === 'REQUESTING_MIC' ? (
                    <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
                  ) : liveState === 'SPEAKING' ? (
                    <Volume2 className="w-10 h-10 text-rose-400 animate-bounce" />
                  ) : liveState === 'LISTENING' ? (
                    <Mic className="w-10 h-10 text-emerald-400 animate-pulse" />
                  ) : liveState === 'ERROR' ? (
                    <MicOff className="w-10 h-10 text-rose-500" />
                  ) : (
                    <Mic className="w-10 h-10 text-slate-600" />
                  )}
                </div>
              </div>
            </div>

            {/* Status & Session Duration */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800/80 border border-slate-700/60">
                {liveState === 'LISTENING' && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-emerald-300">Listening to you</span>
                  </>
                )}
                {liveState === 'SPEAKING' && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                    <span className="text-rose-300">{companion.name} is speaking</span>
                  </>
                )}
                {(liveState === 'CONNECTING' || liveState === 'REQUESTING_MIC') && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span className="text-amber-300">Connecting live stream...</span>
                  </>
                )}
                {liveState === 'IDLE' && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    <span className="text-slate-400">Ready to start</span>
                  </>
                )}
                {liveState === 'ERROR' && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="text-rose-400">Connection Error</span>
                  </>
                )}
                {(liveState === 'LISTENING' || liveState === 'SPEAKING') && (
                  <span className="text-slate-400 font-mono ml-1 border-l border-slate-700 pl-2">
                    {Math.floor(liveDuration / 60)}:{(liveDuration % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </div>

              <h2 className="text-2xl font-bold text-white">Live Voice with {companion.name}</h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto">{liveStatus}</p>

              {/* Model & Voice Badges */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-[11px] text-rose-300/80 font-mono">
                <span className="px-2.5 py-1 rounded-lg bg-slate-950/80 border border-rose-950/60">
                  Voice: {companion.voice}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-950/80 border border-rose-950/60">
                  Language: {companion.language}
                </span>
                {connectedLiveModel && (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">
                    Model: {connectedLiveModel}
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-400">
                  BYOK Isolated
                </span>
              </div>
            </div>

            {/* Error Display */}
            {liveError && (
              <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/70 text-rose-200 text-xs max-w-md mx-auto flex items-start gap-2 text-left">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-rose-300">Live Voice Notice</div>
                  <div className="mt-0.5 text-slate-300">{liveError}</div>
                </div>
              </div>
            )}

            {/* Control Buttons */}
            <div className="flex items-center justify-center gap-3 pt-2">
              {liveState === 'LISTENING' || liveState === 'SPEAKING' ? (
                <button
                  onClick={() => stopLiveSession(true)}
                  className="px-8 py-3 rounded-2xl text-xs font-bold transition-all shadow-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-2"
                >
                  <PhoneOff className="w-4 h-4" /> End Voice Session
                </button>
              ) : liveState === 'CONNECTING' || liveState === 'REQUESTING_MIC' ? (
                <button
                  disabled
                  className="px-8 py-3 rounded-2xl text-xs font-bold transition-all shadow-xl bg-slate-800 text-amber-300 border border-amber-500/40 flex items-center gap-2 cursor-not-allowed opacity-80"
                >
                  <Loader2 className="w-4 h-4 animate-spin" /> Connecting Live Voice...
                </button>
              ) : (
                <button
                  onClick={startLiveSession}
                  className="px-8 py-3 rounded-2xl text-xs font-bold transition-all shadow-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-2"
                >
                  <Mic className="w-4 h-4" /> Start Live Voice Session
                </button>
              )}

              {liveState === 'ERROR' && (
                <button
                  onClick={startLiveSession}
                  className="px-4 py-3 rounded-2xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: MEMORY MANAGER */}
        {activeTab === 'memory' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Companion Memory Bank</h2>
                <p className="text-xs text-slate-400">
                  Isolated long-term facts remembered by {companion.name}.
                </p>
              </div>

              <button
                onClick={handleResetMemories}
                className="px-3 py-1.5 rounded-lg bg-rose-950/80 border border-rose-800/60 text-rose-300 hover:bg-rose-900 text-xs font-medium flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Reset Memories
              </button>
            </div>

            {/* Add Memory Form */}
            <form onSubmit={handleAddMemory} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex gap-2">
              <input
                type="text"
                required
                value={newMemoryFact}
                onChange={(e) => setNewMemoryFact(e.target.value)}
                placeholder="Add a new fact (e.g. Likes black coffee, studying calculus)..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500"
              />
              <select
                value={newMemoryCategory}
                onChange={(e) => setNewMemoryCategory(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none"
              >
                <option value="preference">Preference</option>
                <option value="personal">Personal</option>
                <option value="goal">Goal</option>
                <option value="general">General</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </form>

            {/* Memory Items List */}
            <div className="space-y-2">
              {memories.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No memories saved for {companion.name} yet.
                </div>
              ) : (
                memories.map((m) => (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/40">
                        {m.category}
                      </span>
                      <span className="text-slate-200">{m.fact}</span>
                    </div>

                    <button
                      onClick={() => handleDeleteMemory(m.id)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                      title="Delete memory"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 6: VOICE & PERSONALITY */}
        {activeTab === 'voice' && (
          <div className="space-y-6 max-w-2xl animate-fadeIn">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-2xl font-bold text-white">Voice & Tone Settings</h2>
              <p className="text-xs text-slate-400">Select companion voice synthesis and communication style.</p>
            </div>

            <div className="space-y-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5 text-rose-400" /> Voice Synthesis Profile (Male & Female)
                  </label>
                  <span className="text-[10px] text-slate-400">Click Preview to hear audio sample</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {HOORVIA_VOICES.map((v) => {
                    const isSelected = companion.voice === v.id;
                    const isPlaying = previewingVoice === v.id;
                    return (
                      <div
                        key={v.id}
                        onClick={() => {
                          setCompanion({ ...companion, voice: v.id });
                          handleSaveProfile({ voice: v.id });
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-rose-950/40 border-rose-500 text-white shadow-sm ring-1 ring-rose-500/50'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-white">{v.name}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                v.gender === 'female'
                                  ? 'bg-pink-950/60 text-pink-300 border border-pink-800/40'
                                  : v.gender === 'male'
                                  ? 'bg-blue-950/60 text-blue-300 border border-blue-800/40'
                                  : 'bg-purple-950/60 text-purple-300 border border-purple-800/40'
                              }`}
                            >
                              {v.tag}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate">{v.desc}</p>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleToggleVoicePreview(v.id, e)}
                          title={`Preview ${v.name} voice`}
                          className={`p-1.5 px-2 rounded-lg border text-xs font-medium transition-all flex items-center gap-1 shrink-0 ${
                            isPlaying
                              ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                              : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700'
                          }`}
                        >
                          {isPlaying ? (
                            <>
                              <Square className="w-3 h-3 fill-current text-white" />
                              <span className="text-[10px]">Stop</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3 fill-current text-rose-300" />
                              <span className="text-[10px]">Preview</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Primary Language & Script</label>
                <SearchableLanguagePicker
                  selectedLanguage={companion.language || 'English'}
                  onSelectLanguage={(newLang) => {
                    setCompanion({ ...companion, language: newLang });
                    handleSaveProfile({ language: newLang });
                  }}
                  autoMatchLanguage={companion.autoMatchLanguage || false}
                  onToggleAutoMatch={(enabled) => {
                    setCompanion({ ...companion, autoMatchLanguage: enabled });
                    handleSaveProfile({ autoMatchLanguage: enabled });
                  }}
                  readOnly={isMohsinMaryam(user.id, companion.id)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tone & Communication Style</label>
                <select
                  value={companion.tone}
                  onChange={(e) => {
                    const t = e.target.value as CompanionTone;
                    setCompanion({ ...companion, tone: t });
                    handleSaveProfile({ tone: t });
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-rose-500"
                >
                  <option value="Romantic">Romantic</option>
                  <option value="Friendly">Friendly</option>
                  <option value="Educational">Educational</option>
                  <option value="Professional">Professional</option>
                  <option value="Playful">Playful</option>
                  <option value="Formal">Formal</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: AI PROVIDER (BYOK) */}
        {activeTab === 'provider' && (
          <div className="space-y-6 max-w-2xl animate-fadeIn">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Key className="w-6 h-6 text-rose-400" /> Connect Your AI Provider
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Your own API key is required to activate your companion. Connect your Google Gemini API key to activate and chat with your companion. Your key is AES-256 encrypted at rest and never exposed to other users or logged.
              </p>
            </div>

            {providerMessage && (
              <div
                className={`p-4 rounded-xl border text-xs ${
                  providerMessage.type === 'success'
                    ? 'bg-rose-950/60 border-rose-800/60 text-rose-300'
                    : 'bg-red-950/60 border-red-800/60 text-red-300'
                }`}
              >
                {providerMessage.text}
              </div>
            )}

            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Google Gemini Provider</h3>
                  <p className="text-xs text-slate-400">
                    Status: {hasBYOK ? <span className="text-rose-400 font-bold">Connected ({maskedKey})</span> : <span className="text-rose-400 font-bold">Activation Required (No Key Connected)</span>}
                  </p>
                  {hasBYOK && selectedModel && (
                    <p className="text-[11px] text-emerald-400 font-mono mt-1">
                      Active Model: <span className="font-bold">{selectedModel}</span> (Auto-selected for your tier)
                    </p>
                  )}
                </div>

                {hasBYOK && (
                  <button
                    onClick={handleDisconnectApiKey}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                  >
                    Disconnect Key
                  </button>
                )}
              </div>

              {hasBYOK && availableModels.length > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1.5">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                    Discovered Gemini Models on your API Key
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {availableModels.map((m) => (
                      <span
                        key={m}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          m === selectedModel
                            ? 'bg-rose-950/70 text-rose-300 border-rose-700 font-bold'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        {m} {m === selectedModel ? '(Active)' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleConnectApiKey} className="space-y-3 pt-2 border-t border-slate-800">
                <label className="block text-xs font-semibold text-slate-300">
                  {hasBYOK ? 'Replace Gemini API Key' : 'Connect Google Gemini API Key (Required for Activation)'}
                </label>
                <input
                  type="password"
                  value={inputApiKey}
                  onChange={(e) => setInputApiKey(e.target.value)}
                  placeholder="AIzaSy... (Paste Google Gemini API Key)"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-rose-500"
                />
                <button
                  type="submit"
                  disabled={isSavingKey || !inputApiKey.trim()}
                  className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md disabled:opacity-50"
                >
                  {isSavingKey ? 'Verifying Key...' : 'Verify & Connect Key'}
                </button>
              </form>

              {/* Safe Server-Side BYOK Diagnostic Section */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Safe Server-Side Key Diagnostics</h4>
                    <p className="text-[11px] text-slate-400">
                      Verify encryption, storage integrity, and direct Google API authentication without exposing secrets.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunDiagnostic}
                    disabled={isRunningDiagnostic}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 disabled:opacity-50"
                  >
                    {isRunningDiagnostic ? 'Testing...' : 'Run Diagnostics'}
                  </button>
                </div>

                {diagnosticReport && (
                  <div className={`p-4 rounded-xl border text-xs space-y-2.5 ${
                    diagnosticReport.overallHealth === 'HEALTHY'
                      ? 'bg-emerald-950/40 border-emerald-800/60'
                      : 'bg-red-950/40 border-red-800/60'
                  }`}>
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-slate-400">Fingerprint: <strong className="text-slate-200">{diagnosticReport.keyFingerprint}</strong></span>
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        diagnosticReport.overallHealth === 'HEALTHY' ? 'bg-emerald-900/60 text-emerald-300' : 'bg-red-900/60 text-red-300'
                      }`}>
                        {diagnosticReport.overallHealth}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded bg-slate-950/60 border border-slate-800/60">
                        <span className="text-slate-400 block">Credential Storage:</span>
                        <strong className="text-slate-200">{diagnosticReport.credentialExists ? 'Stored (AES-256-GCM)' : 'Not Found'}</strong>
                      </div>
                      <div className="p-2 rounded bg-slate-950/60 border border-slate-800/60">
                        <span className="text-slate-400 block">Decryption Integrity:</span>
                        <strong className="text-slate-200">{diagnosticReport.decryptedSuccessfully ? 'Decrypted Losslessly' : 'Decryption Failed'}</strong>
                      </div>
                      <div className="p-2 rounded bg-slate-950/60 border border-slate-800/60">
                        <span className="text-slate-400 block">Google API Auth:</span>
                        <strong className={diagnosticReport.googleAuthResult === 'PASS' ? 'text-emerald-400' : 'text-rose-400'}>
                          {diagnosticReport.googleAuthResult} (HTTP {diagnosticReport.googleAuthStatus})
                        </strong>
                      </div>
                      <div className="p-2 rounded bg-slate-950/60 border border-slate-800/60">
                        <span className="text-slate-400 block">Live Voice Auth:</span>
                        <strong className={diagnosticReport.liveSessionAuthResult === 'PASS' ? 'text-emerald-400' : 'text-rose-400'}>
                          {diagnosticReport.liveSessionAuthResult}
                        </strong>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-300 pt-1 border-t border-slate-800/60">
                      <strong>Recommendation:</strong> {diagnosticReport.recommendation}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: USAGE & QUOTAS */}
        {activeTab === 'usage' && (
          <div className="space-y-6 max-w-2xl animate-fadeIn">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-2xl font-bold text-white">Usage & Quotas</h2>
              <p className="text-xs text-slate-400">Monitor your daily request counts and live session duration.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
                <span className="text-xs text-slate-400">Requests Used Today</span>
                <p className="text-2xl font-black text-white mt-1">{usage.requestCount}</p>
                <p className="text-[11px] text-slate-500 mt-1">Free Tier Limit: {policy.freeTierDailyLimit}</p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
                <span className="text-xs text-slate-400">Live Voice Duration</span>
                <p className="text-2xl font-black text-white mt-1">{usage.liveMinutesUsed} mins</p>
                <p className="text-[11px] text-slate-500 mt-1">Max session: {policy.maxLiveSessionMinutes} mins</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 9: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-2xl animate-fadeIn">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-2xl font-bold text-white">Account Settings</h2>
              <p className="text-xs text-slate-400">Account profile and isolation status.</p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3 text-xs">
              <div>User ID: <strong className="text-rose-300 font-mono">{user.id}</strong></div>
              <div>Email: <strong className="text-white">{user.email}</strong></div>
              <div>Account Role: <strong className="text-white">{user.role}</strong></div>
              <div>Data Isolation: <strong className="text-rose-400">100% Server-Enforced Isolation</strong></div>
            </div>
          </div>
        )}

        {/* EXPLORE CATALOG MODAL IN DASHBOARD */}
        {isExploreOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-rose-900/60 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Compass className="w-5 h-5 text-rose-400" />
                    Hoorvia Companion Catalog
                  </h3>
                  <p className="text-xs text-slate-400">Select any preset or auto-generate a custom entity to switch your active companion.</p>
                </div>
                <button
                  onClick={() => setIsExploreOpen(false)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search & Tabs */}
              <div className="p-4 bg-slate-950/60 border-b border-slate-800 space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search 35+ companions (e.g. Developer, Teacher, Health, Finance, Girlfriend...)"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    onClick={() => setActiveCategoryTab('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      activeCategoryTab === 'all'
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    All Categories
                  </button>
                  {CATALOG_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategoryTab(cat.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                        activeCategoryTab === cat.id
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {cat.name} ({cat.items.length})
                    </button>
                  ))}
                </div>
              </div>

              {/* Modal Body: Cards */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Custom Entity Auto Generator Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/60 to-rose-950/60 border border-purple-800/40 space-y-3">
                  <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
                    <Sparkles className="w-4 h-4 text-rose-400" /> Auto-Generate Custom Companion
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="Describe anything (e.g. 'A civil engineer who speaks Roman Urdu')"
                      className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500"
                    />
                    <button
                      onClick={handleGenerateCustomCompanionDashboard}
                      disabled={isGeneratingCustom || !customPrompt.trim()}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all disabled:opacity-50 shrink-0"
                    >
                      {isGeneratingCustom ? 'Generating...' : 'Apply AI Companion'}
                    </button>
                  </div>
                </div>

                {/* Grid of Catalog Items */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {searchCatalogItems(searchQuery, activeCategoryTab).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectCatalogPreset(item)}
                      className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-rose-500/60 transition-all cursor-pointer group flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-white group-hover:text-rose-300 transition-colors">
                            {item.title}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-rose-300 border border-rose-900/40 font-mono">
                            {item.suggestedVoice}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                          {item.description}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-500">
                        <span>Category: {item.category}</span>
                        <span className="text-rose-400 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          Select <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
