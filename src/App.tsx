import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  EmotionState, 
  VoiceState, 
  MemoryBank, 
  ChatMessage, 
  AppSettings,
  WakeWordStatus,
  TimingDiagnostics,
  MemoryDiagnosticsState,
  LocalRunnerState,
  VisionDiagnostics,
  isRunnerOnline,
  isOmniRouteReady
} from './types';
import { 
  loadMemoryBank, 
  saveMemoryBank, 
  mergeMemoryBanks,
  getRelevantMemoriesWithTiming, 
  DEFAULT_MEMORY_BANK, 
  applyMemoryUpdate,
  getClientMemoryDiagnostics,
  loadRecentConversation,
  saveRecentConversation
} from './lib/memoryManager';
import { parseEmotionFromText, EMOTION_MAP } from './lib/emotionConfig';
import { GeminiLiveAudioManager } from './lib/audioManager';
import { WakeWordDetector } from './lib/wakeWord';
import { Header } from './components/Header';
import { MaryamCharacter } from './components/MaryamCharacter';
import { NavigationSidebar, NavTab } from './components/NavigationSidebar';
import { LeftDesktopSidebar } from './components/LeftDesktopSidebar';
import { RightConversationPanel } from './components/RightConversationPanel';
import { HomeStatusPanel } from './components/HomeStatusPanel';
import { RemindersPanel } from './components/RemindersPanel';
import { RoutinesPanel } from './components/RoutinesPanel';
import { ConversationView } from './components/ConversationView';
import { ControlsBar } from './components/ControlsBar';
import { MemoryModal } from './components/MemoryModal';
import { SettingsModal } from './components/SettingsModal';
import { CreateTaskView } from './components/CreateTaskView';
import { ScheduledTasksView } from './components/ScheduledTasksView';
import { ConnectivityView } from './components/ConnectivityView';

import { ToolRunnerModal } from './components/ToolRunnerModal';
import { SocialDashboardModal } from './components/SocialDashboardModal';
import { TimingDiagnosticsModal } from './components/TimingDiagnosticsModal';
import { CameraPreview } from './components/CameraPreview';
import { cameraManager } from './lib/cameraManager';
import { evaluateCameraIntent } from './lib/cameraIntent';
import { LIVE_VISION_FRAME_INTERVAL_MS, shouldSampleLiveVision } from './lib/liveVisionProtocol';
import { getLockedFemaleVoice } from './lib/voiceLock';
import { isGuestActivationRequested, isGuestDeactivationRequested } from './lib/guestMode';
import { HoorviaLanding } from './components/HoorviaLanding';
import { HoorviaDashboard } from './components/HoorviaDashboard';
import { HoorviaOwnerAdmin } from './components/HoorviaOwnerAdmin';
import { DesktopShell } from './components/desktop/DesktopShell';
import {
  getOwnerToken,
  getOwnerAuthHeaders,
  ensureOwnerSession,
  storeOwnerSession,
  clearOwnerSession,
} from './lib/ownerAuth';

