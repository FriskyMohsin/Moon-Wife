import React, { useEffect, useRef, useState } from 'react';
import { CameraManager, CameraState } from '../lib/cameraManager';
import { Camera, CameraOff, Video, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CameraPreviewProps {
  stream?: MediaStream | null;
  isActive?: boolean;
  onToggleCamera?: () => void;
  onStopCamera?: () => void;
  onCaptureVision?: () => void;
  onSwitchCamera?: () => void;
}

export const CameraPreview: React.FC<CameraPreviewProps> = ({ stream, isActive, onToggleCamera, onStopCamera, onCaptureVision, onSwitchCamera }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>(() =>
    CameraManager.getInstance().getState()
  );

  useEffect(() => {
    const unsub = CameraManager.getInstance().subscribe((newState) => {
      setCameraState(newState);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (videoRef.current && cameraState.isActive) {
      CameraManager.getInstance().attachVideoElement(videoRef.current);
    }
  }, [cameraState.isActive]);

  if (!cameraState.isActive && !cameraState.error) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="fixed bottom-20 right-4 z-40 w-64 bg-zinc-950/90 backdrop-blur-xl border border-rose-500/40 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-rose-500/20"
      >
        {/* Header Indicator */}
        <div className="px-3 py-2 bg-zinc-900/80 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
            <span className="text-[11px] font-semibold text-rose-300 uppercase tracking-wider flex items-center gap-1">
              <Video className="w-3.5 h-3.5" />
              <span>Camera Live</span>
            </span>
          </div>

          <div className="flex items-center gap-1">
            {onCaptureVision && (
              <button
                onClick={onCaptureVision}
                className="p-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800/50 text-[10px] font-medium px-2 transition-all"
                title="Capture current view for Maryam"
              >
                Snap
              </button>
            )}
            {onSwitchCamera && (
              <button onClick={onSwitchCamera} className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-300" title="Switch front/back camera">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              id="btn-close-camera-preview"
              onClick={onStopCamera || onToggleCamera}
              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-all"
              title="Turn camera off"
            >
              <CameraOff className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Video stream or Error View */}
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
          {cameraState.error ? (
            <div className="p-4 text-center space-y-2">
              <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
              <p className="text-xs text-amber-200 leading-snug">{cameraState.error}</p>
              <button
                onClick={() => CameraManager.getInstance().startCamera()}
                className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-medium border border-amber-500/40 transition-all inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[9px] text-zinc-300 border border-white/10">
                {cameraState.facingMode === 'user' ? 'Front Camera' : 'Back Camera'}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
