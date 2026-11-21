import React from 'react';

/** The Angle Lens mark: cyan angle, gold arc, white vertex (same drawing as public/logo.svg). */
const AngleLensLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="28 30 56 48" className={className} aria-hidden="true">
    <defs>
      <filter id="al-glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="1.4" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
    <g fill="none" strokeLinecap="round" filter="url(#al-glow)">
      <path d="M56,72 A22,22 0 0,0 48.14,55.15" stroke="#FBBF24" strokeWidth="5" />
      <path d="M78,72 L34,72 L62.3,38.3" stroke="#22D3EE" strokeWidth="6" strokeLinejoin="round" />
    </g>
    <circle cx="34" cy="72" r="5" fill="#FFFFFF" />
  </svg>
);

export default AngleLensLogo;
