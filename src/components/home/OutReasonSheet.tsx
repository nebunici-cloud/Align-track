import React from 'react';
import { Utensils, Coffee, Apple, Sparkles, Activity, Clock, X } from 'lucide-react';
import { OutReason } from '../../types';
import { TrayceTheme } from '../../hooks/useTrayceTheme';

interface OutReasonSheetProps {
  theme: TrayceTheme;
  onSelect: (reason: OutReason) => void;
  onClose: () => void;
}

const REASONS: { id: OutReason; label: string; icon: React.ReactNode }[] = [
  { id: 'lunch', label: 'Lunch', icon: <Utensils className="w-5 h-5" /> },
  { id: 'dinner', label: 'Dinner', icon: <Utensils className="w-5 h-5" /> },
  { id: 'breakfast', label: 'Breakfast', icon: <Apple className="w-5 h-5" /> },
  { id: 'snack', label: 'Snack', icon: <Apple className="w-5 h-5" /> },
  { id: 'coffee_drink', label: 'Drinks', icon: <Coffee className="w-5 h-5" /> },
  { id: 'brushing_cleaning', label: 'Hygiene', icon: <Sparkles className="w-5 h-5" /> },
  { id: 'sports', label: 'Sports', icon: <Activity className="w-5 h-5" /> },
  { id: 'other', label: 'Other', icon: <Clock className="w-5 h-5" /> },
];

export const OutReasonSheet: React.FC<OutReasonSheetProps> = ({ theme, onSelect, onClose }) => {
  return (
    <div className={`tz-scope tz-${theme} fixed inset-0 z-50 flex items-end justify-center`} role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-t-[28px] p-5 pb-8 space-y-4 animate-in slide-in-from-bottom duration-200"
        style={{ backgroundColor: 'var(--tz-surface-card)', borderTop: '1px solid var(--tz-border-subtle)' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold" style={{ color: 'var(--tz-text-primary)' }}>
            Why are you taking them out?
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--tz-surface-card-deep)' }}
          >
            <X className="w-4 h-4" style={{ color: 'var(--tz-text-secondary)' }} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2.5">
          {REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelect(r.id)}
              className="rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 text-center min-h-[72px] transition-transform active:scale-95"
              style={{
                backgroundColor: 'var(--tz-surface-card-deep)',
                border: '1px solid var(--tz-border-subtle)',
                color: 'var(--tz-text-secondary)',
              }}
            >
              <span style={{ color: 'var(--tz-accent-sand)' }}>{r.icon}</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--tz-text-primary)' }}>
                {r.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
