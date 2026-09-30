import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  Video,
  VideoOff,
  MessageCircle,
  Brain,
  CheckSquare,
  Share2,
  Settings,
  LogOut,
  Home,
  Mic,
} from 'lucide-react';
import { HoorviaDashboard } from './HoorviaDashboard';
import { CameraManager } from '../lib/cameraManager';
import { HoorviaWhatsAppManager } from './HoorviaWhatsAppManager';
import { HoorviaTelegramManager } from './HoorviaTelegramManager';

interface PariOwnerHomeProps {
  token: string;
  user: any;
  initialCompanion: any;
  onLogout: () => void;
  onOpenOwnerAdmin: () => void;
}

type OwnerTab = 'home' | 'chat' | 'memory' | 'tasks' | 'social' | 'settings';

const TABS: Array<{ id: OwnerTab; label: string; icon: React.ReactNode; dashTab?: string }> = [
  { id: 'home', label: 'Home', icon: <Home size={20} /> },
  { id: 'chat', label: 'Chats', icon: <MessageCircle size={20} />, dashTab: 'chat' },
  { id: 'memory', label: 'Memory', icon: <Brain size={20} />, dashTab: 'memory' },
  { id: 'tasks', label: 'Tasks', icon: <CheckSquare size={20} />, dashTab: 'tasks' },
  { id: 'social', label: 'Social', icon: <Share2 size={20} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={20} />, dashTab: 'settings' },
];

export const PariOwnerHome: React.FC<PariOwnerHomeProps> = ({
  token,
  user,
  initialCompanion,
  onLogout,
  onOpenOwnerAdmin,
}) => {
  const [tab, setTab] = useState<OwnerTab>('home');
  const [cameraOn, setCameraOn] = useState(false);
  const [dashTab, setDashTab] = useState<string>('chat');
  const [dashKey, setDashKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const goDash = (dt: string) => {
    setDashTab(dt);
    setDashKey((k) => k + 1);
    setTab('chat'); // reuse chat slot for dashboard embed
  };

  const handleTab = (t: OwnerTab) => {
    const found = TABS.find((x) => x.id === t);
    if (found?.dashTab) {
      goDash(found.dashTab);
      return;
    }
    setTab(t);
  };

  const toggleCamera = async () => {
    try {
      if (cameraOn) {
        CameraManager.getInstance().stopCamera();
        setCameraOn(false);
      } else {
        await CameraManager.getInstance().startCamera();
        setCameraOn(true);
      }
    } catch {
      /* camera blocked — stay off */
    }
  };

  useEffect(() => {
    if (cameraOn && videoRef.current) {
      CameraManager.getInstance().attachVideoElement(videoRef.current);
    }
  }, [cameraOn, tab]);

  useEffect(() => {
    return () => {
      CameraManager.getInstance().stopCamera();
    };
  }, []);

  // ---- Embedded dashboard (chats / memory / tasks / settings) ----
  if (tab === 'chat' && dashTab) {
    return (
      <div className="min-h-screen bg-slate-950">
        <button
          onClick={() => setTab('home')}
          className="fixed top-4 left-4 z-50 px-4 py-2 rounded-full bg-rose-500 text-white text-sm font-semibold shadow-lg hover:bg-rose-400"
        >
          ← Pari Home
        </button>
        <HoorviaDashboard
          key={dashKey}
          token={token}
          user={user}
          initialCompanion={initialCompanion}
          onLogout={onLogout}
          onOpenOwnerAdmin={onOpenOwnerAdmin}
          initialTab={dashTab as any}
        />
      </div>
    );
  }

  // ---- Social tab (working WhatsApp + Telegram managers) ----
  if (tab === 'social') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white pb-24">
        <div className="p-6 max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold mb-1">Social Media</h1>
          <p className="text-sm text-slate-400 mb-6">Connected channels — sab working</p>
          <div className="space-y-6">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <HoorviaWhatsAppManager ownerToken={token} />
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <HoorviaTelegramManager ownerToken={token} />
            </div>
          </div>
        </div>
        <BottomNav tab={tab} onTab={handleTab} onLogout={onLogout} />
      </div>
    );
  }

  // ---- HOME: video-call style ----
  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      {/* Full-screen Pari GIF */}
      <img
        src="/pari-avatar-animated.gif"
        alt="Pari"
        className="absolute inset-0 w-full h-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/media-generation-pari-avatar-cartoon-0-0816b3d0-4109-4676-adba-d13b2dbd149c.webp';
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 p-5 flex items-center justify-between z-10">
        <div>
          <h1 className="text-white text-xl font-bold">Pari 💛</h1>
          <p className="text-white/70 text-xs">Online — ready to talk</p>
        </div>
        <button
          onClick={onLogout}
          className="p-2.5 rounded-full bg-white/15 backdrop-blur text-white hover:bg-white/25"
          title="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>

      {/* Camera preview (you) — picture-in-picture */}
      {cameraOn && (
        <div className="absolute bottom-36 right-4 w-36 h-48 rounded-2xl overflow-hidden border-2 border-white/40 shadow-2xl z-10 bg-slate-900">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <div className="absolute bottom-1 left-2 text-[10px] text-white/80 font-medium">You</div>
        </div>
      )}

      {/* Call controls */}
      <div className="absolute bottom-24 left-0 right-0 z-10">
        <p className="text-center text-white/85 text-sm mb-4 px-6">
          {cameraOn ? 'Pari can see you now 👀' : 'Tap talk — baat karo Pari se'}
        </p>
        <div className="flex items-center justify-center gap-5">
          <button
            onClick={toggleCamera}
            className={`p-4 rounded-full backdrop-blur shadow-xl transition ${
              cameraOn ? 'bg-white text-slate-900' : 'bg-white/15 text-white hover:bg-white/25'
            }`}
            title={cameraOn ? 'Camera off' : 'Camera on — Pari will see you'}
          >
            {cameraOn ? <Video size={22} /> : <VideoOff size={22} />}
          </button>
          <button
            onClick={() => goDash('voice')}
            className="p-6 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-2xl shadow-rose-900/50 hover:scale-105 transition-transform"
            title="Talk to Pari live"
          >
            <Phone size={30} />
          </button>
          <button
            onClick={() => goDash('voice')}
            className="p-4 rounded-full bg-white/15 backdrop-blur text-white hover:bg-white/25 transition"
            title="Voice options"
          >
            <Mic size={22} />
          </button>
        </div>
        <p className="text-center text-white/50 text-[11px] mt-3">
          Camera on karo — Pari dekhegi aur comment karegi
        </p>
      </div>

      <BottomNav tab={tab} onTab={handleTab} onLogout={onLogout} />
    </div>
  );
};

function BottomNav({
  tab,
  onTab,
  onLogout,
}: {
  tab: OwnerTab;
  onTab: (t: OwnerTab) => void;
  onLogout: () => void;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 bg-black/70 backdrop-blur-xl border-t border-white/10">
      <div className="flex items-center justify-around px-2 py-2 max-w-2xl mx-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onTab(t.id)}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-medium transition ${
              tab === t.id ? 'text-rose-400' : 'text-white/55 hover:text-white/85'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
        <button
          onClick={onLogout}
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-medium text-white/55 hover:text-white/85 transition"
        >
          <LogOut size={20} />
          Logout
        </button>
      </div>
    </div>
  );
}

