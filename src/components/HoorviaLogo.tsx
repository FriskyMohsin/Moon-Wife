import React from 'react';

interface HoorviaLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  className?: string;
}

/**
 * Hoorvia Logo Component
 * Bespoke luxury geometric crystal mark and official brand typography.
 * Vector-rendered SVG ensures zero asset-loading lag and pristine scaling.
 */
export const HoorviaLogo: React.FC<HoorviaLogoProps> = ({
  size = 'md',
  showSubtitle = true,
  className = '',
}) => {
  const iconDimensions = {
    sm: { container: 'w-7 h-7', px: 28 },
    md: { container: 'w-9 h-9', px: 36 },
    lg: { container: 'w-11 h-11', px: 44 },
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
      {/* Bespoke Geometric Crystal Vector Mark */}
      <div className={`${iconDimensions[size].container} shrink-0 relative flex items-center justify-center`}>
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_0_12px_rgba(244,63,94,0.4)]"
        >
          <defs>
            <linearGradient id="hoorviaHexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="50%" stopColor="#e11d48" />
              <stop offset="100%" stopColor="#9333ea" />
            </linearGradient>
            <linearGradient id="hoorviaTopFacet" x1="0%" y1="0%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#fda4af" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="hoorviaMonogram" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#ffe4e6" />
            </linearGradient>
          </defs>

          {/* Outer Rounded Container Badge */}
          <rect width="48" height="48" rx="12" fill="#0c040e" />
          <rect
            width="46"
            height="46"
            x="1"
            y="1"
            rx="11"
            stroke="url(#hoorviaHexGrad)"
            strokeWidth="1.2"
            strokeOpacity="0.5"
            fill="none"
          />

          {/* Faceted Crystal Monogram Body */}
          <path
            d="M24 7 L39 16 L39 32 L24 41 L9 32 L9 16 Z"
            fill="url(#hoorviaHexGrad)"
            fillOpacity="0.85"
          />
          {/* Top Facet */}
          <path d="M24 7 L39 16 L24 21 L9 16 Z" fill="url(#hoorviaTopFacet)" />
          {/* Left Shading */}
          <path d="M9 16 L24 21 L24 41 L9 32 Z" fill="#ffffff" fillOpacity="0.12" />
          {/* Right Shading */}
          <path d="M39 16 L24 21 L24 41 L39 32 Z" fill="#4c0519" fillOpacity="0.35" />

          {/* Crisp 'H' Monogram Architecture */}
          <path
            d="M19 18 L19 30 M29 18 L29 30 M19 24 L29 24"
            stroke="url(#hoorviaMonogram)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Neural Sparkle / Ambient Point */}
          <circle cx="24" cy="13" r="1.2" fill="#ffffff" />
        </svg>
      </div>

      {/* Brand Typography */}
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
