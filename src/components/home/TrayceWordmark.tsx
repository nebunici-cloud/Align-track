import React from 'react';

/**
 * Text-based approximation of the approved X1 wordmark (no SVG asset was
 * supplied). Swap the <span> + circle below for the real exported SVG when
 * it's available — geometry (circle position relative to the final letter)
 * is kept close to the spec so the swap should be a drop-in.
 */
export const TrayceWordmark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    className={`inline-flex items-start font-light lowercase tracking-tight select-none ${className}`}
    style={{ color: 'var(--tz-text-primary)' }}
  >
    trayce
    <svg width="10" height="10" viewBox="0 0 10 10" className="ml-0.5 mt-0.5">
      <circle cx="5" cy="5" r="4" fill="none" stroke="var(--tz-brand-teal)" strokeWidth="1.6" />
    </svg>
  </span>
);
