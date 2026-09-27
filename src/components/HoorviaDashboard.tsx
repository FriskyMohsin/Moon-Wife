import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Phone,
  ListTodo,
  Bell,
  Brain,
  FolderOpen,
  BarChart2,
  Settings,
  LogOut,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Square,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Key,
  Globe,
  RefreshCw,
  PhoneOff,
  Loader2,
  ShieldCheck,
  Pencil,
  Download,
  Copy,
  Image as ImageIcon,
  FileText,
  ChevronRight,
  Video,
} from 'lucide-react';
import { GeminiLiveAudioManager } from '../lib/audioManager';
import { CompanionProfile, CompanionVoice, CompanionTone, isMohsinMaryam } from '../lib/hoorviaTypes';
import { HOORVIA_VOICES, playVoiceSample } from '../lib/voicePreview';
import { SearchableLanguagePicker } from './SearchableLanguagePicker';
import { PariBrand } from './PariBrand';
import { isRtlLanguage, getLanguageByCodeOrName } from '../lib/languageCatalog';
import { GEMINI_KEY_TUTORIAL_VIDEO_URL } from '../lib/pariConfig';
import { subscribePush, unsubscribePush, isPushSubscribed } from '../lib/pwaClient';

const CLIENT_API = '/api/hoorvia/client';

type TabId = 'chat' | 'voice' | 'tasks' | 'reminders' | 'memory' | 'files' | 'usage' | 'settings';

interface TaskItem {
  id: string;
  title: string;
  detail?: string;
  dueAt?: string | null;
  repeat: 'once' | 'daily' | 'weekly';
  priority: 'low' | 'med' | 'high';
  status: 'pending' | 'done';
}

interface ReminderItem {
  id: string;
  title: string;
  text?: string;
  dueAt?: string | null;
  repeat?: string;
}

interface ChatMsg {
  sender: 'user' | 'companion';
  text: string;
  time: string;
}

interface ApiKeyEntry {
  model: string;
  maskedKey: string;
}

interface ClientUsage {
  today: { chat: number; images: number; files: number; liveMinutes: number };
  week: { chat: number; images: number; files: number; liveMinutes: number };
  limits: { chat: number; images: number; files: number; liveMinutes: number };
}

interface HoorviaDashboardProps {
  token: string;
  user: any;
  initialCompanion: CompanionProfile;
  onLogout: () => void;
  onOpenOwnerAdmin?: () => void;
}

const authHeaders = (token: string): HeadersInit => ({ 'X-Hoorvia-Token': token });

