import React from 'react';
import { ChevronRight } from 'lucide-react';

interface TreatmentShortcutProps {
  currentTray: number;
  totalTrays: number;
  daysRemaining: number;
  completionPercent: number;
  onOpen: () => void;
}

export const TreatmentShortcut: React.FC<TreatmentShortcutProps> = ({
  currentTray,
  totalTrays,
  daysRemaining,
  completionPercent,
  onOpen,
}) => {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[22px] p-4 flex items-center gap-3 text-left transition-transform active:scale-[0.99]"
      style={{ backgroundColor: 'var(--tz-surface-card)', border: '1px solid var(--tz-border-subtle)' }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
        style={{ backgroundColor: 'var(--tz-surface-card-deep)', border: '1px solid var(--tz-border-subtle)', color: 'var(--tz-brand-teal)' }}
      >
        {currentTray}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: 'var(--tz-text-primary)' }}>
          Tray {currentTray} of {totalTrays}
        </p>
        <p className="text-xs" style={{ color: 'var(--tz-text-secondary)' }}>
          {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <p className="text-xs font-bold" style={{ color: 'var(--tz-brand-teal)' }}>
            {completionPercent}% complete
          </p>
          <div className="w-20 h-1.5 rounded-full mt-1" style={{ backgroundColor: 'var(--tz-state-inactive)' }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${completionPercent}%`, backgroundColor: 'var(--tz-brand-teal)' }}
            />
          </div>
        </div>
        <ChevronRight className="w-4 h-4" style={{ color: 'var(--tz-text-secondary)' }} />
      </div>
    </button>
  );
};
