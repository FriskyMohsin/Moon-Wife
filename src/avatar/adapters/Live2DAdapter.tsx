import React, { useState } from 'react';
import { IAvatarAdapterProps } from '../types';
import { LayeredCharacterAdapter } from './LayeredCharacterAdapter';
import { Sparkles, Layers } from 'lucide-react';

export const Live2DAdapter: React.FC<IAvatarAdapterProps> = (props) => {
  const [hasModel] = useState<boolean>(false); // Live2D model loader hook

  // If live2d model is not loaded, fallback seamlessly to LayeredCharacterAdapter with explicit development placeholder badge
  return (
    <div className="relative w-full h-full">
      {/* Explicit Architecture Development Placeholder Indicator */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-950/70 border border-violet-700/40 text-[10px] text-violet-200 backdrop-blur-md">
        <Layers className="w-3 h-3 text-violet-400" />
        <span className="font-mono">Adapter: Live2D / Layered Hybrid</span>
      </div>

      {/* Render Active Character */}
      <LayeredCharacterAdapter {...props} />
    </div>
  );
};
