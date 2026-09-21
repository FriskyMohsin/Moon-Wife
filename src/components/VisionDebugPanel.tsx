import React from 'react';
import { VisionDiagnostics } from '../types';
import { Eye, Camera, AlertCircle } from 'lucide-react';

interface VisionDebugPanelProps {
  diagnostics: VisionDiagnostics;
  isCameraActive: boolean;
}

export const VisionDebugPanel: React.FC<VisionDebugPanelProps> = ({ diagnostics, isCameraActive }) => {
  return (
    <div className="bg-zinc-950/95 border border-emerald-500/40 rounded-xl p-3.5 text-xs font-mono shadow-2xl backdrop-blur-md text-zinc-100 my-2">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2.5">
        <div className="flex items-center gap-2 font-bold text-emerald-400 tracking-wider">
          <Eye className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>VISION DEBUG</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isCameraActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-zinc-800 text-zinc-400'}`}>
            CAM: {diagnostics.CAMERA_STATE}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
        <div className="flex justify-between border-b border-zinc-800/40 pb-1">
          <span className="text-zinc-400">CAMERA_STATE:</span>
          <span className={diagnostics.CAMERA_STATE === 'ON' ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
            {diagnostics.CAMERA_STATE}
          </span>
        </div>

        <div className="flex justify-between border-b border-zinc-800/40 pb-1">
          <span className="text-zinc-400">MEDIA_STREAM_ACTIVE:</span>
          <span className={diagnostics.MEDIA_STREAM_ACTIVE ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>
            {diagnostics.MEDIA_STREAM_ACTIVE ? 'true' : 'false'}
          </span>
        </div>

        <div className="flex justify-between border-b border-zinc-800/40 pb-1">
          <span className="text-zinc-400">VIDEO_WIDTH:</span>
          <span className="text-zinc-200">{diagnostics.VIDEO_WIDTH} px</span>
        </div>

        <div className="flex justify-between border-b border-zinc-800/40 pb-1">
          <span className="text-zinc-400">VIDEO_HEIGHT:</span>
          <span className="text-zinc-200">{diagnostics.VIDEO_HEIGHT} px</span>
        </div>

        <div className="flex justify-between border-b border-zinc-800/40 pb-1">
          <span className="text-zinc-400">VISION_INTENT_DETECTED:</span>
          <span className={diagnostics.VISION_INTENT_DETECTED ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>
            {diagnostics.VISION_INTENT_DETECTED ? 'true' : 'false'}
          </span>
        </div>

        <div className="flex justify-between border-b border-zinc-800/40 pb-1">
          <span className="text-zinc-400">FRAME_BYTES:</span>
          <span className="text-zinc-200">{diagnostics.FRAME_BYTES} B</span>
        </div>

        <div className="flex justify-between border-b border-zinc-800/40 pb-1">
          <span className="text-zinc-400">VISION_API_CALLED:</span>
          <span className={diagnostics.VISION_API_CALLED ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>
            {diagnostics.VISION_API_CALLED ? 'true' : 'false'}
          </span>
        </div>

        <div className="flex justify-between border-b border-zinc-800/40 pb-1">
          <span className="text-zinc-400">VISION_HTTP_STATUS:</span>
          <span className="text-zinc-200 font-semibold">{diagnostics.VISION_HTTP_STATUS}</span>
        </div>

        <div className="flex justify-between col-span-2 border-b border-zinc-800/40 pb-1">
          <span className="text-zinc-400">VISION_CONTEXT_INJECTED_TO_MARYAM:</span>
          <span className={diagnostics.VISION_CONTEXT_INJECTED_TO_MARYAM ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
            {diagnostics.VISION_CONTEXT_INJECTED_TO_MARYAM ? 'true' : 'false'}
          </span>
        </div>
      </div>

      {diagnostics.VISION_ERROR && (
        <div className="mt-2.5 p-2 bg-rose-950/40 border border-rose-500/40 rounded flex items-center gap-2 text-rose-300 text-[11px]">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
          <span className="truncate">VISION_ERROR: {diagnostics.VISION_ERROR}</span>
        </div>
      )}

      {diagnostics.VISION_RESULT_PREVIEW && (
        <div className="mt-2.5 pt-2 border-t border-zinc-800">
          <div className="text-[10px] text-zinc-400 mb-1 font-semibold uppercase tracking-wider">VISION_RESULT_PREVIEW:</div>
          <div className="text-[11px] text-zinc-200 italic line-clamp-2 bg-black/60 p-2 rounded border border-zinc-800">
            "{diagnostics.VISION_RESULT_PREVIEW}"
          </div>
        </div>
      )}
    </div>
  );
};
