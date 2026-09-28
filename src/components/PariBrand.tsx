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
      <img
        src="/pari-avatar.png"
        alt="Pari AI"
        className={`${iconBox} shrink-0 rounded-full object-cover object-top border border-fuchsia-400/50 shadow-[0_0_14px_rgba(255,45,150,0.50)]`}
      />
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
