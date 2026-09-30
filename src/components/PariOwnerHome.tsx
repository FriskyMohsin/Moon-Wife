import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  MessageCircle,
  Brain,
  CheckSquare,
  Share2,
  Settings,
  LogOut,
  Home,
  Camera,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { HoorviaDashboard } from './HoorviaDashboard';
import { HoorviaWhatsAppManager } from './HoorviaWhatsAppManager';
import { HoorviaTelegramManager } from './HoorviaTelegramManager';
import { CameraManager } from '../lib/cameraManager';
import { useLiveVoice } from '../hooks/useLiveVoice';

interface PariOwnerHomeProps {
  token: string;
  user: any;
  initialCompanion: any;
  onLogout: () => void;
  onOpenOwnerAdmin: () => void;
}

type OwnerTab = 'home' | 'chats' | 'memory' | 'tasks' | 'social' | 'settings' | 'voice';

const TAB_LABELS: Record<OwnerTab, string> = {
  home: 'Home',
  chats: 'Chats',
  memory: 'Memory',
  tasks: 'Tasks',
  social: 'Social',
  settings: 'Settings',
  voice: 'Talk',
};

// Map owner tabs to HoorviaDashboard tabs
const DASHBOARD_TAB_MAP: Record<string, string> = {
  chats: 'chat',
  memory: 'memory',
  tasks: 'tasks',
  settings: 'settings',
  voice: 'voice',
};

