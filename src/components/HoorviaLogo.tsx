import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

interface HoorviaLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  className?: string;
}

/**
 * Hoorvia Logo Component
 * Prepared logo slot for the official Hoorvia.net logo asset.
 * If no custom logo asset is provided at /assets/hoorvia_logo.png (or SVG),
 * falls back to the clean vector mark and official typography.
 */
export const HoorviaLogo: React.FC<HoorviaLogoProps> = ({
  size = 'md',
  showSubtitle = true,
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);

  // Asset slot path for the future Hoorvia logo
  const logoAssetPath = '/assets/hoorvia_logo.png';

  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
  };

  const subTextSizes = {
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-xs',
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Prepared Image / Vector Emblem Slot */}
      {!imgError ? (
        <img
          src={logoAssetPath}
          alt="HOORVIA.NET"
          onError={() => setImgError(true)}
          className={`${iconSizes[size]} object-contain rounded-xl`}
          style={{ display: imgError ? 'none' : 'block' }}
        />
      ) : null}

      {imgError && (
        <div
          className={`${iconSizes[size]} rounded-xl bg-gradient-to-br from-rose-500 via-rose-600 to-purple-600 flex items-center justify-center shadow-md shadow-rose-950/50 shrink-0 border border-rose-400/20`}
        >
          <Sparkles className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Typography */}
      <div>
        <h1 className={`${textSizes[size]} font-extrabold tracking-tight text-white leading-tight flex items-center gap-1`}>
          HOORVIA<span className="text-rose-400 font-light">.NET</span>
        </h1>
        {showSubtitle && (
          <p className={`${subTextSizes[size]} text-rose-300/70 font-medium tracking-wide`}>
            AI Companion Platform
          </p>
        )}
      </div>
    </div>
  );
};
