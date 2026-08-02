import React from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';

interface NextUpCardProps {
  title: string;
  subtitle: string;
  completedRoutines?: number;
  totalRoutines?: number;
  onOpen: () => void;
}

export const NextUpCard: React.FC<NextUpCardProps> = ({ title, subtitle, completedRoutines, totalRoutines, onOpen }) => {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[22px] p-4 flex items-center gap-3 text-left transition-transform active:scale-[0.99]"
      style={{ backgroundColor: 'var(--tz-surface-card)', border: '1px solid var(--tz-border-subtle)' }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: 'var(--tz-surface-card-deep)', border: '1px solid var(--tz-border-subtle)' }}
      >
        <Sparkles className="w-4 h-4" style={{ color: 'var(--tz-brand-teal)' }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--tz-text-secondary)' }}>
          Next up
        </p>
        <p className="text-sm font-bold truncate" style={{ color: 'var(--tz-text-primary)' }}>
          {title}
        </p>
        {completedRoutines !== undefined && totalRoutines !== undefined && totalRoutines > 0 ? (
          <p className="text-xs font-medium" style={{ color: 'var(--tz-brand-teal)' }}>
            {completedRoutines} of {totalRoutines} routines completed
          </p>
        ) : (
          <p className="text-xs" style={{ color: 'var(--tz-text-secondary)' }}>
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 text-xs font-semibold shrink-0" style={{ color: 'var(--tz-brand-teal)' }}>
        <span>View plan</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </div>
    </button>
  );
};