export const PariOwnerHome: React.FC<PariOwnerHomeProps> = ({
  token,
  user,
  initialCompanion,
  onLogout,
  onOpenOwnerAdmin,
}) => {
  const [tab, setTab] = useState<OwnerTab>('home');
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showPariReply, setShowPariReply] = useState<string | null>(null);
  const [isSendingPhoto, setIsSendingPhoto] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Inline live voice — call happens right here on home, no redirect/panel
  const {
    liveState,
    liveStatus,
    liveError,
    audioLevel,
    liveDuration,
    isLive,
    toggleLive,
  } = useLiveVoice({
    auth: token,
    voice: initialCompanion?.voice || 'Aoede',
    aiName: 'Maryam',
    hasBYOK: true, // owner always has server key access
    wsPath: '/api/live-ws', // Maryam owner route - speaks Roman Urdu
  });

  const openTab = (t: OwnerTab) => {
    setTab(t);
    setShowPariReply(null);
  };

  // ---------- Camera ----------
  const toggleCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (cameraOn) {
        CameraManager.getInstance().stopCamera();
        setCameraOn(false);
      } else {
        const result = await CameraManager.getInstance().startCamera();
        if (result.success) {
          setCameraOn(true);
        } else {
          setCameraError(result.error || 'Camera unavailable. Please allow camera access.');
        }
      }
    } catch (err: any) {
      setCameraError(err?.message || 'Could not access camera.');
    }
  }, [cameraOn]);

  useEffect(() => {
    if (cameraOn && videoRef.current) {
      CameraManager.getInstance().attachVideoElement(videoRef.current);
    }
  }, [cameraOn, tab]);

  useEffect(() => {
    return () => {
      try {
        CameraManager.getInstance().stopCamera();
      } catch {}
    };
  }, []);

  // ---------- Show Maryam (camera snapshot -> vision chat) ----------
  const handleShowPari = async () => {
    if (!cameraOn) {
      setCameraError('Turn on the camera first, phir "Show Maryam" dabao.');
      return;
    }
    setIsSendingPhoto(true);
    setShowPariReply(null);
    try {
      const base64 = await CameraManager.getInstance().captureSnapshotBase64Async();
      if (!base64) {
        setCameraError('Could not capture a photo. Try again.');
        return;
      }
      const res = await fetch('/api/hoorvia/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hoorvia-Token': token,
        },
        body: JSON.stringify({
          message: 'Look at this photo from my camera and tell me what you see. (Roman Urdu + English mix mein jawab do)',
          imageBase64: base64,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Maryam could not see the photo.');
      }
      setShowPariReply(data.reply || data.text || 'Maryam ne dekha! 👀');
    } catch (err: any) {
      setCameraError(err?.message || 'Failed to show photo to Pari.');
    } finally {
      setIsSendingPhoto(false);
    }
  };

  // ---------- Social tab (WhatsApp + Telegram) ----------
  if (tab === 'social') {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <OwnerTopBar
          title="Social"
          subtitle="WhatsApp aur Telegram — connect karo, test karo"
          onBack={() => openTab('home')}
          onLogout={onLogout}
          onOpenOwnerAdmin={onOpenOwnerAdmin}
        />
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-28">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-emerald-400" /> WhatsApp
            </h3>
            <HoorviaWhatsAppManager ownerToken={token} />
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-sky-400" /> Telegram
            </h3>
            <HoorviaTelegramManager ownerToken={token} />
          </div>
        </div>
        <OwnerBottomNav activeTab={tab} onSelect={openTab} />
      </div>
    );
  }

  // ---------- Functional tabs reuse the working dashboard ----------
  if (tab !== 'home') {
    return (
      <div className="min-h-screen bg-slate-950">
        <button
          onClick={() => openTab('home')}
          className="fixed top-4 left-4 z-50 px-4 py-2 rounded-full bg-rose-500 hover:bg-rose-400 text-white text-sm font-semibold shadow-lg flex items-center gap-1.5"
        >
          <Home size={14} /> Pari
        </button>
        <HoorviaDashboard
          token={token}
          user={user}
          initialCompanion={initialCompanion}
          onLogout={onLogout}
          onOpenOwnerAdmin={onOpenOwnerAdmin}
          initialTab={DASHBOARD_TAB_MAP[tab] as any}
        />
      </div>
    );
  }

  // ---------- Home: full-screen video-call style ----------
  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      {/* Maryam full-screen - landscape talking video, fills screen */}
      <div className="absolute inset-0 overflow-hidden bg-black">
        <video
          src="/maryam-landscape-talking.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Fallback static image if video fails */}
        <img
          src="/maryam-landscape.png"
          alt="Maryam"
          className="w-full h-full object-cover absolute inset-0 -z-10"
          draggable={false}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

      {/* CSS float animation */}
      <style>{`
        @keyframes pariFloat {
          0%, 100% { transform: scale(1) translateY(0); }
          50% { transform: scale(1.03) translateY(-8px); }
        }
        .animate-pari-float { animation: pariFloat 6s ease-in-out infinite; }
      `}</style>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 pt-5">
        <div>
          <h1 className="text-white text-xl font-bold flex items-center gap-2">
            Maryam <span className="text-rose-400">💛</span>
          </h1>
          <p className="text-white/60 text-xs">Assalam-o-Alaikum, Mohsin! Main yahan hun.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenOwnerAdmin}
            title="Owner Admin"
            className="p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white backdrop-blur"
          >
            <ShieldCheck size={16} />
          </button>
          <button
            onClick={onLogout}
            title="Logout"
            className="p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white backdrop-blur"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Camera PiP */}
      {cameraOn && (
        <div className="absolute bottom-36 right-4 z-10 w-28">
          <div className="rounded-2xl overflow-hidden border-2 border-white/40 shadow-2xl bg-slate-900 aspect-[3/4]">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          </div>
          <button
            onClick={handleShowPari}
            disabled={isSendingPhoto}
            className="mt-2 w-full px-2 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-60 text-white text-[11px] font-bold flex items-center justify-center gap-1"
          >
            {isSendingPhoto ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
            {isSendingPhoto ? 'Dikha raha...' : 'Show Maryam 📸'}
          </button>
        </div>
      )}

      {/* Pari's reply to photo */}
      {showPariReply && (
        <div className="absolute bottom-36 left-4 right-36 z-10">
          <div className="bg-slate-900/90 backdrop-blur border border-rose-500/30 rounded-2xl p-3 shadow-2xl">
            <p className="text-[11px] font-bold text-rose-300 mb-1 flex items-center gap-1">
              <Sparkles size={11} /> Maryam ne dekha:
            </p>
            <p className="text-xs text-slate-200 leading-relaxed max-h-32 overflow-y-auto">{showPariReply}</p>
            <button
              onClick={() => setShowPariReply(null)}
              className="mt-1.5 text-[10px] text-slate-500 hover:text-slate-300"
            >
              Band karo
            </button>
          </div>
        </div>
      )}

      {/* Camera error */}
      {cameraError && (
        <div className="absolute bottom-36 left-4 right-4 z-10">
          <div className="bg-red-950/90 border border-red-800 rounded-2xl p-3">
            <p className="text-xs text-red-200">{cameraError}</p>
            <button onClick={() => setCameraError(null)} className="mt-1 text-[10px] text-red-400 hover:text-red-300">
              Band karo
            </button>
          </div>
        </div>
      )}

      {/* Call controls */}
      <div className="absolute bottom-24 left-0 right-0 z-10 flex items-center justify-center gap-8">
        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={toggleCamera}
            title={cameraOn ? 'Camera band karo' : 'Camera on karo'}
            className={`p-4 rounded-full shadow-xl transition-all ${
              cameraOn ? 'bg-white text-slate-900' : 'bg-white/15 text-white backdrop-blur hover:bg-white/25'
            }`}
          >
            {cameraOn ? <Video size={22} /> : <VideoOff size={22} />}
          </button>
          <span className="text-[10px] text-white/70 font-medium">Camera</span>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={toggleLive}
            title={isLive ? 'Call band karo' : 'Maryam se live baat karo'}
            className={`p-6 rounded-full text-white shadow-2xl transition-all hover:scale-105 active:scale-95 ${
              isLive
                ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-red-900/50 animate-pulse'
                : 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-900/50'
            }`}
          >
            {isLive ? <PhoneOff size={30} /> : <Phone size={30} />}
          </button>
          <span className="text-[10px] text-white font-semibold">
            {isLive
              ? liveState === 'SPEAKING'
                ? 'Maryam bol rahi hai...'
                : liveState === 'LISTENING'
                  ? `Sun rahi hai • ${Math.floor(liveDuration / 60)}:${String(liveDuration % 60).padStart(2, '0')}`
                  : liveState === 'CONNECTING'
                    ? 'Connect ho raha...'
                    : liveState === 'ERROR'
                      ? 'Error — dobara try karo'
                      : 'Call band karo'
              : 'Talk to Maryam'}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={() => openTab('chats')}
            title="Maryam se chat karo"
            className="p-4 rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25 shadow-xl transition-all"
          >
            <MessageCircle size={22} />
          </button>
          <span className="text-[10px] text-white/70 font-medium">Chat</span>
        </div>
      </div>

      {/* Bottom nav */}
      <OwnerBottomNav activeTab={tab} onSelect={openTab} />

    </div>
  );
};

