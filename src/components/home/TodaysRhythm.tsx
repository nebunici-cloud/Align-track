import React from 'react';

export type RhythmSegmentState = 'worn' | 'out' | 'future';

interface TodaysRhythmProps {
  segments: RhythmSegmentState[]; // 24 entries, one per hour
  wornLabel: string;
  outLabel: string;
}

const STATE_COLOR: Record<RhythmSegmentState, string> = {
  worn: 'var(--tz-brand-teal)',
  out: 'var(--tz-accent-sand)',
  future: 'var(--tz-state-inactive)',
};

export const TodaysRhythm: React.FC<TodaysRhythmProps> = ({ segments, wornLabel, outLabel }) => {
  return (
    <div
      className="rounded-[22px] p-4 space-y-2.5"
      style={{ backgroundColor: 'var(--tz-surface-card)', border: '1px solid var(--tz-border-subtle)' }}
    >
      <h3 className="text-lg font-bold" style={{ color: 'var(--tz-text-primary)' }}>
        Today&rsquo;s rhythm
      </h3>

      <div className="flex items-stretch gap-[4px] h-8" role="img" aria-hidden="true">
        {segments.map((state, index) => {
          // A single left-to-right brightness ramp applied over every segment,
          // regardless of its state color, so the timeline reads as one
          // continuous fade instead of restarting at each state change.
          const brightness = 0.82 + 0.32 * (index / (segments.length - 1));
          return (
            <div
              key={index}
              className="flex-1 rounded-full"
              style={{ backgroundColor: STATE_COLOR[state], filter: `brightness(${brightness})` }}
            />
          );
        })}
      </div>

      <div className="flex justify-between text-xs tabular-nums" style={{ color: 'var(--tz-text-secondary)' }}>
        <span>00:00</span>
        <span>12:00</span>
        <span>23:59</span>
      </div>

      <p className="sr-only">
        Today: aligners worn {wornLabel}; out {outLabel}.
      </p>

      <div className="flex items-center gap-4 pt-1 border-t text-xs" style={{ borderColor: 'var(--tz-border-subtle)' }}>
        <div className="flex items-center gap-1.5 pt-3">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--tz-brand-teal)' }} />
          <span style={{ color: 'var(--tz-text-secondary)' }}>
            Worn &middot; <span className="font-semibold tabular-nums" style={{ color: 'var(--tz-text-primary)' }}>{wornLabel}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 pt-3">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--tz-accent-sand)' }} />
          <span style={{ color: 'var(--tz-text-secondary)' }}>
            Out &middot; <span className="font-semibold tabular-nums" style={{ color: 'var(--tz-text-primary)' }}>{outLabel}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