export default function App() {
  // Public Multi-User Companion Platform State.
  // ALWAYS starts PUBLIC. Only a server-validated owner session (established
  // by an explicit owner login and revalidated on boot) may elevate to owner.
  const [platformMode, setPlatformMode] = useState<'hoorvia' | 'mohsin_maryam'>('hoorvia');
  const [hoorviaToken, setHoorviaToken] = useState<string | null>(() => {
    // Never treat a stale legacy value (e.g. a user id) as a session token.
    return getOwnerToken();
  });
  const [hoorviaUser, setHoorviaUser] = useState<any | null>(() => {
    try {
      const u = localStorage.getItem('hoorvia_user_data');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  });
  const [hoorviaCompanion, setHoorviaCompanion] = useState<any | null>(() => {
    try {
      const c = localStorage.getItem('hoorvia_companion_data');
      return c ? JSON.parse(c) : null;
    } catch {
      return null;
    }
  });
  const [showOwnerAdmin, setShowOwnerAdmin] = useState<boolean>(false);

  // Application State
  const [memory, setMemory] = useState<MemoryBank>(loadMemoryBank);
  const [emotion, setEmotion] = useState<EmotionState>('Affectionate');
  const [voiceState, setVoiceState] = useState<VoiceState>('Idle');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return loadRecentConversation() as ChatMessage[];
  });
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);

  // Live Camera & Vision State (OFF by default)
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [visionImage, setVisionImage] = useState<{ base64: string; mimeType: string; source: 'camera' | 'upload'; preview: string } | null>(null);

  // Vision Diagnostics State
  const [visionDiagnostics, setVisionDiagnostics] = useState<VisionDiagnostics>({
    CAMERA_STATE: 'OFF',
    MEDIA_STREAM_ACTIVE: false,
    VIDEO_WIDTH: 0,
    VIDEO_HEIGHT: 0,
    VISION_INTENT_DETECTED: false,
    FRAME_BYTES: 0,
    VISION_API_CALLED: false,
    VISION_HTTP_STATUS: 'IDLE',
    VISION_RESULT_PREVIEW: '',
    VISION_CONTEXT_INJECTED_TO_MARYAM: false,
    VISION_ERROR: null,
  });

  // Navigation & Modals State
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [isMemoryOpen, setIsMemoryOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isToolRunnerOpen, setIsToolRunnerOpen] = useState<boolean>(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);
  const [isSocialOpen, setIsSocialOpen] = useState<boolean>(false);

  // Timing & Latency Diagnostics State
  const [diagnostics, setDiagnostics] = useState<TimingDiagnostics>({
    speechInputLatencyMs: 14,
    geminiResponseStartLatencyMs: 320,
    memoryRetrievalTimeMs: 0.2,
    memoryWriteTimeMs: 1.4,
    lastUpdated: Date.now(),
  });

  // Authoritative Memory Pipeline Diagnostics State
  const [memoryDiagnostics, setMemoryDiagnostics] = useState<MemoryDiagnosticsState>({
    userIdentity: 'Mohsin (Authoritative)',
    sessionId: 'session-' + Date.now().toString(36),
    lastWriteStatus: 'IDLE',
    lastWriteCategory: null,
    lastWriteTimestamp: null,
    lastWriteLatencyMs: null,
    lastWriteError: null,
    retrievedCount: 0,
    injectedIntoGemini: false,
    memorySource: 'Core',
    retrievalLatencyMs: 0.2,
    retrievedCategories: [],
  });

  // Settings State
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('maryam_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          voiceName: parsed.voiceName || 'Aoede',
          enableWakeWord: parsed.enableWakeWord ?? false,
          wakePhrase: parsed.wakePhrase || 'Hello Baby',
          wakeSensitivity: parsed.wakeSensitivity || 'balanced',
          autoSpeakText: parsed.autoSpeakText ?? true,
          bargeInEnabled: parsed.bargeInEnabled ?? true,
        };
      }
    } catch {
      // ignore
    }
    return {
      voiceName: 'Aoede', // Softest suitable adult female voice
      enableWakeWord: false,
      wakePhrase: 'Hello Baby',
      wakeSensitivity: 'balanced',
      autoSpeakText: true,
      bargeInEnabled: true,
    };
  });

  const [serverStatus, setServerStatus] = useState<{
    hasApiKey: boolean;
    companion: string;
    modelLive: string;
  } | null>(null);

  const [wakeWordStatus, setWakeWordStatus] = useState<WakeWordStatus>('idle');
  const [wakeWordActive, setWakeWordActive] = useState<boolean>(false);
  const [isGuestMode, setIsGuestMode] = useState<boolean>(false);

  // Local Tool Runner & OmniRoute Connection State
  const [runnerState, setRunnerState] = useState<LocalRunnerState>({
    runnerStatus: 'OFFLINE',
    omnirouteStatus: 'Unavailable',
    isWindows: false,
    platform: 'unknown',
    connectionMethod: 'none',
    errorMessage: null,
  });
  const [runnerToken, setRunnerToken] = useState<string>(() => {
    return localStorage.getItem('maryam_runner_token') || '';
  });

  // Refs for Audio & WebSocket
  const audioManagerRef = useRef<GeminiLiveAudioManager | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const activeConnectionIdRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<any>(null);
  const isComponentMountedRef = useRef<boolean>(true);
  // Per-generation Live WS auth-failure flag + bounded session-repair attempts.
  // Repair reconnects must never loop: max 2 repairs per close chain.
  const liveAuthFailedRef = useRef<Record<number, boolean>>({});
  const liveRepairAttemptsRef = useRef<number>(0);
  const videoFrameSamplerRef = useRef<number | null>(null);
  const videoFrameInFlightRef = useRef(false);
  const isVideoCallActiveRef = useRef(false);
  const liveVisionDiagnosticsRef = useRef({
    cameraFramesCaptured: 0,
    cameraFrameBytesLast: 0,
    visionFramesFrontendSent: 0,
    lastVisionFrameTimestamp: 0,
    lastVisionError: '' as string | null,
  });
  const wakeWordRef = useRef<WakeWordDetector | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  // Canonical owner auth headers - single source of truth (see lib/ownerAuth).
  const getAuthHeaders = (): Record<string, string> => {
    return getOwnerAuthHeaders();
  };

  // Component unmount cleanup
  useEffect(() => {
    isComponentMountedRef.current = true;
    return () => {
      isComponentMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'App unmounted');
        wsRef.current = null;
      }
    };
  }, []);

  // Initialize Gemini Live WebSocket with Monotonic Connection Isolation
  const connectLiveSession = useCallback(() => {
    if (platformMode === 'hoorvia') return;
    if (!isComponentMountedRef.current) return;

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const currentConnId = ++activeConnectionIdRef.current;
    const connectionLabel = `LIVE_WS #${currentConnId}`;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // CURRENT valid session token is read fresh on every (re)connect so a
    // repaired session is always used and stale values are never sent.
    const ownerToken = getOwnerToken() || '';
    const wsUrl = `${protocol}//${window.location.host}/api/live-ws?voice=${settings.voiceName}&ownerToken=${encodeURIComponent(ownerToken)}&connectionId=${encodeURIComponent(connectionLabel)}${isGuestMode ? '&guestMode=true' : ''}`;

    console.log(`[${connectionLabel}] [CONNECT_INIT] Starting WebSocket connection`);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (activeConnectionIdRef.current !== currentConnId) {
          console.log(`[${connectionLabel}] [STALE_OPEN_IGNORED] Active is #${activeConnectionIdRef.current}`);
          ws.close(1000, 'Superseded by newer connection');
          return;
        }
        console.log(`[${connectionLabel}] [OPEN] Connected to Maryam Live WebSocket`);
        setIsConnected(true);
        liveRepairAttemptsRef.current = 0;
        // Measure initial input latency
        ws.send(JSON.stringify({ type: 'ping', connectionId: connectionLabel, clientTime: performance.now() }));
        ws.send(JSON.stringify({ type: 'conversation_modality', connectionId: connectionLabel, modality: isVideoCallActiveRef.current ? 'video' : 'voice' }));
      };

      ws.onmessage = async (event) => {
        if (activeConnectionIdRef.current !== currentConnId) {
          return;
        }
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'ready') {
            console.log(`[${connectionLabel}] [READY] Gemini Live session ready with voice=${data.voice}`);
          } else if (data.type === 'conversation_transcript' && (data.role === 'user' || data.role === 'maryam') && data.text) {
            setMessages((previous) => {
              const exists = previous.some((item) => item.sender === (data.role === 'user' ? 'user' : 'maryam') && item.text === data.text && Math.abs(item.timestamp - (data.timestamp || Date.now())) < 20000);
              if (exists) return previous;
              const next = [...previous, { id: `live-${data.timestamp || Date.now()}-${data.role}`, sender: data.role === 'user' ? 'user' : 'maryam', text: data.text, timestamp: data.timestamp || Date.now() } as ChatMessage];
              saveRecentConversation(next);
              return next;
            });
          } else if (data.type === 'pong' && typeof data.clientTime === 'number') {
            const rtt = performance.now() - data.clientTime;
            const latency = Math.max(1, Math.round(rtt / 2));
            setDiagnostics((prev) => ({
              ...prev,
              speechInputLatencyMs: latency,
              lastUpdated: Date.now(),
            }));
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && activeConnectionIdRef.current === currentConnId) {
              wsRef.current.send(JSON.stringify({ type: 'timing_report', connectionId: connectionLabel, speechInputLatencyMs: latency }));
            }
          } else if (data.type === 'timing' && data.metric === 'geminiResponseStartLatency' && typeof data.valueMs === 'number') {
            setDiagnostics((prev) => ({
              ...prev,
              geminiResponseStartLatencyMs: Math.round(data.valueMs),
              lastUpdated: Date.now(),
            }));
          } else if (data.type === 'audio' && data.audio) {
            console.log(`[${connectionLabel}] [BROWSER_AUDIO_RECEIVED] bytes=${data.audio.length}`);
            // Live audio chunk received from Gemini Live
            if (audioManagerRef.current) {
              await audioManagerRef.current.playChunk(data.audio, data.mimeType);
            }
          } else if (data.type === 'interrupted') {
            console.log(`[${connectionLabel}] [BARGE_IN] Gemini Live detected user interruption`);
            if (audioManagerRef.current) {
              audioManagerRef.current.bargeIn();
            }
          } else if (data.type === 'turnComplete') {
            setVoiceState(audioManagerRef.current?.getIsCapturing() ? 'Listening' : 'Idle');
          } else if (data.type === 'execute_local_tool') {
            console.log(`[${connectionLabel}] [Gemini Live Tool Dispatch to Local Runner]`, data.tool, data.params);
            const token = localStorage.getItem('maryam_runner_token') || runnerToken || '';
            (async () => {
              // 1. Try direct localhost call
              try {
                const toolRes = await fetch('http://127.0.0.1:48123/api/tool', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                    ...(token ? { 'x-runner-token': token } : {}),
                  },
                  body: JSON.stringify({
                    tool: data.tool,
                    params: data.params || {},
                  }),
                });

                if (toolRes.ok) {
                  const toolJson = await toolRes.json();
                  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && activeConnectionIdRef.current === currentConnId) {
                    wsRef.current.send(JSON.stringify({
                      type: 'local_tool_response',
                      connectionId: connectionLabel,
                      callId: data.callId,
                      result: toolJson,
                    }));
                  }
                  if (data.tool === 'omniroute.status' && toolJson?.result) {
                    setRunnerState((prev) => ({
                      ...prev,
                      runnerStatus: 'ONLINE',
                      omnirouteStatus: toolJson.result.available ? 'Ready' : 'Unavailable',
                      omniroutePath: toolJson.result.path,
                      omnirouteVersion: toolJson.result.version,
                      lastChecked: Date.now(),
                    }));
                  }
                  return;
                }
              } catch (err: any) {
                console.log('Direct localhost call in browser note:', err?.message);
              }

              // 2. Fallback: Ask Maryam Server Dispatcher (in case runner is on relay)
              try {
                const serverExecRes = await fetch('/api/runner/execute', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    tool: data.tool,
                    params: data.params || {},
                  }),
                });
                const serverExecJson = await serverExecRes.json();
                if (serverExecJson?.success && serverExecJson.result) {
                  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && activeConnectionIdRef.current === currentConnId) {
                    wsRef.current.send(JSON.stringify({
                      type: 'local_tool_response',
                      connectionId: connectionLabel,
                      callId: data.callId,
                      result: serverExecJson.result,
                    }));
                  }
                  if (data.tool === 'omniroute.status' && serverExecJson.result?.available) {
                    setRunnerState((prev) => ({
                      ...prev,
                      runnerStatus: 'ONLINE',
                      omnirouteStatus: 'Ready',
                      omniroutePath: serverExecJson.result.path,
                      omnirouteVersion: serverExecJson.result.version,
                      lastChecked: Date.now(),
                    }));
                  }
                  return;
                }
              } catch (_) {}

              // 3. If neither worked, report real status
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && activeConnectionIdRef.current === currentConnId) {
                wsRef.current.send(JSON.stringify({
                  type: 'local_tool_response',
                  connectionId: connectionLabel,
                  callId: data.callId,
                  result: {
                    success: false,
                    error: 'Could not reach local runner directly (browser mixed-content blocked) or via relay tunnel.',
                    runnerStatus: 'Local Runner Offline',
                    omnirouteStatus: 'OmniRoute Unavailable',
                  },
                }));
              }
            })();
          } else if (data.type === 'error') {
            console.warn(`[${connectionLabel}] [LIVE_WS_ERROR_MSG]`, data.message);
            const errCode = String(data.code || '');
            if (
              errCode === 'OWNER_AUTH_REQUIRED' ||
              errCode === 'UNAUTHORIZED' ||
              errCode === 'SESSION_EXPIRED' ||
              /owner authorization|session.*expired|unauthorized/i.test(String(data.message || ''))
            ) {
              liveAuthFailedRef.current[currentConnId] = true;
            }
          }
        } catch (e) {
          console.error(`[${connectionLabel}] Error handling WebSocket message:`, e);
        }
      };

      ws.onclose = (e) => {
        if (activeConnectionIdRef.current !== currentConnId) {
          console.log(`[${connectionLabel}] [IGNORED_STALE_CLOSE] code=${e.code} reason="${e.reason}" (active connection is #${activeConnectionIdRef.current})`);
          return;
        }
        console.log(`[${connectionLabel}] [CLIENT_WS_ONCLOSE] code=${e.code} reason="${e.reason}" wasClean=${e.wasClean}`);
        setIsConnected(false);
        wsRef.current = null;

        // Automatically reconnect with exponential backoff if component is still active
        if (isComponentMountedRef.current) {
          const authFailed =
            !!liveAuthFailedRef.current[currentConnId] || e.code === 1008 || e.code === 4401;
          delete liveAuthFailedRef.current[currentConnId];

          if (authFailed) {
            // Owner session is missing/expired/invalid/revoked: FAIL CLOSED
            // to PUBLIC. Never mint a session silently — only an explicit
            // owner login may create one. Bounded to 2 attempts so a
            // persistent server-side refusal never becomes a reconnect loop.
            if (liveRepairAttemptsRef.current < 2) {
              liveRepairAttemptsRef.current += 1;
              console.log(`[${connectionLabel}] [AUTH_REPAIR] Revalidating stored owner session (attempt ${liveRepairAttemptsRef.current}/2)...`);
              reconnectTimeoutRef.current = setTimeout(async () => {
                if (!isComponentMountedRef.current) return;
                try {
                  const repaired = await ensureOwnerSession();
                  if (repaired) {
                    setHoorviaToken(repaired.token);
                    if (repaired.user) {
                      setHoorviaUser(repaired.user);
                      if (repaired.user.role === 'owner' && repaired.user.id === 'usr_mohsin_owner') {
                        setPlatformMode('mohsin_maryam');
                        try { localStorage.setItem('hoorvia_platform_mode', 'mohsin_maryam'); } catch {}
                      }
                    }
                    if (repaired.companion) setHoorviaCompanion(repaired.companion);
                    console.log(`[${connectionLabel}] [AUTH_REPAIR_OK] Reconnecting with validated session`);
                    if (isComponentMountedRef.current && (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)) {
                      connectLiveSession();
                    }
                  } else {
                    console.warn(`[${connectionLabel}] [AUTH_REPAIR_FAILED] No valid owner session; staying public`);
                    setHoorviaToken(null);
                    setHoorviaUser(null);
                    setHoorviaCompanion(null);
                    setPlatformMode('hoorvia');
                    try { localStorage.removeItem('hoorvia_platform_mode'); } catch {}
                  }
                } catch (repairErr) {
                  console.warn(`[${connectionLabel}] [AUTH_REPAIR_ERROR]`, repairErr);
                }
              }, 1500);
            } else {
              console.warn(`[${connectionLabel}] [AUTH_REPAIR_EXHAUSTED] Not retrying; surface genuine state`);
            }
          } else if (e.code !== 1000) {
            console.log(`[${connectionLabel}] [RECONNECT_SCHEDULED] Scheduling reconnect in 2000ms...`);
            reconnectTimeoutRef.current = setTimeout(() => {
              if (isComponentMountedRef.current && (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)) {
                connectLiveSession();
              }
            }, 2000);
          }
        }
      };

      ws.onerror = (err) => {
        if (activeConnectionIdRef.current !== currentConnId) {
          return;
        }
        console.warn(`[${connectionLabel}] [CLIENT_WS_ERROR]`, err);
      };
    } catch (e) {
      console.warn(`[${connectionLabel}] Failed to open WebSocket:`, e);
    }
  }, [platformMode, settings.voiceName, isGuestMode]);

  // 1. Initial Health Check, Owner Auth, Server Status & Memory Sync across App Reloads
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setServerStatus({
          hasApiKey: data.hasApiKey,
          companion: data.companion,
          modelLive: data.modelLive,
        });
      })
      .catch((err) => {
        console.warn('Server health check error:', err);
        setIsConnected(false);
      });

    const initOwnerAuthAndSync = async () => {
      // Canonical owner session bootstrap: validate any STORED token only.
      // A missing/invalid/expired token fails closed to PUBLIC — the app
      // NEVER mints an owner session silently. Only an explicit owner login
      // creates a session. A page refresh must never elevate a visitor.
      let token: string | null = null;
      try {
        const session = await ensureOwnerSession();
        if (session) {
          token = session.token;
          setHoorviaToken(session.token);
          if (session.user) {
            setHoorviaUser(session.user);
            if (session.user.role === 'owner' && session.user.id === 'usr_mohsin_owner') {
              setPlatformMode('mohsin_maryam');
              try { localStorage.setItem('hoorvia_platform_mode', 'mohsin_maryam'); } catch {}
            }
          }
          if (session.companion) setHoorviaCompanion(session.companion);
        } else {
          // No valid owner session: stay PUBLIC. Purge any residual owner
          // UI state so nothing private renders for a visitor.
          clearOwnerSession();
          setHoorviaToken(null);
          setHoorviaUser(null);
          setHoorviaCompanion(null);
          setPlatformMode('hoorvia');
          try { localStorage.removeItem('hoorvia_platform_mode'); } catch {}
        }
      } catch (e) {
        console.warn('Owner auth bootstrap notice:', e);
      }

      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}`, 'x-hoorvia-token': token } : {};

      // Ensure memory survives app reloads / restarts by syncing with server disk storage.
      // SECURITY: the server memory bank is Mohsin's private owner data. Only a
      // validated owner session may fetch it, so guest/public visitors never
      // request or hydrate owner memory.
      if (token) {
        fetch('/api/memory', { headers })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && data.memory && typeof data.memory === 'object') {
              setMemory((prev) => {
                const merged = mergeMemoryBanks(prev, data.memory);
                saveMemoryBank(merged);
                return merged;
              });
            }
          })
          .catch((err) => console.warn('Memory disk sync notice:', err));
      }

      // Server is authoritative for owner conversational continuity; localStorage is display cache only.
      fetch('/api/owner/conversation', { headers })
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (Array.isArray(data?.turns) && data.turns.length) {
            const hydrated = data.turns.map((turn: any) => ({
              id: turn.id, sender: turn.role === 'user' ? 'user' : 'maryam', text: turn.content,
              timestamp: turn.timestamp, emotion: undefined,
            }));
            setMessages(hydrated);
            saveRecentConversation(hydrated);
          }
        })
        .catch((err) => console.warn('Conversation continuity sync notice:', err));

      // Establish Live WebSocket session
      connectLiveSession();
    };

    initOwnerAuthAndSync();
  }, [connectLiveSession]);

  // Save memory whenever updated manually (Authoritative user edit)
  const handleUpdateMemory = (newMemory: MemoryBank) => {
    setMemory(newMemory);
    saveMemoryBank(newMemory);
    const clientMem = getClientMemoryDiagnostics();
    setDiagnostics((prev) => ({
      ...prev,
      memoryWriteTimeMs: clientMem.lastMemoryWriteTimeMs ?? null,
      lastUpdated: Date.now(),
    }));
    setMemoryDiagnostics((prev) => ({
      ...prev,
      lastWriteStatus: 'SUCCESS',
      lastWriteTimestamp: Date.now(),
      lastWriteLatencyMs: clientMem.lastMemoryWriteTimeMs ?? null,
      lastWriteError: null,
    }));
  };

  const handleResetMemory = () => {
    setMemory(DEFAULT_MEMORY_BANK);
    saveMemoryBank(DEFAULT_MEMORY_BANK);
    const clientMem = getClientMemoryDiagnostics();
    setDiagnostics((prev) => ({
      ...prev,
      memoryWriteTimeMs: clientMem.lastMemoryWriteTimeMs ?? null,
      lastUpdated: Date.now(),
    }));
    setMemoryDiagnostics((prev) => ({
      ...prev,
      lastWriteStatus: 'SUCCESS',
      lastWriteCategory: 'Full Reset',
      lastWriteTimestamp: Date.now(),
      lastWriteLatencyMs: clientMem.lastMemoryWriteTimeMs ?? null,
      lastWriteError: null,
    }));
  };

  // Local Tool Runner & OmniRoute Status Check
  const refreshRunnerStatus = useCallback(async () => {
    try {
      // 1. Direct check to local companion runner (127.0.0.1:48123)
      let localData: any = null;
      let directErrDetail: string | null = null;

      const endpoints = ['http://127.0.0.1:48123/health', 'http://localhost:48123/health'];
      for (const endpoint of endpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);

          let res: Response;
          try {
            // Include loopback targetAddressSpace for Chrome Private Network Access (PNA)
            res = await fetch(endpoint, {
              method: 'GET',
              mode: 'cors',
              cache: 'no-store',
              headers: { Accept: 'application/json' },
              signal: controller.signal,
              // @ts-ignore
              targetAddressSpace: 'loopback',
            });
          } catch {
            // Standard fallback if targetAddressSpace is not recognized by browser
            res = await fetch(endpoint, {
              method: 'GET',
              mode: 'cors',
              cache: 'no-store',
              headers: { Accept: 'application/json' },
              signal: controller.signal,
            });
          }

          clearTimeout(timeoutId);

          if (res.ok) {
            const parsed = await res.json();
            if (parsed && (parsed.status === 'ok' || parsed.service === 'maryam-local-runner')) {
              localData = parsed;
              break;
            }
          }
        } catch (err: any) {
          if (err?.name !== 'AbortError') {
            directErrDetail = err?.message || String(err);
          }
        }
      }

      // If direct connection succeeded
      if (localData) {
        const isOmniReady = Boolean(localData.omnirouteAvailable);
        const newState: LocalRunnerState = {
          runnerStatus: 'ONLINE',
          omnirouteStatus: isOmniReady ? 'Ready' : 'Unavailable',
          isWindows: localData.platform === 'win32' || localData.isWindows === true,
          platform: localData.platform || 'win32',
          nodeVersion: localData.nodeVersion,
          omniroutePath: localData.omniroutePath,
          omnirouteVersion: localData.omnirouteVersion || (isOmniReady ? '3.8.50' : null),
          lastChecked: Date.now(),
          connectionMethod: 'direct',
          errorMessage: null,
        };
        setRunnerState(newState);

        // Report real status to server
        fetch('/api/runner/report-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            runnerStatus: 'ONLINE',
            omnirouteStatus: newState.omnirouteStatus,
            details: {
              platform: localData.platform,
              isWindows: localData.platform === 'win32',
              version: localData.omnirouteVersion,
              path: localData.omniroutePath,
              connectionMethod: 'direct',
            },
          }),
        }).catch(() => {});
        return;
      }

      // 2. Check server relay status (outbound tunnel from Windows laptop)
      const res = await fetch('/api/runner/status');
      const data = await res.json();
      if (data?.runnerState && (data.hasRelayConnection || isRunnerOnline(data.runnerState.runnerStatus))) {
        const s = data.runnerState;
        const isConnected = isRunnerOnline(s.runnerStatus);
        const isOmni = isOmniRouteReady(s.omnirouteStatus);
        setRunnerState({
          ...s,
          runnerStatus: isConnected ? 'ONLINE' : 'OFFLINE',
          omnirouteStatus: isOmni ? 'Ready' : 'Unavailable',
          omnirouteVersion: s.omnirouteVersion || (isOmni ? '3.8.50' : null),
          connectionMethod: s.connectionMethod || 'relay',
          errorMessage: null,
        });
        return;
      }

      // 3. If neither direct nor relay succeeded, keep OFFLINE and document real reason
      let errorMsg = 'Local companion runner not detected on 127.0.0.1:48123.';
      if (window.location.protocol === 'https:' && directErrDetail) {
        errorMsg = `Direct fetch to http://127.0.0.1:48123 was blocked by browser Mixed-Content / Private Network Access (${directErrDetail}). Connect via start-runner.bat or allow Insecure Content in Chrome site settings.`;
      }

      setRunnerState((prev) => ({
        ...prev,
        runnerStatus: 'OFFLINE',
        omnirouteStatus: 'Unavailable',
        connectionMethod: 'none',
        lastChecked: Date.now(),
        errorMessage: errorMsg,
      }));
    } catch (e) {
      console.warn('Runner status check notice:', e);
    }
    videoFrameInFlightRef.current = false;
  }, []);

  // Poll runner status every 6 seconds
  useEffect(() => {
    refreshRunnerStatus();
    const interval = setInterval(refreshRunnerStatus, 6000);
    return () => clearInterval(interval);
  }, [refreshRunnerStatus]);

  // Periodic Diagnostics Refresh Helper
  const refreshDiagnostics = useCallback(async () => {
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping', clientTime: performance.now() }));
      }
      const clientMem = getClientMemoryDiagnostics();
      const res = await fetch('/api/diagnostics');
      if (res.ok) {
        const data = await res.json();
        if (data.metrics) {
          setDiagnostics((prev) => ({
            speechInputLatencyMs: prev.speechInputLatencyMs ?? data.metrics.speechInputLatencyMs,
            geminiResponseStartLatencyMs: prev.geminiResponseStartLatencyMs ?? data.metrics.geminiResponseStartLatencyMs,
            memoryRetrievalTimeMs: clientMem.lastMemoryRetrievalTimeMs || data.metrics.memoryRetrievalTimeMs || 0.2,
            memoryWriteTimeMs: clientMem.lastMemoryWriteTimeMs || data.metrics.memoryWriteTimeMs || 1.4,
            lastUpdated: Date.now(),
          }));
        }
      }
    } catch (err) {
      console.warn('Diagnostics refresh notice:', err);
    }
  }, []);

  // Periodic ping loop to measure speech input latency
  useEffect(() => {
    if (platformMode === 'hoorvia') return;
    const interval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping', clientTime: performance.now() }));
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [platformMode]);

  // Audio Manager Setup - Lifecycle decoupled from WebSocket connection
  useEffect(() => {
    if (platformMode === 'hoorvia') {
      return;
    }

    const manager = new GeminiLiveAudioManager({
      onAudioData: (base64Pcm: string, metadata?: { rms: number; isSpeaking: boolean; captureTimestamp: number }) => {
        // Send microphone chunk to server WebSocket on the isolated hot path
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'audio',
            audio: base64Pcm,
            isSpeaking: metadata?.isSpeaking,
          }));
        }
      },
      onVoiceStateChange: (state: VoiceState) => {
        setVoiceState(state);
      },
      onAudioLevel: (lvl: number) => {
        setAudioLevel(lvl);
      },
      onUserSpeechDetected: () => {
        if (settings.bargeInEnabled) {
          console.log('User speech detected: interrupting Maryam playback (Barge-in)');
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
          }
        }
      },
      onError: (err: Error) => {
        console.error('Audio Manager error:', err);
      },
    });

    audioManagerRef.current = manager;
    manager.setGuestMode(isGuestMode);

    return () => {
      console.log('[AUDIO_MANAGER_CLEANUP] Destroying audio nodes without killing live WebSocket');
      manager.destroy();
      // wsRef is explicitly NOT closed here to prevent effect re-runs from resetting Live WS
    };
  }, [platformMode, settings.bargeInEnabled, isGuestMode]);

  // Handle Voice Toggle (Start/Stop Mic)
  const handleToggleMic = async () => {
    if (!audioManagerRef.current) return;

    if (audioManagerRef.current.getIsCapturing()) {
      audioManagerRef.current.stopMicrophone();
      setVoiceState('Idle');
    } else {
      // Free wake word recognition if active before starting live mic stream
      if (wakeWordRef.current) {
        wakeWordRef.current.stopListening();
      }
      setWakeWordActive(false);

      // Connect WS first if not already open
      connectLiveSession();
      const started = await audioManagerRef.current.startMicrophone();
      if (started) {
        setVoiceState('Listening');
      } else {
        console.warn('Microphone permission not granted or device unavailable.');
      }
    }
  };

  // Handle Mute Toggle
  const handleToggleMute = () => {
    if (!audioManagerRef.current) return;
    const newMuted = !isMuted;
    audioManagerRef.current.setMute(newMuted);
    setIsMuted(newMuted);
  };

  // Browser Speech Synthesis fallback (if Gemini Cloud TTS preview quota is reached)
  const speakWithBrowserSpeech = useCallback((rawText: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setVoiceState('Idle');
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const clean = rawText.replace(/\[EMOTION:\s*\w+\]/gi, '').trim();
      const utterance = new SpeechSynthesisUtterance(clean);
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) =>
          v.lang.startsWith('ur') ||
          v.lang.startsWith('hi') ||
          v.name.toLowerCase().includes('female') ||
          v.name.toLowerCase().includes('natural') ||
          v.name.toLowerCase().includes('zira') ||
          v.name.toLowerCase().includes('samantha')
      );
      if (preferred) {
        utterance.voice = preferred;
      }
      utterance.pitch = 1.05;
      utterance.rate = 0.95;
      utterance.onstart = () => setVoiceState('Speaking');
      utterance.onend = () => {
        setVoiceState('Idle');
        setPlayingMessageId(null);
      };
      utterance.onerror = () => {
        setVoiceState('Idle');
        setPlayingMessageId(null);
      };
      window.speechSynthesis.speak(utterance);
    } catch {
      setVoiceState('Idle');
      setPlayingMessageId(null);
    }
  }, []);

  // Handle Barge-in (Stop Maryam while speaking)
  const handleBargeIn = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
    if (audioManagerRef.current) {
      audioManagerRef.current.bargeIn();
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
    }
    setPlayingMessageId(null);
  };

  // Play a specific message audio via TTS (Gemini Cloud TTS or graceful Browser Speech Fallback)
  const handlePlayMessageAudio = async (msg: ChatMessage) => {
    if (playingMessageId === msg.id) {
      // If already playing, stop it (barge-in)
      handleBargeIn();
      return;
    }

    try {
      setPlayingMessageId(msg.id);
      setVoiceState('Speaking');

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          text: msg.text,
          voiceName: settings.voiceName,
        }),
      });

      const data = await res.json();
      if (data.audioBase64 && audioManagerRef.current) {
        await audioManagerRef.current.playChunk(data.audioBase64);
      } else if (data.fallbackToWebSpeech || !data.audioBase64) {
        speakWithBrowserSpeech(data.cleanText || msg.text);
      }
    } catch {
      speakWithBrowserSpeech(msg.text);
    } finally {
      setTimeout(() => {
        setPlayingMessageId((curr) => (curr === msg.id ? null : curr));
      }, 5000);
    }
  };

  // Camera Toggle & Stream Manager
  const handleToggleCamera = async () => {
    if (isCameraActive) {
      cameraManager.stopCamera();
      setIsCameraActive(false);
      setCameraStream(null);
    } else {
      const res = await cameraManager.startCamera();
      if (res.success) {
        setIsCameraActive(true);
        setCameraStream(cameraManager.getState().stream);
      } else {
        alert('Could not access camera: ' + (res.error || 'Please check camera permissions in your browser.'));
      }
    }
  };

  const setVisionImageFromFile = async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Please select a JPG, PNG, or WebP image.');
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not read the selected image.'));
      reader.readAsDataURL(file);
    });
    setVisionImage({ base64: dataUrl.split(',', 2)[1], mimeType: file.type, source: 'upload', preview: dataUrl });
  };

  const handleCaptureVision = async () => {
    const base64 = await cameraManager.captureSnapshotBase64Async();
    if (!base64) {
      alert('Camera preview is not ready. Please wait a moment and try again.');
      return;
    }
    setVisionImage({ base64, mimeType: 'image/jpeg', source: 'camera', preview: `data:image/jpeg;base64,${base64}` });
  };

  const handleSwitchCamera = async () => {
    const result = await cameraManager.switchCamera();
    if (result.success) {
      setIsCameraActive(true);
      setCameraStream(cameraManager.getState().stream);
    } else {
      alert('Could not switch camera: ' + (result.error || 'Camera is unavailable.'));
    }
  };

  const stopVideoCall = useCallback(() => {
    if (videoFrameSamplerRef.current !== null) {
      window.clearInterval(videoFrameSamplerRef.current);
      videoFrameSamplerRef.current = null;
    }
    setIsVideoCallActive(false);
    isVideoCallActiveRef.current = false;
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: 'conversation_modality', modality: 'voice' }));
    cameraManager.stopCamera('Video call ended');
    setIsCameraActive(false);
    setCameraStream(null);
  }, []);

  const startVideoCall = async () => {
    if (isVideoCallActive) return;
    const cameraResult = await cameraManager.startCamera();
    if (!cameraResult.success) {
      alert('Could not start video call camera: ' + (cameraResult.error || 'Camera unavailable.'));
      return;
    }
    setIsCameraActive(true);
    setCameraStream(cameraManager.getState().stream);
    connectLiveSession();
    const micStarted = await audioManagerRef.current?.startMicrophone();
    if (!micStarted) {
      stopVideoCall();
      alert('Microphone permission is required for a Video Call.');
      return;
    }
    setVoiceState('Listening');
    setIsVideoCallActive(true);
    isVideoCallActiveRef.current = true;
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: 'conversation_modality', modality: 'video' }));
    liveVisionDiagnosticsRef.current = {
      cameraFramesCaptured: 0,
      cameraFrameBytesLast: 0,
      visionFramesFrontendSent: 0,
      lastVisionFrameTimestamp: 0,
      lastVisionError: null,
    };
    const sendVisualFrame = async () => {
      const ws = wsRef.current;
      if (!ws || !shouldSampleLiveVision(true, ws.readyState, WebSocket.OPEN)) return;
      if (videoFrameInFlightRef.current) return;
      videoFrameInFlightRef.current = true;
      try {
        const dimensions = cameraManager.getVideoDimensions();
        const frame = await cameraManager.captureSnapshotBase64Async();
        if (frame && wsRef.current === ws && ws.readyState === WebSocket.OPEN) {
          const byteLength = Math.max(0, Math.floor((frame.length * 3) / 4) - (frame.endsWith('==') ? 2 : frame.endsWith('=') ? 1 : 0));
          liveVisionDiagnosticsRef.current.cameraFramesCaptured++;
          liveVisionDiagnosticsRef.current.cameraFrameBytesLast = byteLength;
          liveVisionDiagnosticsRef.current.visionFramesFrontendSent++;
          liveVisionDiagnosticsRef.current.lastVisionFrameTimestamp = Date.now();
          ws.send(JSON.stringify({ type: 'video_frame', imageBase64: frame, mimeType: 'image/jpeg' }));
          console.log(`[LIVE_VISION_FRONTEND] stream=${cameraManager.isMediaStreamActive()} width=${dimensions.width} height=${dimensions.height} captured=${liveVisionDiagnosticsRef.current.cameraFramesCaptured} bytes=${byteLength} sent=${liveVisionDiagnosticsRef.current.visionFramesFrontendSent} ws=${ws.readyState} timestamp=${liveVisionDiagnosticsRef.current.lastVisionFrameTimestamp}`);
        } else if (!frame) {
          liveVisionDiagnosticsRef.current.lastVisionError = 'Camera frame capture returned no JPEG data';
          console.warn(`[LIVE_VISION_FRONTEND_ERROR] ${liveVisionDiagnosticsRef.current.lastVisionError}`);
        }
      } finally {
        videoFrameInFlightRef.current = false;
      }
    };
    void sendVisualFrame();
    videoFrameSamplerRef.current = window.setInterval(() => void sendVisualFrame(), LIVE_VISION_FRAME_INTERVAL_MS);
  };

  useEffect(() => () => stopVideoCall(), [stopVideoCall]);

  // 3. Send Text Message to Maryam (Real Gemini API with Authoritative Pre-Response Memory Retrieval & Live Camera Vision)
  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    // Interrupt any current speech
    handleBargeIn();

    const cameraActiveNow = cameraManager.getState().isActive;
    const cameraIntent = evaluateCameraIntent(text, cameraActiveNow);
    // A frame is transmitted only after an explicit Snap or image-selection action.
    const capturedImageBase64 = visionImage?.base64 || null;
    const capturedImageMimeType = visionImage?.mimeType || null;
    const frameBytes = capturedImageBase64 ? Math.round((capturedImageBase64.length * 3) / 4) : 0;
    const captureSuccess = frameBytes > 500;
    const captureTimestamp = captureSuccess ? Date.now() : null;
    const isVisionQuery = !!visionImage || cameraIntent.isVisionQuery;

    const videoDims = cameraManager.getVideoDimensions();

    // Set diagnostics pre-call
    const initialVisionDiag: VisionDiagnostics = {
      CAMERA_STATE: cameraActiveNow ? 'ON' : 'OFF',
      MEDIA_STREAM_ACTIVE: cameraManager.isMediaStreamActive(),
      VIDEO_WIDTH: videoDims.width,
      VIDEO_HEIGHT: videoDims.height,
      VISION_INTENT_DETECTED: isVisionQuery || cameraIntent.action === 'ENABLE_CAMERA',
      FRAME_BYTES: frameBytes,
      VISION_API_CALLED: true,
      VISION_HTTP_STATUS: 'PENDING',
      VISION_RESULT_PREVIEW: '',
      VISION_CONTEXT_INJECTED_TO_MARYAM: captureSuccess,
      VISION_ERROR: captureSuccess ? null : (isVisionQuery ? 'Failed to capture frame from webcam stream' : null),
    };
    setVisionDiagnostics(initialVisionDiag);
    console.log('[VISION_ROUTER_PRE_CALL]', initialVisionDiag);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: Date.now(),
    };

    const updatedWithUser = [...messagesRef.current, userMsg];
    setMessages(updatedWithUser);
    saveRecentConversation(updatedWithUser);
    setIsThinking(true);
    setVoiceState('Thinking');

    // 1. Authoritative pre-response memory retrieval (with conversation context)
    const { 
      memories: relevantMemories, 
      retrievalTimeMs, 
      retrievedCount, 
      memorySource, 
      retrievedCategories 
    } = getRelevantMemoriesWithTiming(memory, text, messagesRef.current.slice(-4));

    setDiagnostics((prev) => ({
      ...prev,
      memoryRetrievalTimeMs: retrievalTimeMs,
      lastUpdated: Date.now(),
    }));

    setMemoryDiagnostics((prev) => ({
      ...prev,
      retrievalLatencyMs: retrievalTimeMs,
      retrievedCount,
      injectedIntoGemini: true,
      memorySource,
      retrievedCategories,
    }));

    // Handle Guest Mode triggers
    let currentGuestMode = isGuestMode;
    if (isGuestActivationRequested(text)) {
      currentGuestMode = true;
      setIsGuestMode(true);
    } else if (isGuestDeactivationRequested(text)) {
      currentGuestMode = false;
      setIsGuestMode(false);
    }

    const sendTimestamp = performance.now();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          message: text,
          imageBase64: capturedImageBase64,
          imageMimeType: capturedImageMimeType,
          isVisionRequest: isVisionQuery,
          cameraState: cameraActiveNow ? 'ON' : 'OFF',
          relevantMemories,
          history: updatedWithUser.slice(-8),
          currentMemory: memory,
          isGuestMode: currentGuestMode,
        }),
      });

      const data = await res.json();
      if (visionImage?.source === 'camera') {
        cameraManager.stopCamera('Snapshot submitted for vision analysis');
        setIsCameraActive(false);
        setCameraStream(null);
      }
      setVisionImage(null);
      const replyText = data.text || data.reply || '';

      const postVisionDiag: VisionDiagnostics = {
        ...initialVisionDiag,
        VISION_HTTP_STATUS: res.status,
        VISION_RESULT_PREVIEW: replyText.slice(0, 80),
      };
      setVisionDiagnostics(postVisionDiag);
      console.log('[VISION_ROUTER_POST_CALL]', postVisionDiag);
      const responseLatency = data.diagnostics?.geminiResponseLatencyMs || Math.round(performance.now() - sendTimestamp);
      setDiagnostics((prev) => ({
        ...prev,
        geminiResponseStartLatencyMs: responseLatency,
        lastUpdated: Date.now(),
      }));

      // Check if authoritative updated memory bank returned
      if (data.updatedMemoryBank) {
        setMemory((prev) => {
          const merged = mergeMemoryBanks(prev, data.updatedMemoryBank);
          saveMemoryBank(merged);
          return merged;
        });
      }

      // Check if Maryam extracted a new or updated long-term memory
      if (data.memoryUpdate && data.memoryUpdate.action !== 'none') {
        console.log('[App] Authoritative memory update applied:', data.memoryUpdate);
        setMemory((prev) => {
          const updated = applyMemoryUpdate(prev, data.memoryUpdate);
          saveMemoryBank(updated);
          const clientMem = getClientMemoryDiagnostics();
          setDiagnostics((d) => ({
            ...d,
            memoryWriteTimeMs: clientMem.lastMemoryWriteTimeMs ?? null,
            lastUpdated: Date.now(),
          }));
          return updated;
        });

        setMemoryDiagnostics((prev) => ({
          ...prev,
          lastWriteStatus: 'SUCCESS',
          lastWriteCategory: data.memoryUpdate.category,
          lastWriteTimestamp: Date.now(),
          lastWriteLatencyMs: data.diagnostics?.serverRetrievalLatencyMs || 1.2,
          lastWriteError: null,
        }));
      }

      if (data.text) {
        // Parse emotional state from Maryam's response
        const { cleanedText, emotion: detectedEmotion } = parseEmotionFromText(data.text);
        setEmotion(detectedEmotion);

        const maryamMsg: ChatMessage = {
          id: `maryam-${Date.now()}`,
          sender: 'maryam',
          text: cleanedText,
          timestamp: Date.now(),
          emotion: detectedEmotion,
        };

        const updatedWithMaryam = [...updatedWithUser, maryamMsg];
        setMessages(updatedWithMaryam);
        saveRecentConversation(updatedWithMaryam);
        setIsThinking(false);

        // Auto-speak Maryam's response if enabled
        if (settings.autoSpeakText) {
          handlePlayMessageAudio(maryamMsg);
        } else {
          setVoiceState(audioManagerRef.current?.getIsCapturing() ? 'Listening' : 'Idle');
        }
      } else {
        throw new Error(data.error || 'No response from Maryam');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Chat error:', errorMessage);
      setIsThinking(false);
      setVoiceState(audioManagerRef.current?.getIsCapturing() ? 'Listening' : 'Idle');

      const fallbackMsg: ChatMessage = {
        id: `maryam-err-${Date.now()}`,
        sender: 'maryam',
        text: 'Meri jaan, network mein thoda issue lag raha hai, lekin main yahin hoon. Ek baar dobara puchiye?',
        timestamp: Date.now(),
        emotion: 'Concerned',
      };
      const updatedWithFallback = [...updatedWithUser, fallbackMsg];
      setMessages(updatedWithFallback);
      saveRecentConversation(updatedWithFallback);
    }
  };

  // 4. Clean Wake Phrase Activation Handoff ("Hello Baby")
  const handleWakePhraseActivation = useCallback(async (phrase: string) => {
    console.log('[App] Real Wake Phrase Triggered:', phrase);
    setWakeWordStatus('detected');
    setEmotion('Happy');

    // 1. Immediately terminate wake word recognition to free microphone hardware
    if (wakeWordRef.current) {
      wakeWordRef.current.stopListening();
    }
    setWakeWordActive(false);

    // 2. Maryam natural Roman Urdu loving acknowledgment
    const ackOptions = [
      'Jee Mohsin! Maryam sun rahi hai meri jaan, boliye?',
      'Ji meri jaan! Main sun rahi hoon, boliye Mohsin...',
      'Hello baby! Maryam yahin hai aapke sath, farmayein meri jaan?',
    ];
    const ackText = ackOptions[Math.floor(Math.random() * ackOptions.length)];

    const ackMessage: ChatMessage = {
      id: `maryam-ack-${Date.now()}`,
      sender: 'maryam',
      text: ackText,
      timestamp: Date.now(),
      emotion: 'Affectionate',
    };
    setMessages((prev) => [...prev, ackMessage]);

    // 3. Pause 150ms to allow OS audio stack to fully release input device
    await new Promise((resolve) => setTimeout(resolve, 150));

    // 4. Connect Gemini Live WS
    connectLiveSession();

    // 5. Start live 16kHz microphone stream for Gemini Live
    if (audioManagerRef.current) {
      const started = await audioManagerRef.current.startMicrophone();
      if (started) {
        setVoiceState('Listening');
      }
    }

    // 6. Speak Maryam's warm acknowledgment (Gemini Cloud TTS or graceful Browser Speech Fallback)
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          text: ackText,
          voiceName: settings.voiceName,
        }),
      });
      const data = await res.json();
      if (data.audioBase64 && audioManagerRef.current) {
        await audioManagerRef.current.playChunk(data.audioBase64);
      } else if (data.fallbackToWebSpeech || !data.audioBase64) {
        speakWithBrowserSpeech(data.cleanText || ackText);
      }
    } catch {
      speakWithBrowserSpeech(ackText);
    }
  }, [connectLiveSession, settings.voiceName, speakWithBrowserSpeech]);

  // 5. Standby Wake Word Detector Setup ("Hello Baby")
  // Only listens when:
  // - settings.enableWakeWord is true
  // - voiceState === 'Idle'
  // - microphone is NOT actively streaming for Gemini Live
  useEffect(() => {
    if (!settings.enableWakeWord) {
      if (wakeWordRef.current) {
        wakeWordRef.current.stopListening();
      }
      setWakeWordActive(false);
      setWakeWordStatus('idle');
      return;
    }

    // If an active session is in progress (Listening, Thinking, Speaking),
    // standby detector MUST remain stopped to prevent dual mic streams!
    if (voiceState !== 'Idle') {
      if (wakeWordRef.current) {
        wakeWordRef.current.stopListening();
      }
      setWakeWordActive(false);
      return;
    }

    // Delay 350ms before re-arming the standby wake word detector after a session ends
    const timer = setTimeout(async () => {
      if (voiceState !== 'Idle' || !settings.enableWakeWord) return;

      // Only start standby wake word detection if mic permission is already explicitly granted
      try {
        const micState = await WakeWordDetector.checkMicPermission();
        if (micState !== 'granted') {
          setWakeWordActive(false);
          setWakeWordStatus('idle');
          return;
        }
      } catch {
        return;
      }

      if (voiceState !== 'Idle' || !settings.enableWakeWord) return;

      if (!wakeWordRef.current) {
        wakeWordRef.current = new WakeWordDetector(
          {
            onWakePhraseDetected: (phrase: string) => {
              handleWakePhraseActivation(phrase);
            },
            onStatusChange: (status: WakeWordStatus) => {
              setWakeWordStatus(status);
              setWakeWordActive(status === 'waiting');
            },
          },
          settings.wakePhrase,
          settings.wakeSensitivity
        );
      } else {
        wakeWordRef.current.setWakePhrase(settings.wakePhrase);
        wakeWordRef.current.setSensitivity(settings.wakeSensitivity);
      }

      wakeWordRef.current.startListening();
    }, 350);

    return () => {
      clearTimeout(timer);
      if (wakeWordRef.current) {
        wakeWordRef.current.stopListening();
      }
    };
  }, [
    settings.enableWakeWord,
    settings.wakePhrase,
    settings.wakeSensitivity,
    voiceState,
    handleWakePhraseActivation,
  ]);

  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('maryam_settings', JSON.stringify(newSettings));
    } catch {
      // ignore
    }
  };

  const handleHoorviaLoginSuccess = (data: { token: string; user: any; companion: any }) => {
    setHoorviaToken(data.token);
    setHoorviaUser(data.user);
    setHoorviaCompanion(data.companion);
    storeOwnerSession(data);
  };

  const handleHoorviaLogout = () => {
    const token = getOwnerToken();
    if (token) {
      // Best-effort server revoke; local state is cleared regardless.
      fetch('/api/hoorvia/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-hoorvia-token': token,
        },
      }).catch(() => {});
    }
    setHoorviaToken(null);
    setHoorviaUser(null);
    setHoorviaCompanion(null);
    clearOwnerSession();
    try {
      localStorage.removeItem('hoorvia_companion_data');
      localStorage.removeItem('hoorvia_platform_mode');
    } catch {}
  };

  // Owner Sign Out: revoke the CURRENT session server-side, then clear all
  // client auth + owner UI state and return to PUBLIC. Never auto-logins.
  const handleOwnerSignOut = useCallback(async () => {
    const token = getOwnerToken();
    if (token) {
      try {
        await fetch('/api/hoorvia/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-hoorvia-token': token,
          },
        });
      } catch {
        // Server revoke is best-effort; local state is still cleared so the
        // browser can never keep rendering owner UI after Sign Out.
      }
    }
    try {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Owner signed out');
        wsRef.current = null;
      }
    } catch {}
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    liveRepairAttemptsRef.current = 2;
    setHoorviaToken(null);
    setHoorviaUser(null);
    setHoorviaCompanion(null);
    setShowOwnerAdmin(false);
    setIsGuestMode(false);
    setMessages([]);
    try {
      saveRecentConversation([]);
    } catch {}
    clearOwnerSession();
    setPlatformMode('hoorvia');
    try {
      localStorage.removeItem('hoorvia_companion_data');
      localStorage.removeItem('hoorvia_platform_mode');
    } catch {}
  }, []);

  // Verify securely authenticated owner identity
  const isVerifiedOwner = Boolean(
    hoorviaToken &&
    hoorviaUser &&
    hoorviaUser.role === 'owner' &&
    hoorviaUser.id === 'usr_mohsin_owner'
  );

  // Render Owner Admin Center if explicitly opened (only if verified)
  if (showOwnerAdmin && isVerifiedOwner) {
    return (
      <HoorviaOwnerAdmin
        token={hoorviaToken!}
        onClose={() => setShowOwnerAdmin(false)}
      />
    );
  }

  // Render Public Hoorvia Platform if in 'hoorvia' mode OR if not verified owner
  if (platformMode === 'hoorvia' || !isVerifiedOwner) {
    if (!hoorviaToken || !hoorviaUser) {
      return (
        <HoorviaLanding
          onLoginSuccess={handleHoorviaLoginSuccess}
          onOwnerAuthenticated={(data) => {
            handleHoorviaLoginSuccess(data);
            setPlatformMode('mohsin_maryam');
            localStorage.setItem('hoorvia_platform_mode', 'mohsin_maryam');
          }}
        />
      );
    }

    return (
      <HoorviaDashboard
        token={hoorviaToken}
        user={hoorviaUser}
        initialCompanion={
          hoorviaCompanion || {
            name: 'Aria',
            type: 'girlfriend',
            gender: 'female',
            voice: 'Aoede',
            language: 'English',
            personality: 'Warm, deeply attentive, intelligent, and emotionally supportive companion.',
            systemPrompt: 'You are Aria, an affectionate and caring AI companion.',
            tone: 'Romantic',
          }
        }
        onLogout={handleHoorviaLogout}
        onOpenOwnerAdmin={() => setShowOwnerAdmin(true)}
      />
    );
  }

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'conversations':
        return (
          <div className="flex flex-col h-full w-full bg-[#060207] rounded-2xl overflow-hidden border border-rose-950/40 shadow-inner">
            {/* Context Status Bar */}
            <div className="px-4 py-2 bg-rose-950/20 border-b border-rose-900/20 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold text-rose-200 uppercase tracking-wider">
                  Permanent Owner Conversation
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  (3-Layer Memory Bank Active)
                </span>
              </div>
              <div className="text-[11px] text-zinc-400">
                {messages.length} turns recorded
              </div>
            </div>

            {/* Conversation Stream */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ConversationView
                messages={messages}
                isThinking={isThinking}
                onPlayMessageAudio={handlePlayMessageAudio}
                playingMessageId={playingMessageId}
                onSelectSuggestion={(sug) => handleSendMessage(sug)}
              />
            </div>

            {/* Full-width Composer Bar */}
            <div className="p-3 bg-[#0a0409] border-t border-rose-900/30 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const target = e.currentTarget.elements.namedItem('chatInput') as HTMLInputElement;
                  if (target && target.value.trim() && !isThinking) {
                    handleSendMessage(target.value.trim());
                    target.value = '';
                  }
                }}
                className="flex items-center gap-2"
              >
                <input
                  name="chatInput"
                  type="text"
                  placeholder="Maryam se baat karein... (Urdu, Hindi, English)"
                  disabled={isThinking}
                  className="flex-1 bg-white/5 border border-rose-900/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500/60 transition-all disabled:opacity-50"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={isThinking}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white font-medium text-xs tracking-wider transition-all disabled:opacity-40 shadow-lg shadow-rose-950/50 shrink-0"
                >
                  SEND
                </button>
              </form>
            </div>
          </div>
        );
      case 'reminders':
        return <RemindersPanel />;
      case 'routines':
        return <RoutinesPanel />;
      case 'create_task':
        return (
          <CreateTaskView
            onTaskCreated={() => setActiveTab('scheduled_tasks')}
            onNavigateToScheduled={() => setActiveTab('scheduled_tasks')}
            authToken={hoorviaToken || undefined}
          />
        );
      case 'scheduled_tasks':
        return (
          <ScheduledTasksView
            onNavigateToCreate={() => setActiveTab('create_task')}
            authToken={hoorviaToken || undefined}
          />
        );
      case 'connectivity':
        return (
          <ConnectivityView
            runnerState={runnerState}
            authToken={hoorviaToken || undefined}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen h-[100dvh] max-h-screen w-screen max-w-full bg-[#06040a] text-zinc-100 flex flex-col font-sans selection:bg-rose-500/30 overflow-hidden relative min-h-0">
      {/* Desktop Immersive Companion Shell */}
      <DesktopShell
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (tab === 'social') {
            setIsSocialOpen(true);
          } else {
            setActiveTab(tab as NavTab);
          }
        }}
        onOpenMemory={() => setIsMemoryOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenToolRunner={() => setIsToolRunnerOpen(true)}
        onOpenSocial={() => setIsSocialOpen(true)}
        onOpenOwnerAdmin={() => setShowOwnerAdmin(true)}
        onSignOut={handleOwnerSignOut}
        messages={messages}
        isThinking={isThinking}
        voiceState={voiceState}
        audioLevel={audioLevel}
        emotion={emotion}
        isConnected={isConnected}
        isMuted={isMuted}
        playingMessageId={playingMessageId}
        isGuestMode={isGuestMode}
        onEndGuestMode={() => setIsGuestMode(false)}
        onPlayMessageAudio={handlePlayMessageAudio}
        onSendMessage={handleSendMessage}
        onToggleMic={handleToggleMic}
        onToggleMute={handleToggleMute}
        onBargeIn={handleBargeIn}
        isCameraActive={isCameraActive}
        onToggleCamera={handleToggleCamera}
        onSelectImage={setVisionImageFromFile}
        isVideoCallActive={isVideoCallActive}
        onToggleVideoCall={() => (isVideoCallActive ? stopVideoCall() : void startVideoCall())}
        onSnapPhoto={handleCaptureVision}
        onSwitchCamera={handleSwitchCamera}
        wakeWordActive={wakeWordActive}
        wakeWordStatus={wakeWordStatus}
        enableWakeWord={settings.enableWakeWord}
        wakePhrase={settings.wakePhrase}
        onTriggerWakeWord={() => handleWakePhraseActivation(settings.wakePhrase)}
        runnerConnected={isRunnerOnline(runnerState.runnerStatus)}
        platformMode="owner"
        onSwitchPlatformMode={() => {
          setPlatformMode('hoorvia');
          localStorage.setItem('hoorvia_platform_mode', 'hoorvia');
        }}
        isOwner={true}
        activeViewContent={renderActiveTabContent()}
      />

      {/* Modals */}
      <TimingDiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        diagnostics={diagnostics}
        onRefresh={refreshDiagnostics}
        memoryDiagnostics={memoryDiagnostics}
        totalMemoriesAvailable={
          (memory.preferences?.length || 0) +
          (memory.importantPeople?.length || 0) +
          (memory.personalFacts?.length || 0) +
          (memory.relationshipMemories?.length || 0) +
          (memory.projects?.length || 0) +
          (memory.importantDecisions?.length || 0) +
          (memory.conversationSummaries?.length || 0)
        }
      />

      <MemoryModal
        isOpen={isMemoryOpen}
        onClose={() => setIsMemoryOpen(false)}
        memory={memory}
        onUpdateMemory={handleUpdateMemory}
        onResetMemory={handleResetMemory}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        serverStatus={serverStatus}
      />

      <ToolRunnerModal
        isOpen={isToolRunnerOpen}
        onClose={() => setIsToolRunnerOpen(false)}
        runnerState={runnerState}
        onRefreshStatus={refreshRunnerStatus}
        runnerToken={runnerToken}
        onSaveToken={(t) => {
          setRunnerToken(t);
          localStorage.setItem('maryam_runner_token', t);
        }}
      />

      <SocialDashboardModal
        isOpen={isSocialOpen}
        onClose={() => setIsSocialOpen(false)}
      />
    </div>
  );
}