const fmtTime = (ts?: string | number | Date) => {
  try {
    const d = ts ? new Date(ts) : new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
};

export const HoorviaDashboard: React.FC<HoorviaDashboardProps> = ({
  token,
  user,
  initialCompanion,
  onLogout,
  onOpenOwnerAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('chat');

  const [companion, setCompanion] = useState<CompanionProfile>(() => ({
    ...initialCompanion,
    name: 'Pari AI',
  }));
  const [memories, setMemories] = useState<any[]>([]);
  const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
  const [clientUsage, setClientUsage] = useState<ClientUsage | null>(null);

  // Chat state
  const [chatInput, setChatInput] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [isSendingChat, setIsSendingChat] = useState<boolean>(false);
  const [chatNotice, setChatNotice] = useState<{ kind: 'limit' | 'key' | 'error'; text: string } | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isRecordingNote, setIsRecordingNote] = useState<boolean>(false);
  const [threadLoaded, setThreadLoaded] = useState<boolean>(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Tasks state
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState<boolean>(false);
  const [taskTitle, setTaskTitle] = useState<string>('');
  const [taskDetail, setTaskDetail] = useState<string>('');
  const [taskDueAt, setTaskDueAt] = useState<string>('');
  const [taskRepeat, setTaskRepeat] = useState<'once' | 'daily' | 'weekly'>('once');
  const [taskPriority, setTaskPriority] = useState<'low' | 'med' | 'high'>('med');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskMsg, setTaskMsg] = useState<string | null>(null);

  // Reminders state
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [remindersFromTasks, setRemindersFromTasks] = useState<boolean>(false);

  // Memory form state
  const [newMemoryFact, setNewMemoryFact] = useState<string>('');
  const [newMemoryCategory, setNewMemoryCategory] = useState<string>('preference');

  // Files & Studio state
  const [fileType, setFileType] = useState<'pptx' | 'docx' | 'pdf' | 'epub' | 'xlsx'>('pptx');
  const [fileTitle, setFileTitle] = useState<string>('');
  const [fileOutline, setFileOutline] = useState<string>('');
  const [fileLoading, setFileLoading] = useState<boolean>(false);
  const [fileResult, setFileResult] = useState<{ fileId: string; downloadUrl: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [studioTopic, setStudioTopic] = useState<string>('');
  const [studioPlatform, setStudioPlatform] = useState<string>('Instagram');
  const [studioLoading, setStudioLoading] = useState<boolean>(false);
  const [studioResult, setStudioResult] = useState<{ imageUrl: string; caption: string; hashtags: string } | null>(null);
  const [studioError, setStudioError] = useState<string | null>(null);

  // Settings state
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [newKeyModel, setNewKeyModel] = useState<string>('gemini-2.0-flash');
  const [newKeyValue, setNewKeyValue] = useState<string>('');
  const [isSavingKey, setIsSavingKey] = useState<boolean>(false);
  const [keyMsg, setKeyMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pushEnabled, setPushEnabled] = useState<boolean>(false);
  const [pushBusy, setPushBusy] = useState<boolean>(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  // Live Voice state & engine (existing GeminiLiveAudioManager + /api/hoorvia/live-ws infra)
  type LiveSessionState = 'IDLE' | 'REQUESTING_MIC' | 'CONNECTING' | 'LISTENING' | 'SPEAKING' | 'ERROR';
  const [liveState, setLiveState] = useState<LiveSessionState>('IDLE');
  const [liveStatus, setLiveStatus] = useState<string>('Tap the call button and just talk to Pari AI.');
  const [liveError, setLiveError] = useState<string | null>(null);
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied' | 'unavailable'>('prompt');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [liveDuration, setLiveDuration] = useState<number>(0);
  const [connectedLiveModel, setConnectedLiveModel] = useState<string | null>(null);

  const audioManagerRef = useRef<GeminiLiveAudioManager | null>(null);
  const liveWsRef = useRef<WebSocket | null>(null);
  const durationTimerRef = useRef<any>(null);

  const hasBYOK = keys.length > 0 || user.role === 'owner';

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

  // ---------- Live voice engine (unchanged infra, reskinned entry) ----------

  const stopLiveSession = (notifyUser: boolean = true, source: string = 'user_action') => {
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
      } catch {}
    }
    if (audioManagerRef.current) {
      try {
        audioManagerRef.current.destroy();
      } catch {}
      audioManagerRef.current = null;
    }
    setAudioLevel(0);
    setLiveState((prev) => (prev === 'ERROR' ? 'ERROR' : 'IDLE'));
    if (notifyUser) {
      setLiveStatus('Voice call ended.');
    }
  };

  const startLiveSession = async () => {
    setLiveError(null);

    if (!hasBYOK) {
      setLiveState('ERROR');
      setLiveError('Add your Gemini API key in Settings → Keys before calling Pari AI.');
      return;
    }

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
        if (state === 'Speaking') setLiveState('SPEAKING');
        else if (state === 'Listening') setLiveState('LISTENING');
      },
      onAudioLevel: (level) => setAudioLevel(level),
      onUserSpeechDetected: () => {},
      onError: (err) => console.error('[Live Audio Manager error]', err),
    });

    audioManager.setGuestMode(true);
    audioManagerRef.current = audioManager;

    try {
      const micStarted = await audioManager.startMicrophone();
      if (!micStarted) {
        setMicPermission('denied');
        setLiveState('ERROR');
        setLiveError('Microphone permission is required. Please allow microphone access in your browser settings.');
        stopLiveSession(false, 'mic_permission_failed');
        return;
      }
      setMicPermission('granted');
    } catch (err: any) {
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      setMicPermission(isDenied ? 'denied' : 'unavailable');
      setLiveState('ERROR');
      setLiveError(
        isDenied
          ? 'Microphone permission is required. Please allow microphone access in your browser settings.'
          : 'No microphone found or device is unavailable.'
      );
      stopLiveSession(false, 'mic_error');
      return;
    }

    setLiveState('CONNECTING');
    setLiveStatus(`Connecting your call with Pari AI (${companion.voice})...`);

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/hoorvia/live-ws?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);
      liveWsRef.current = ws;

      ws.onopen = () => {
        setLiveStatus('Call connecting with Pari AI...');
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ready') {
            setConnectedLiveModel(data.model);
            setLiveState('LISTENING');
            setLiveStatus(`Live with Pari AI (${data.voice || companion.voice}) • ${data.model || ''}`);
            setLiveDuration(0);
            if (durationTimerRef.current) clearInterval(durationTimerRef.current);
            durationTimerRef.current = setInterval(() => {
              setLiveDuration((prev) => prev + 1);
            }, 1000);
          } else if (data.type === 'audio' && data.audio) {
            setLiveState('SPEAKING');
            audioManagerRef.current?.playChunk(data.audio, data.mimeType);
          } else if (data.type === 'interrupted') {
            audioManagerRef.current?.bargeIn();
            setLiveState('LISTENING');
          } else if (data.type === 'turnComplete') {
            setLiveState('LISTENING');
          } else if (data.type === 'error') {
            setLiveState('ERROR');
            setLiveError(data.message || 'Voice call encountered an issue.');
            stopLiveSession(false, 'server_error');
          }
        } catch (err) {
          console.error('[Hoorvia Live WS parse error]', err);
        }
      };

      ws.onerror = (e) => console.error('[CLIENT_WS_ERROR]', e);

      ws.onclose = (event) => {
        if (liveWsRef.current === ws) {
          stopLiveSession(false, `ws_onclose_code_${event.code}`);
        }
      };
    } catch (err: any) {
      setLiveState('ERROR');
      setLiveError(err.message || 'Failed to start the voice call.');
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

  useEffect(() => {
    return () => {
      if (liveWsRef.current) {
        stopLiveSession(false, 'unmount');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Data fetchers ----------

  const fetchUserData = async () => {
    try {
      const res = await fetch('/api/hoorvia/auth/me', { headers: authHeaders(token) });
      const data = await res.json();
      if (res.ok && data.companion) {
        setCompanion({ ...data.companion, name: 'Pari AI' });
      }
    } catch (err) {
      console.error('Error fetching dashboard user data:', err);
    }
  };

  const fetchMemories = async () => {
    try {
      const res = await fetch('/api/hoorvia/memories', { headers: authHeaders(token) });
      const data = await res.json();
      if (res.ok && data.memories) setMemories(data.memories);
    } catch (err) {
      console.error('Error fetching memories:', err);
    }
  };

  const fetchKeys = async () => {
    try {
      const res = await fetch(`${CLIENT_API}/keys`, { headers: authHeaders(token) });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.keys || [];
      setKeys(
        list.map((k: any) => ({ model: k.model, maskedKey: k.maskedKey || k.masked || '••••••' }))
      );
    } catch (err) {
      console.error('Error fetching API keys:', err);
    }
  };

  const fetchThread = async () => {
    try {
      const res = await fetch(`${CLIENT_API}/thread`, { headers: authHeaders(token) });
      if (!res.ok) return;
      const data = await res.json();
      const msgs = Array.isArray(data) ? data : data.messages || [];
      setChatMessages(
        msgs.map((m: any) => ({
          sender: m.role === 'user' ? 'user' : 'companion',
          text: m.text || '',
          time: fmtTime(m.ts),
        }))
      );
      setThreadLoaded(true);
    } catch (err) {
      console.error('Error fetching thread:', err);
    }
  };

  const fetchTasks = async (): Promise<TaskItem[]> => {
    setTasksLoading(true);
    try {
      const res = await fetch(`${CLIENT_API}/tasks`, { headers: authHeaders(token) });
      if (res.ok) {
        const data = await res.json();
        const list: TaskItem[] = Array.isArray(data) ? data : data.tasks || [];
        setTasks(list);
        return list;
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setTasksLoading(false);
    }
    return [];
  };

  // Reminders: use the dedicated route when the backend provides it,
  // otherwise derive from repeating tasks (reminders fire from tasks).
  const fetchReminders = async (taskList?: TaskItem[]) => {
    try {
      const res = await fetch(`${CLIENT_API}/reminders`, { headers: authHeaders(token) });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.reminders || [];
        setReminders(list);
        setRemindersFromTasks(false);
        return;
      }
    } catch {}
    const source = taskList ?? tasks;
    const derived: ReminderItem[] = source
      .filter((t) => t.status !== 'done' && t.repeat !== 'once')
      .map((t) => ({
        id: t.id,
        title: t.title,
        text: t.detail,
        dueAt: t.dueAt,
        repeat: t.repeat,
      }));
    setReminders(derived);
    setRemindersFromTasks(true);
  };

  const fetchClientUsage = async () => {
    try {
      const res = await fetch(`${CLIENT_API}/usage`, { headers: authHeaders(token) });
      if (!res.ok) return;
      const data = await res.json();
      setClientUsage(data);
    } catch (err) {
      console.error('Error fetching usage:', err);
    }
  };

  const handleSaveProfile = async (dataToUpdate: Partial<CompanionProfile>) => {
    try {
      const res = await fetch('/api/hoorvia/companion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hoorvia-Token': token,
        },
        body: JSON.stringify({ ...dataToUpdate, name: 'Pari AI' }),
      });
      const data = await res.json();
      if (res.ok && data.companion) {
        setCompanion({ ...data.companion, name: 'Pari AI' });
      }
    } catch (err) {
      console.error('Error updating companion profile:', err);
    }
  };

  // ---------- Initial load & tab-driven refresh ----------

  useEffect(() => {
    fetchUserData();
    fetchMemories();
    fetchKeys();
    isPushSubscribed().then(setPushEnabled).catch(() => {});

    // PWA share-target: prefill chat when launched with ?shared=<text>
    try {
      const shared = new URLSearchParams(window.location.search).get('shared');
      if (shared) {
        setChatInput(shared);
        setActiveTab('chat');
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (activeTab === 'chat' && !threadLoaded) fetchThread();
    if (activeTab === 'tasks') fetchTasks();
    if (activeTab === 'reminders') {
      if (tasks.length === 0) {
        fetchTasks().then((list) => fetchReminders(list));
      } else {
        fetchReminders();
      }
    }
    if (activeTab === 'usage') fetchClientUsage();
    if (activeTab === 'settings') fetchKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Light poll so proactive scheduler messages appear inline in chat
  useEffect(() => {
    if (activeTab !== 'chat') return;
    const id = setInterval(() => {
      if (!isSendingChat && document.visibilityState === 'visible') fetchThread();
    }, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isSendingChat]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // ---------- Chat ----------

  const handleSendChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isSendingChat) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatNotice(null);
    const timeStr = fmtTime();

    setChatMessages((prev) => [...prev, { sender: 'user', text: userMsg, time: timeStr }]);

    // Mandatory BYOK check
    if (!hasBYOK) {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'companion',
          text: 'I need your Gemini API key before we can chat. Add it in Settings → Keys and we are good to go.',
          time: timeStr,
        },
      ]);
      setChatNotice({ kind: 'key', text: 'No AI key connected yet.' });
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
          history: chatMessages.slice(-8).map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', text: m.text })),
        }),
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const kind = data.error === 'weekly_limit' ? 'weekly_limit' : 'daily_limit';
        setChatNotice({
          kind: 'limit',
          text:
            kind === 'weekly_limit'
              ? 'Weekly limit reached. Your chats reset next week — check the Usage tab for details.'
              : 'Daily limit reached. Come back tomorrow, or check the Usage tab to see your quota.',
        });
        setChatMessages((prev) => [
          ...prev,
          {
            sender: 'companion',
            text: 'You have hit your chat limit for now. Please check the Usage tab — your quota refreshes automatically.',
            time: fmtTime(),
          },
        ]);
        return;
      }

      if (res.status === 402) {
        setChatNotice({ kind: 'key', text: 'No AI key connected yet.' });
        setChatMessages((prev) => [
          ...prev,
          {
            sender: 'companion',
            text: 'I need your Gemini API key before we can chat. Add it in Settings → Keys and we are good to go.',
            time: fmtTime(),
          },
        ]);
        return;
      }

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to get response.');
      }

      setChatMessages((prev) => [
        ...prev,
        { sender: 'companion', text: data.reply, time: fmtTime() },
      ]);

      fetchMemories(); // refresh memories if any fact was auto-extracted
      fetchThread(); // keep server-persisted thread in sync
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'companion',
          text: `[Error: ${err.message || 'Unable to connect'}]`,
          time: fmtTime(),
        },
      ]);
    } finally {
      setIsSendingChat(false);
    }
  };

  // Browser SpeechRecognition (free, no deps) — fills the chat input
  const toggleVoiceInput = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setChatNotice({ kind: 'error', text: 'Voice input is not supported in this browser. Try Chrome on desktop or Android.' });
      return;
    }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript as string;
      setChatInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    try {
      rec.start();
      setIsListening(true);
      setChatNotice(null);
    } catch {
      setIsListening(false);
    }
  };

  // Free TTS per assistant message
  const speakMessage = (text: string) => {
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utter);
    } catch {}
  };
  const stopSpeaking = () => {
    try {
      window.speechSynthesis?.cancel();
    } catch {}
  };

  // Voice note: record → upload → transcript fills the input
  const toggleVoiceNote = async () => {
    if (isRecordingNote) {
      try {
        mediaRecorderRef.current?.stop();
      } catch {}
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsRecordingNote(false);
        const blob = new Blob(recordedChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        if (blob.size === 0) return;
        const form = new FormData();
        form.append('audio', blob, 'voice-note.webm');
        try {
          const res = await fetch(`${CLIENT_API}/voice-note`, {
            method: 'POST',
            headers: authHeaders(token),
            body: form,
          });
          const data = await res.json();
          if (res.ok && data.text) {
            setChatInput((prev) => (prev ? `${prev} ${data.text}` : data.text));
          } else {
            setChatNotice({ kind: 'error', text: data.error || 'Voice note could not be transcribed.' });
          }
        } catch {
          setChatNotice({ kind: 'error', text: 'Voice note upload failed.' });
        }
        mediaRecorderRef.current = null;
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecordingNote(true);
      setChatNotice(null);
    } catch {
      setChatNotice({ kind: 'error', text: 'Microphone access is required to record a voice note.' });
    }
  };

  // ---------- Memory ----------

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
        headers: authHeaders(token),
      });
      fetchMemories();
    } catch (err) {
      console.error('Error deleting memory:', err);
    }
  };

  const handleResetMemories = async () => {
    if (!window.confirm('Are you sure you want to reset all memories for Pari AI?')) return;
    try {
      await fetch('/api/hoorvia/memories/reset', {
        method: 'POST',
        headers: authHeaders(token),
      });
      fetchMemories();
    } catch (err) {
      console.error('Error resetting memories:', err);
    }
  };

  // ---------- Tasks ----------

  const resetTaskForm = () => {
    setTaskTitle('');
    setTaskDetail('');
    setTaskDueAt('');
    setTaskRepeat('once');
    setTaskPriority('med');
    setEditingTaskId(null);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    setTaskMsg(null);
    const payload = {
      title: taskTitle.trim(),
      detail: taskDetail.trim(),
      dueAt: taskDueAt ? new Date(taskDueAt).toISOString() : null,
      repeat: taskRepeat,
      priority: taskPriority,
    };
    try {
      const url = editingTaskId ? `${CLIENT_API}/tasks/${editingTaskId}` : `${CLIENT_API}/tasks`;
      const res = await fetch(url, {
        method: editingTaskId ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hoorvia-Token': token,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        if (res.status === 429) {
          setTaskMsg('Daily limit reached — try again tomorrow.');
        } else {
          setTaskMsg(data.error || 'Could not save the task.');
        }
        return;
      }
      resetTaskForm();
      fetchTasks();
    } catch {
      setTaskMsg('Could not save the task. Check your connection.');
    }
  };

  const handleEditTask = (t: TaskItem) => {
    setEditingTaskId(t.id);
    setTaskTitle(t.title);
    setTaskDetail(t.detail || '');
    setTaskDueAt(t.dueAt ? new Date(t.dueAt).toISOString().slice(0, 16) : '');
    setTaskRepeat(t.repeat);
    setTaskPriority(t.priority);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteTask = async (id: string) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await fetch(`${CLIENT_API}/tasks/${id}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      fetchTasks();
    } catch {}
  };

  const handleToggleTaskDone = async (t: TaskItem) => {
    try {
      const res = await fetch(`${CLIENT_API}/tasks/${t.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Hoorvia-Token': token,
        },
        body: JSON.stringify({ status: t.status === 'done' ? 'pending' : 'done' }),
      });
      if (res.ok) fetchTasks();
    } catch {}
  };

  const taskGroups = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTodayOrOverdue = (t: TaskItem) => {
      if (!t.dueAt) return false;
      return new Date(t.dueAt) < tomorrow;
    };
    const pending = tasks.filter((t) => t.status !== 'done');
    const done = tasks.filter((t) => t.status === 'done');
    return {
      today: pending.filter(isTodayOrOverdue),
      upcoming: pending.filter((t) => !isTodayOrOverdue(t)),
      done,
    };
  })();

  // ---------- Files & Studio ----------

  const handleGenerateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileTitle.trim() || fileLoading) return;
    setFileLoading(true);
    setFileError(null);
    setFileResult(null);
    try {
      const res = await fetch(`${CLIENT_API}/files/${fileType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hoorvia-Token': token,
        },
        body: JSON.stringify({ title: fileTitle.trim(), outline: fileOutline.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setFileError('Daily limit reached — try again tomorrow.');
        return;
      }
      if (res.status === 402) {
        setFileError('Add your Gemini API key in Settings → Keys first.');
        return;
      }
      if (!res.ok || data.error || !data.downloadUrl) {
        throw new Error(data.error || 'File generation failed.');
      }
      setFileResult({ fileId: data.fileId, downloadUrl: data.downloadUrl });
    } catch (err: any) {
      setFileError(err.message || 'File generation failed.');
    } finally {
      setFileLoading(false);
    }
  };

  const handleStudioPack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studioTopic.trim() || studioLoading) return;
    setStudioLoading(true);
    setStudioError(null);
    setStudioResult(null);
    try {
      const res = await fetch(`${CLIENT_API}/studio/pack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hoorvia-Token': token,
        },
        body: JSON.stringify({ topic: studioTopic.trim(), platform: studioPlatform }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402 || data.error === 'no_image_access') {
        setStudioError(
          'Image generation is not available on your current access. Your key or plan does not include image access — the caption and hashtags below are still yours to use.'
        );
        return;
      }
      if (res.status === 429) {
        setStudioError('Daily limit reached — try again tomorrow.');
        return;
      }
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Studio pack failed.');
      }
      setStudioResult({
        imageUrl: data.imageUrl,
        caption: data.caption || '',
        hashtags: data.hashtags || '',
      });
    } catch (err: any) {
      setStudioError(err.message || 'Studio pack failed.');
    } finally {
      setStudioLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };

  // ---------- Settings: BYOK keys ----------

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyValue.trim() || isSavingKey) return;
    setIsSavingKey(true);
    setKeyMsg(null);
    try {
      const res = await fetch(`${CLIENT_API}/keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hoorvia-Token': token,
        },
        body: JSON.stringify({ model: newKeyModel.trim(), key: newKeyValue.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Key validation failed.');
      }
      setNewKeyValue('');
      fetchKeys();
      setKeyMsg({ type: 'success', text: `Key saved for ${newKeyModel.trim()}. Only you can use it.` });
    } catch (err: any) {
      setKeyMsg({ type: 'error', text: err.message || 'Key validation failed.' });
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleDeleteKey = async (model: string) => {
    if (!window.confirm(`Remove the saved key for ${model}?`)) return;
    try {
      await fetch(`${CLIENT_API}/keys/${encodeURIComponent(model)}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      fetchKeys();
    } catch {}
  };

  // ---------- Settings: push notifications ----------

  const handlePushToggle = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    setPushMsg(null);
    try {
      if (!pushEnabled) {
        if (!('Notification' in window)) {
          setPushMsg('Notifications are not supported in this browser.');
          return;
        }
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          setPushMsg('Notifications are blocked — allow them in your browser settings, then try again.');
          return;
        }
        const result = await subscribePush(token);
        if (result.ok) {
          setPushEnabled(true);
          setPushMsg('Push notifications are on. Reminders and proactive messages will reach you here.');
        } else {
          setPushMsg(result.reason || 'Could not enable push notifications.');
        }
      } else {
        const result = await unsubscribePush(token);
        if (result.ok) {
          setPushEnabled(false);
          setPushMsg('Push notifications are off.');
        } else {
          setPushMsg(result.reason || 'Could not turn off push notifications.');
        }
      }
    } finally {
      setPushBusy(false);
    }
  };

  // ---------- Shared render helpers ----------

  const NAV_ITEMS: { id: TabId; label: string; icon: any }[] = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'voice', label: 'Voice Call', icon: Phone },
    { id: 'tasks', label: 'Tasks', icon: ListTodo },
    { id: 'reminders', label: 'Reminders', icon: Bell },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'files', label: 'Files & Studio', icon: FolderOpen },
    { id: 'usage', label: 'Usage', icon: BarChart2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const PRIORITY_STYLE: Record<string, string> = {
    low: 'bg-slate-800 text-slate-300 border-slate-700',
    med: 'bg-amber-950/60 text-amber-300 border-amber-800/40',
    high: 'bg-rose-950/60 text-rose-300 border-rose-800/40',
  };

  const renderTaskCard = (t: TaskItem) => (
    <div
      key={t.id}
      className={`p-4 rounded-2xl border flex items-start justify-between gap-3 ${
        t.status === 'done'
          ? 'bg-slate-950/60 border-slate-800 opacity-60'
          : 'bg-slate-900/60 border-slate-800'
      }`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <button
          onClick={() => handleToggleTaskDone(t)}
          title={t.status === 'done' ? 'Mark as pending' : 'Mark as done'}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
            t.status === 'done' ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 hover:border-rose-400'
          }`}
        >
          {t.status === 'done' && <CheckCircle className="w-3.5 h-3.5 text-white" />}
        </button>
        <div className="min-w-0">
          <p className={`text-sm font-semibold text-white ${t.status === 'done' ? 'line-through' : ''}`}>
            {t.title}
          </p>
          {t.detail && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{t.detail}</p>}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${PRIORITY_STYLE[t.priority] || PRIORITY_STYLE.med}`}>
              {t.priority} priority
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950 text-slate-400 border border-slate-800">
              {t.repeat === 'once' ? 'one-time' : `repeats ${t.repeat}`}
            </span>
            {t.dueAt && (
              <span className="text-[10px] text-slate-400">
                due {new Date(t.dueAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => handleEditTask(t)} title="Edit task" className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => handleDeleteTask(t.id)} title="Delete task" className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  const renderUsageBar = (label: string, used: number, limit: number, unit: string) => {
    const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    const over = limit > 0 && used >= limit;
    return (
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-slate-300 font-medium">{label}</span>
          <span className={`font-mono ${over ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
            {used}/{limit} {unit}
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${over ? 'bg-rose-500' : 'bg-gradient-to-r from-rose-600 to-purple-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5">
          {over ? 'Limit reached — resets automatically.' : `${limit - used} ${unit} left.`}
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0A070B] text-slate-100 flex flex-col md:flex-row font-sans selection:bg-rose-500/30 overflow-x-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 md:h-screen md:sticky md:top-0 md:overflow-y-auto bg-slate-950/90 border-r border-rose-950/40 p-4 flex flex-col justify-between shrink-0">
        <div>
          <div className="mb-5 pb-3 border-b border-rose-950/40 px-1">
            <PariBrand size="sm" />
          </div>

          {/* Active User Card */}
          <div className="px-3 py-2.5 mb-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-rose-950 text-rose-300 border border-rose-800/50 flex items-center justify-center font-bold uppercase shrink-0">
                {user.name?.[0] || 'U'}
              </div>
              <div className="truncate">
                <p className="font-semibold text-white truncate">
                  {user.name}
                  {user.isGuest && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 align-middle">
                      Guest
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
            {user.role === 'owner' && user.id === 'usr_mohsin_owner' && onOpenOwnerAdmin && (
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
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
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

            {user.role === 'owner' && user.id === 'usr_mohsin_owner' && onOpenOwnerAdmin && (
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
              <span>AI Key Connected</span>
              <CheckCircle className="w-3 h-3 text-rose-400" />
            </div>
          ) : (
            <button
              onClick={() => setActiveTab('settings')}
              className="w-full px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-800/50 text-[10px] text-amber-300 flex items-center justify-between hover:bg-amber-950"
            >
              <span>Add your AI key to activate</span>
              <Key className="w-3 h-3" />
            </button>
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
        {/* ================= TAB: CHAT ================= */}
        {activeTab === 'chat' && (() => {
          const chatLangObj = getLanguageByCodeOrName(companion.language || 'English');
          const isChatRtl = isRtlLanguage(companion.language || 'English');

          return (
            <div className="h-[calc(100vh-8rem)] flex flex-col bg-slate-900/60 rounded-3xl border border-rose-950/60 overflow-hidden shadow-2xl animate-fadeIn">
              {/* Chat Top Bar */}
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-600 to-purple-600 flex items-center justify-center font-bold text-white">
                    P
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Pari AI</h3>
                    <p className="text-[10px] text-slate-400">Your personal AI companion</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                    <Globe className="w-3.5 h-3.5 text-rose-400" />
                    <span>{chatLangObj.name}</span>
                    {isChatRtl && (
                      <span className="text-[9px] bg-rose-950 px-1 rounded text-rose-300 font-mono">RTL</span>
                    )}
                  </div>
                  <span className={`text-[10px] px-2.5 py-1 rounded-full border ${hasBYOK ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40' : 'bg-rose-950 text-rose-300 border-rose-800/50'}`}>
                    {hasBYOK ? 'Key connected' : 'Key needed'}
                  </span>
                </div>
              </div>

              {!hasBYOK && (
                <div className="px-6 py-2.5 bg-amber-950/80 border-b border-amber-800/80 flex items-center justify-between text-xs text-amber-200">
                  <span>Add your Gemini API key to start chatting with Pari AI.</span>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px]"
                  >
                    Add Key
                  </button>
                </div>
              )}

              {chatNotice && (
                <div className={`px-6 py-2.5 border-b text-xs flex items-center justify-between gap-3 ${
                  chatNotice.kind === 'limit'
                    ? 'bg-rose-950/70 border-rose-800/60 text-rose-200'
                    : chatNotice.kind === 'key'
                    ? 'bg-amber-950/70 border-amber-800/60 text-amber-200'
                    : 'bg-red-950/60 border-red-800/60 text-red-200'
                }`}>
                  <span>{chatNotice.text}</span>
                  {chatNotice.kind === 'limit' && (
                    <button
                      onClick={() => setActiveTab('usage')}
                      className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] shrink-0"
                    >
                      View Usage
                    </button>
                  )}
                  {chatNotice.kind === 'key' && (
                    <button
                      onClick={() => setActiveTab('settings')}
                      className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] shrink-0"
                    >
                      Settings
                    </button>
                  )}
                </div>
              )}

              {/* Chat Messages */}
              <div
                ref={chatScrollRef}
                dir={isChatRtl ? 'rtl' : 'ltr'}
                className="flex-1 p-6 overflow-y-auto space-y-4"
              >
                {chatMessages.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 text-xs space-y-3" dir="ltr">
                    <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-rose-600 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                      P
                    </div>
                    <p className="text-sm text-slate-300 font-medium">Say hi to Pari AI 👋</p>
                    <p className="max-w-sm mx-auto leading-relaxed">
                      Type, dictate, or send a voice note. Ask her to remind you, make a task,
                      or create a file — she remembers what matters to you.
                    </p>
                    <p className="text-[10px] text-slate-600">
                      Your chats and memories are strictly isolated to your account.
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
                      <div className="flex items-center gap-1.5 mt-1 px-1">
                        <span className="text-[9px] text-slate-500">{msg.time}</span>
                        {msg.sender === 'companion' && (
                          <>
                            <button
                              onClick={() => speakMessage(msg.text)}
                              title="Read aloud"
                              className="p-1 rounded text-slate-500 hover:text-rose-300 hover:bg-slate-800"
                            >
                              <Volume2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={stopSpeaking}
                              title="Stop reading"
                              className="p-1 rounded text-slate-500 hover:text-rose-300 hover:bg-slate-800"
                            >
                              <VolumeX className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {isSendingChat && (
                  <div className="flex items-start">
                    <div className="px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                      Pari AI is thinking…
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendChat} className="p-4 bg-slate-950 border-t border-slate-800 flex gap-2 items-center">
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  title={isListening ? 'Stop listening' : 'Dictate with your voice'}
                  className={`p-3 rounded-xl border transition-all shrink-0 ${
                    isListening
                      ? 'bg-rose-600 border-rose-500 text-white animate-pulse'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-rose-500'
                  }`}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={toggleVoiceNote}
                  title={isRecordingNote ? 'Stop and send voice note' : 'Record a voice note'}
                  className={`p-3 rounded-xl border transition-all shrink-0 ${
                    isRecordingNote
                      ? 'bg-purple-600 border-purple-500 text-white animate-pulse'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-purple-500'
                  }`}
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  dir={isChatRtl ? 'rtl' : 'ltr'}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={isRecordingNote ? 'Recording voice note… tap again to stop' : `Message Pari AI in ${chatLangObj.name}...`}
                  disabled={isRecordingNote}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={isSendingChat || !chatInput.trim()}
                  className="px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" /> Send
                </button>
              </form>
            </div>
          );
        })()}

        {/* ================= TAB: VOICE CALL ================= */}
        {activeTab === 'voice' && (
          <div className="p-8 rounded-3xl bg-slate-900/60 border border-rose-950/60 text-center space-y-6 animate-fadeIn">
            {!hasBYOK && (
              <div className="p-4 rounded-2xl bg-amber-950/70 border border-amber-800/80 flex items-center justify-between text-amber-200 text-xs text-left">
                <div className="flex items-center gap-2.5">
                  <Key className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Add your Gemini API key to call Pari AI.</span>
                </div>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0"
                >
                  Add Key
                </button>
              </div>
            )}

            <div>
              <h2 className="text-2xl font-bold text-white">Call Pari AI</h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                One tap and you are talking — like calling Alexa. Speak naturally, interrupt anytime, hang up when done.
              </p>
            </div>

            {/* Voice Orb */}
            <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
              {(liveState === 'LISTENING' || liveState === 'SPEAKING') && (
                <div
                  className={`absolute inset-0 rounded-full blur-xl transition-all duration-300 ${
                    liveState === 'SPEAKING' ? 'bg-rose-500/40 animate-pulse' : 'bg-emerald-500/30'
                  }`}
                  style={{ transform: `scale(${1 + Math.min(audioLevel * 1.5, 0.8)})` }}
                />
              )}
              <div
                className={`w-32 h-32 rounded-full p-1 transition-all duration-300 shadow-2xl ${
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
                    <Phone className="w-10 h-10 text-slate-600" />
                  )}
                </div>
              </div>
            </div>

            {/* Status & Duration */}
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
                    <span className="text-rose-300">Pari AI is speaking</span>
                  </>
                )}
                {(liveState === 'CONNECTING' || liveState === 'REQUESTING_MIC') && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span className="text-amber-300">Connecting your call...</span>
                  </>
                )}
                {liveState === 'IDLE' && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    <span className="text-slate-400">Ready to call</span>
                  </>
                )}
                {liveState === 'ERROR' && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="text-rose-400">Call error</span>
                  </>
                )}
                {(liveState === 'LISTENING' || liveState === 'SPEAKING') && (
                  <span className="text-slate-400 font-mono ml-1 border-l border-slate-700 pl-2">
                    {Math.floor(liveDuration / 60)}:{(liveDuration % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">{liveStatus}</p>
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
              </div>
            </div>

            {liveError && (
              <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/70 text-rose-200 text-xs max-w-md mx-auto flex items-start gap-2 text-left">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-rose-300">Call Notice</div>
                  <div className="mt-0.5 text-slate-300">{liveError}</div>
                </div>
              </div>
            )}

            {/* One-tap call button */}
            <div className="flex items-center justify-center gap-3 pt-2">
              {liveState === 'LISTENING' || liveState === 'SPEAKING' ? (
                <button
                  onClick={() => stopLiveSession(true)}
                  className="w-20 h-20 rounded-full text-xs font-bold transition-all shadow-xl bg-rose-600 hover:bg-rose-500 text-white flex flex-col items-center justify-center gap-1"
                  title="End call"
                >
                  <PhoneOff className="w-7 h-7" />
                  <span>End</span>
                </button>
              ) : liveState === 'CONNECTING' || liveState === 'REQUESTING_MIC' ? (
                <button
                  disabled
                  className="w-20 h-20 rounded-full text-xs font-bold shadow-xl bg-slate-800 text-amber-300 border border-amber-500/40 flex flex-col items-center justify-center gap-1 cursor-not-allowed opacity-80"
                >
                  <Loader2 className="w-7 h-7 animate-spin" />
                  <span>…</span>
                </button>
              ) : (
                <button
                  onClick={startLiveSession}
                  className="w-20 h-20 rounded-full text-xs font-bold transition-all shadow-xl shadow-rose-950/60 bg-gradient-to-br from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white flex flex-col items-center justify-center gap-1"
                  title="Call Pari AI"
                >
                  <Phone className="w-7 h-7" />
                  <span>Call</span>
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
            <p className="text-[11px] text-slate-500">Tap the call button and start talking — no menus, no setup.</p>
          </div>
        )}

        {/* ================= TAB: TASKS ================= */}
        {activeTab === 'tasks' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-2xl font-bold text-white">Tasks</h2>
              <p className="text-xs text-slate-400 mt-1">
                Create tasks here — or just tell Pari AI in chat ("remind me to call mom at 7"). Repeating tasks keep working even when the app is closed.
              </p>
            </div>

            {taskMsg && (
              <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300">
                {taskMsg}
              </div>
            )}

            {/* Create / Edit form */}
            <form onSubmit={handleSaveTask} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white">{editingTaskId ? 'Edit task' : 'New task'}</h3>
              <input
                type="text"
                required
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Task title — e.g. Call the bank"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-rose-500"
              />
              <textarea
                value={taskDetail}
                onChange={(e) => setTaskDetail(e.target.value)}
                placeholder="Details (optional)"
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-rose-500 resize-none"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Due date & time</label>
                  <input
                    type="datetime-local"
                    value={taskDueAt}
                    onChange={(e) => setTaskDueAt(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Repeat</label>
                  <select
                    value={taskRepeat}
                    onChange={(e) => setTaskRepeat(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500"
                  >
                    <option value="once">One-time</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500"
                  >
                    <option value="low">Low</option>
                    <option value="med">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> {editingTaskId ? 'Save changes' : 'Add task'}
                </button>
                {editingTaskId && (
                  <button
                    type="button"
                    onClick={resetTaskForm}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            {/* Groups */}
            {tasksLoading ? (
              <div className="text-center py-10 text-slate-500 text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading tasks…
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-14 text-slate-500 text-xs space-y-2 border border-dashed border-slate-800 rounded-2xl">
                <ListTodo className="w-10 h-10 mx-auto text-slate-700" />
                <p className="text-sm text-slate-300 font-medium">No tasks yet</p>
                <p className="max-w-xs mx-auto">Add one above — or just tell Pari AI in chat what you need done.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Today & overdue ({taskGroups.today.length})
                  </h3>
                  <div className="space-y-2">
                    {taskGroups.today.length === 0 ? (
                      <p className="text-xs text-slate-600 py-2">Nothing due today. Nice.</p>
                    ) : (
                      taskGroups.today.map(renderTaskCard)
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Upcoming ({taskGroups.upcoming.length})
                  </h3>
                  <div className="space-y-2">
                    {taskGroups.upcoming.length === 0 ? (
                      <p className="text-xs text-slate-600 py-2">Nothing coming up.</p>
                    ) : (
                      taskGroups.upcoming.map(renderTaskCard)
                    )}
                  </div>
                </div>
                {taskGroups.done.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Done ({taskGroups.done.length})
                    </h3>
                    <div className="space-y-2">{taskGroups.done.map(renderTaskCard)}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB: REMINDERS ================= */}
        {activeTab === 'reminders' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-2xl font-bold text-white">Reminders</h2>
              <p className="text-xs text-slate-400 mt-1">
                Reminders fire automatically — as push notifications and as messages from Pari AI in chat.
              </p>
            </div>

            {remindersFromTasks && (
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400">
                Reminders fire from your repeating tasks. Make any task repeat <strong className="text-slate-200">daily</strong> or{' '}
                <strong className="text-slate-200">weekly</strong> and it shows up here.
              </div>
            )}

            <div className="space-y-2">
              {reminders.length === 0 ? (
                <div className="text-center py-14 text-slate-500 text-xs space-y-2 border border-dashed border-slate-800 rounded-2xl">
                  <Bell className="w-10 h-10 mx-auto text-slate-700" />
                  <p className="text-sm text-slate-300 font-medium">No reminders yet</p>
                  <p className="max-w-xs mx-auto">
                    Create a repeating task, or just say in chat: <em className="text-slate-300">"remind me every morning at 8 to drink water"</em>.
                  </p>
                  <button
                    onClick={() => setActiveTab('tasks')}
                    className="mt-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                  >
                    Go to Tasks
                  </button>
                </div>
              ) : (
                reminders.map((r) => (
                  <div
                    key={r.id}
                    className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-3"
                  >
                    <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800/40 text-rose-300 shrink-0">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{r.title}</p>
                      {r.text && <p className="text-xs text-slate-400 mt-0.5">{r.text}</p>}
                      <p className="text-[11px] text-slate-500 mt-1">
                        {r.repeat && r.repeat !== 'once' ? `Repeats ${r.repeat}` : 'One-time'}
                        {r.dueAt && ` • ${new Date(r.dueAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 leading-relaxed">
              <strong className="text-slate-200">Tip:</strong> turn on push notifications in{' '}
              <button onClick={() => setActiveTab('settings')} className="text-rose-400 font-semibold hover:underline">
                Settings
              </button>{' '}
              so reminders reach you even when the app is closed.
            </div>
          </div>
        )}

        {/* ================= TAB: MEMORY ================= */}
        {activeTab === 'memory' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Memory</h2>
                <p className="text-xs text-slate-400">
                  What Pari AI remembers about you — fully private to your account.
                </p>
              </div>
              <button
                onClick={handleResetMemories}
                className="px-3 py-1.5 rounded-lg bg-rose-950/80 border border-rose-800/60 text-rose-300 hover:bg-rose-900 text-xs font-medium flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Reset
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 leading-relaxed">
              <strong className="text-slate-200">How it works:</strong> Pari AI now auto-remembers in any language.
              Mention something in chat — your routine, preferences, people, goals — and it is saved here automatically.
              You can add, edit (delete + re-add), or wipe memories anytime.
            </div>

            {/* Add Memory Form */}
            <form onSubmit={handleAddMemory} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex gap-2">
              <input
                type="text"
                required
                value={newMemoryFact}
                onChange={(e) => setNewMemoryFact(e.target.value)}
                placeholder="Add a fact — e.g. Allergic to peanuts, gym at 6am, daughter's birthday June 12..."
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
                  No memories saved yet. Chat with Pari AI and she will start remembering.
                </div>
              ) : (
                memories.map((m) => (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/40 shrink-0">
                        {m.category}
                      </span>
                      <span className="text-slate-200">{m.fact}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteMemory(m.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 shrink-0"
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

        {/* ================= TAB: FILES & STUDIO ================= */}
        {activeTab === 'files' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-2xl font-bold text-white">Files & Studio</h2>
              <p className="text-xs text-slate-400 mt-1">
                Generate real downloadable files, or a ready-to-post content pack — just describe what you need.
              </p>
            </div>

            {/* (a) Make a file */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-rose-400" /> Make a file
              </h3>
              <form onSubmit={handleGenerateFile} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">File type</label>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: 'pptx', label: 'Presentation (.pptx)' },
                        { id: 'docx', label: 'Word (.docx)' },
                        { id: 'pdf', label: 'PDF (.pdf)' },
                        { id: 'epub', label: 'E-book (.epub)' },
                        { id: 'xlsx', label: 'Excel (.xlsx)' },
                      ] as const
                    ).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setFileType(t.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          fileType === t.id
                            ? 'bg-rose-950/80 text-rose-200 border-rose-600'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {(fileType === 'pdf' || fileType === 'epub') && (
                    <p className="text-[11px] text-slate-500 mt-2">
                      Manuscript only — not an illustrated publish-ready book. Clean chapters, proper formatting, ready to read.
                    </p>
                  )}
                </div>

                <input
                  type="text"
                  required
                  value={fileTitle}
                  onChange={(e) => setFileTitle(e.target.value)}
                  placeholder="Title — e.g. My Business Plan"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-rose-500"
                />
                <textarea
                  value={fileOutline}
                  onChange={(e) => setFileOutline(e.target.value)}
                  placeholder="Outline or key points (optional) — what should go inside?"
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-rose-500 resize-none"
                />

                {fileError && (
                  <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300">
                    {fileError}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={fileLoading || !fileTitle.trim()}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {fileLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                    {fileLoading ? 'Generating…' : 'Generate file'}
                  </button>
                  {fileResult && (
                    <a
                      href={fileResult.downloadUrl}
                      download
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </a>
                  )}
                </div>
              </form>
            </div>

            {/* (b) Content Studio */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-rose-400" /> Content Studio
              </h3>
              <form onSubmit={handleStudioPack} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={studioTopic}
                    onChange={(e) => setStudioTopic(e.target.value)}
                    placeholder="Topic — e.g. 5 morning habits for busy nurses"
                    className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-rose-500"
                  />
                  <select
                    value={studioPlatform}
                    onChange={(e) => setStudioPlatform(e.target.value)}
                    className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-rose-500"
                  >
                    <option>Instagram</option>
                    <option>TikTok</option>
                    <option>YouTube</option>
                    <option>Facebook</option>
                    <option>X</option>
                  </select>
                </div>

                {studioError && (
                  <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-800/60 text-xs text-amber-300">
                    {studioError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={studioLoading || !studioTopic.trim()}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {studioLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                  {studioLoading ? 'Creating pack…' : 'Create content pack'}
                </button>

                {studioResult && (
                  <div className="pt-2 space-y-3">
                    {studioResult.imageUrl && (
                      <img
                        src={studioResult.imageUrl}
                        alt={studioTopic}
                        className="w-full max-w-md rounded-2xl border border-slate-800"
                      />
                    )}
                    {studioResult.caption && (
                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Caption</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(studioResult.caption)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                            title="Copy caption"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{studioResult.caption}</p>
                      </div>
                    )}
                    {studioResult.hashtags && (
                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Hashtags</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(studioResult.hashtags)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                            title="Copy hashtags"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-rose-300 leading-relaxed">{studioResult.hashtags}</p>
                      </div>
                    )}
                  </div>
                )}
              </form>
              <p className="text-[11px] text-slate-500">Content Studio makes images and post copy. Video generation is not available yet.</p>
            </div>
          </div>
        )}

        {/* ================= TAB: USAGE ================= */}
        {activeTab === 'usage' && (
          <div className="space-y-6 max-w-2xl animate-fadeIn">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-2xl font-bold text-white">Usage</h2>
              <p className="text-xs text-slate-400 mt-1">
                Your fair-use quota — daily and weekly. Limits apply to everyone, even with your own API key.
              </p>
            </div>

            {!clientUsage ? (
              <div className="text-center py-10 text-slate-500 text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading usage…
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Today</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {renderUsageBar('Chats', clientUsage.today.chat, clientUsage.limits.chat, 'chats')}
                    {renderUsageBar('Images', clientUsage.today.images, clientUsage.limits.images, 'images')}
                    {renderUsageBar('Files', clientUsage.today.files, clientUsage.limits.files, 'files')}
                    {renderUsageBar('Voice call minutes', clientUsage.today.liveMinutes, clientUsage.limits.liveMinutes, 'min')}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">This week</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {renderUsageBar('Chats', clientUsage.week.chat, clientUsage.limits.chat, 'chats')}
                    {renderUsageBar('Images', clientUsage.week.images, clientUsage.limits.images, 'images')}
                    {renderUsageBar('Files', clientUsage.week.files, clientUsage.limits.files, 'files')}
                    {renderUsageBar('Voice call minutes', clientUsage.week.liveMinutes, clientUsage.limits.liveMinutes, 'min')}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Quotas reset automatically — daily at midnight, weekly every Monday. Need more? Talk to the owner.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB: SETTINGS ================= */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-2xl animate-fadeIn">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-2xl font-bold text-white">Settings</h2>
              <p className="text-xs text-slate-400 mt-1">Your companion, language, voice, AI keys, and notifications.</p>
            </div>

            {/* Companion identity */}
            <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-2">
              <h3 className="text-sm font-bold text-white">My Companion</h3>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Companion name</label>
                <input
                  type="text"
                  value="Pari AI"
                  readOnly
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-sm cursor-not-allowed opacity-80"
                />
                <p className="text-[11px] text-slate-500 mt-1">Renamable later — for now she is Pari AI.</p>
              </div>
            </div>

            {/* Language */}
            <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-2">
              <h3 className="text-sm font-bold text-white">Language</h3>
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
              {isMohsinMaryam(user.id, companion.id) && (
                <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-800/60 text-xs text-purple-200 flex items-center gap-2">
                  <span>
                    <strong>Owner lock:</strong> language and voice settings are permanently locked on this profile.
                  </span>
                </div>
              )}
            </div>

            {/* Voice */}
            <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Voice</h3>
                <span className="text-[10px] text-slate-400">Tap Preview to hear a sample</span>
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

            {/* BYOK keys */}
            <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-rose-400" /> Your AI keys (BYOK)
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Pari AI runs on <strong className="text-slate-200">your own Gemini API key</strong> — one per model.
                  Keys are encrypted server-side, never shown to anyone else, and never logged.
                </p>
              </div>

              {keyMsg && (
                <div
                  className={`p-3 rounded-xl border text-xs ${
                    keyMsg.type === 'success'
                      ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
                      : 'bg-red-950/60 border-red-800/60 text-red-300'
                  }`}
                >
                  {keyMsg.text}
                </div>
              )}

              {/* Saved keys list */}
              <div className="space-y-2">
                {keys.length === 0 ? (
                  <p className="text-xs text-slate-500 py-1">No keys saved yet — add your first key below.</p>
                ) : (
                  keys.map((k) => (
                    <div
                      key={k.model}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-xs font-mono text-white truncate">{k.model}</span>
                        <span className="text-[11px] font-mono text-slate-500">{k.maskedKey}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteKey(k.model)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 shrink-0"
                        title={`Remove key for ${k.model}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Add key form */}
              <form onSubmit={handleAddKey} className="space-y-2.5 pt-1 border-t border-slate-800">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Model</label>
                    <input
                      type="text"
                      value={newKeyModel}
                      onChange={(e) => setNewKeyModel(e.target.value)}
                      placeholder="gemini-2.0-flash"
                      list="pari-model-suggestions"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-rose-500"
                    />
                    <datalist id="pari-model-suggestions">
                      <option value="gemini-2.0-flash" />
                      <option value="gemini-2.5-flash" />
                      <option value="gemini-2.5-pro" />
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">API key</label>
                    <input
                      type="password"
                      value={newKeyValue}
                      onChange={(e) => setNewKeyValue(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSavingKey || !newKeyValue.trim()}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-50"
                >
                  {isSavingKey ? 'Saving…' : 'Save key'}
                </button>
              </form>

              {/* Tutorial video slot — wired to GEMINI_KEY_TUTORIAL_VIDEO_URL */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center gap-4">
                {GEMINI_KEY_TUTORIAL_VIDEO_URL ? (
                  <a
                    href={GEMINI_KEY_TUTORIAL_VIDEO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative w-28 h-16 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden hover:border-rose-500 transition-colors"
                    title="Watch: How to get your Gemini API key"
                  >
                    <Video className="w-6 h-6 text-slate-600" />
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="w-9 h-9 rounded-full bg-rose-600/90 flex items-center justify-center">
                        <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                      </span>
                    </span>
                  </a>
                ) : (
                  <div className="relative w-28 h-16 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden opacity-70">
                    <Video className="w-6 h-6 text-slate-700" />
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="w-9 h-9 rounded-full bg-slate-700/80 flex items-center justify-center">
                        <Play className="w-4 h-4 text-slate-400 fill-current ml-0.5" />
                      </span>
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">How to get your Gemini API key</p>
                  {GEMINI_KEY_TUTORIAL_VIDEO_URL ? (
                    <a
                      href={GEMINI_KEY_TUTORIAL_VIDEO_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-rose-400 hover:underline font-semibold"
                    >
                      Watch the step-by-step tutorial →
                    </a>
                  ) : (
                    <p className="text-[11px] text-slate-500">Video coming soon — a short walkthrough is being recorded.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Push notifications */}
            <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Push notifications</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Get reminders and proactive messages from Pari AI even when the app is closed.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePushToggle}
                  disabled={pushBusy}
                  role="switch"
                  aria-checked={pushEnabled}
                  className={`relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-60 ${
                    pushEnabled ? 'bg-rose-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${
                      pushEnabled ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>
              {pushMsg && <p className="text-[11px] text-slate-400">{pushMsg}</p>}
              {!('Notification' in window) && (
                <p className="text-[11px] text-slate-500">This browser does not support notifications.</p>
              )}
            </div>

            {/* Account */}
            <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-2 text-xs">
              <h3 className="text-sm font-bold text-white">Account</h3>
              <div>User ID: <strong className="text-rose-300 font-mono">{user.id}</strong></div>
              <div>Email: <strong className="text-white">{user.email}</strong></div>
              <div>Data isolation: <strong className="text-rose-400">100% server-enforced</strong></div>
              <button
                onClick={onLogout}
                className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> Log Out
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