// ---------- Shared top bar for inner tabs ----------
const OwnerTopBar: React.FC<{
  title: string;
  subtitle: string;
  onBack: () => void;
  onLogout: () => void;
  onOpenOwnerAdmin: () => void;
}> = ({ title, subtitle, onBack, onLogout, onOpenOwnerAdmin }) => (
  <div className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <button
        onClick={onBack}
        className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-white"
        title="Wapas Pari ke paas"
      >
        <Home size={16} />
      </button>
      <div>
        <h2 className="text-white font-bold text-sm">{title}</h2>
        <p className="text-slate-500 text-[11px]">{subtitle}</p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={onOpenOwnerAdmin}
        className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300"
        title="Owner Admin"
      >
        <ShieldCheck size={15} />
      </button>
      <button
        onClick={onLogout}
        className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300"
        title="Logout"
      >
        <LogOut size={15} />
      </button>
    </div>
  </div>
);

// ---------- Shared bottom nav ----------
const OwnerBottomNav: React.FC<{
  activeTab: OwnerTab;
  onSelect: (t: OwnerTab) => void;
}> = ({ activeTab, onSelect }) => {
  const items: { id: OwnerTab; icon: React.ReactNode; label: string }[] = [
    { id: 'home', icon: <Home size={20} />, label: 'Home' },
    { id: 'chats', icon: <MessageCircle size={20} />, label: 'Chats' },
    { id: 'memory', icon: <Brain size={20} />, label: 'Memory' },
    { id: 'tasks', icon: <CheckSquare size={20} />, label: 'Tasks' },
    { id: 'social', icon: <Share2 size={20} />, label: 'Social' },
    { id: 'settings', icon: <Settings size={20} />, label: 'Settings' },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 bg-black/80 backdrop-blur border-t border-white/10">
      <div className="flex justify-around max-w-lg mx-auto py-2 px-1">
        {items.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`flex flex-col items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium rounded-xl transition-all ${
              activeTab === t.id ? 'text-rose-400' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PariOwnerHome;
