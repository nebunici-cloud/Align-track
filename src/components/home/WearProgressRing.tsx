import React from 'react';

interface WearProgressRingProps {
  wornSeconds: number;
  goalSeconds: number;
  hoursLabel: string;
  minutesLabel: string;
}

const SIZE = 124;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const WearProgressRing: React.FC<WearProgressRingProps> = ({
  wornSeconds,
  goalSeconds,
  hoursLabel,
  minutesLabel,
}) => {
  const progress = goalSeconds > 0 ? Math.min(wornSeconds / goalSeconds, 1) : 0;
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div
      className="relative shrink-0"
      style={{ width: SIZE, height: SIZE }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={goalSeconds}
      aria-valuenow={Math.min(wornSeconds, goalSeconds)}
      aria-label={`Today's wear: ${hoursLabel} hours ${minutesLabel} minutes`}
    >
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <defs>
          <linearGradient id="tz-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--tz-brand-teal)" />
            <stop offset="100%" stopColor="var(--tz-brand-mint)" />
          </linearGradient>
        </defs>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--tz-state-inactive)"
          strokeOpacity={0.55}
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="url(#tz-ring-gradient)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-medium tabular-nums" style={{ color: 'var(--tz-text-primary)' }}>
          {hoursLabel}
        </span>
        <span className="text-lg tabular-nums" style={{ color: 'var(--tz-text-primary)' }}>
          {minutesLabel}
        </span>
      </div>
    </div>
  );
};
