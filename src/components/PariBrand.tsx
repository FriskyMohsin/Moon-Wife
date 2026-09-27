import React from 'react';

interface PariBrandProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  className?: string;
}

/**
 * Pari AI brand mark for the client panel.
 * (HoorviaLogo stays reserved for the owner/admin surfaces.)
 */
export const PariBrand: React.FC<PariBrandProps> = ({
  size = 'md',
  showSubtitle = true,
  className = '',
}) => {
  const iconBox = { sm: 'w-7 h-7', md: 'w-9 h-9', lg: 'w-11 h-11' }[size];
  const textSize = { sm: 'text-sm', md: 'text-base', lg: 'text-xl' }[size];
  const subSize = { sm: 'text-[9px]', md: 'text-[10px]', lg: 'text-xs' }[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`${iconBox} shrink-0 relative flex items-center justify-center`}>
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-[0_0_12px_rgba(244,63,94,0.4)]">
          <defs>
            <linearGradient id="pariOrbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="55%" stopColor="#e11d48" />
              <stop offset="100%" stopColor="#9333ea" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="14" fill="#0c040e" />
          <rect width="46" height="46" x="1" y="1" rx="13" stroke="url(#pariOrbGrad)" strokeWidth="1.2" strokeOpacity="0.55" fill="none" />
          <circle cx="24" cy="24" r="11" fill="url(#pariOrbGrad)" fillOpacity="0.9" />
          <circle cx="24" cy="24" r="15.5" stroke="url(#pariOrbGrad)" strokeWidth="1" strokeOpacity="0.45" fill="none" />
          <circle cx="20.5" cy="20.5" r="3.4" fill="#ffffff" fillOpacity="0.85" />
        </svg>
      </div>
      <div>
        <h1 className={`${textSize} font-extrabold tracking-tight text-white leading-tight`}>
          Pari <span className="text-rose-400 font-light">AI</span>
        </h1>
        {showSubtitle && (
          <p className={`${subSize} text-rose-300/70 font-medium tracking-wide`}>
            Your personal AI companion
          </p>
        )}
      </div>
    </div>
  );
};
