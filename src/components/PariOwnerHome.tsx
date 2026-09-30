import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  Video,
  VideoOff,
  MessageCircle,
  CheckSquare,
  Settings,
  LogOut,
  Home,
} from 'lucide-react';
import { HoorviaDashboard } from './HoorviaDashboard';
import { CameraManager } from '../lib/cameraManager';

interface PariOwnerHomeProps {
  token: string;
  user: any;
  initialCompanion: any;
  onLogout: () => void;
  onOpenOwnerAdmin: () => void;
}

type SimpleTab = 'home' | 'chat' | 'tasks' | 'settings';

export const PariOwnerHome: React.FC<PariOwnerHomeProps> = ({
  token,
  user,
  initialCompanion,
  onLogout,
  onOpenOwnerAdmin,
}) => {
  const [tab, setTab] = useState<SimpleTab>('home');
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const openSection = (t: SimpleTab) => setTab(t);

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
      /* camera blocked */
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

  // Simple sections — reuse the working dashboard
  if (tab !== 'home') {
    return (
      <div className="min-h-screen bg-slate-950">
        <button
          onClick={() => setTab('home')}
          className="fixed top-4 left-4 z-50 px-4 py-2 rounded-full bg-rose-500 text-white text-sm font-semibold shadow-lg"
        >
          ← Pari
        </button>
        <HoorviaDashboard
          token={token}
          user={user}
          initialCompanion={initialCompanion}
          onLogout={onLogout}
          onOpenOwnerAdmin={onOpenOwnerAdmin}
          initialTab={tab as any}
        />
      </div>
    );
  }

  // Simple home — just Pari, talk, camera
  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      <img
        src="/pari-avatar-animated.gif"
        alt="Pari"
        className="absolute inset-0 w-full h-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).src =
            '/media-generation-pari-avatar-cartoon-0-0816b3d0-4109-4676-adba-d13b2dbd149c.webp';
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

      <div className="absolute top-5 left-5 z-10">
        <h1 className="text-white text-lg font-bold">Pari 💛</h1>
      </div>
      <button
        onClick={onLogout}
        className="absolute top-5 right-5 z-10 p-2 rounded-full bg-white/15 text-white"
      >
        <LogOut size={16} />
      </button>

      {cameraOn && (
        <div className="absolute bottom-32 right-4 w-28 h-36 rounded-xl overflow-hidden border border-white/40 z-10 bg-slate-900">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        </div>
      )}

      <div className="absolute bottom-24 left-0 right-0 z-10 flex items-center justify-center gap-6">
        <button
          onClick={toggleCamera}
          className={`p-3.5 rounded-full ${
            cameraOn ? 'bg-white text-slate-900' : 'bg-white/15 text-white'
          }`}
        >
          {cameraOn ? <Video size={20} /> : <VideoOff size={20} />}
        </button>
        <button
          onClick={() => openSection('chat')}
          className="p-5 rounded-full bg-rose-500 text-white shadow-xl"
        >
          <Phone size={26} />
        </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 bg-black/70 backdrop-blur border-t border-white/10">
        <div className="flex justify-around max-w-md mx-auto py-2">
          {[
            { id: 'home', icon: <Home size={20} />, label: 'Home' },
            { id: 'chat', icon: <MessageCircle size={20} />, label: 'Chat' },
            { id: 'tasks', icon: <CheckSquare size={20} />, label: 'Tasks' },
            { id: 'settings', icon: <Settings size={20} />, label: 'Settings' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => openSection(t.id as SimpleTab)}
              className={`flex flex-col items-center gap-1 px-4 py-1.5 text-[10px] ${
                tab === t.id ? 'text-rose-400' : 'text-white/50'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
