import React from 'react';
import { Home, Clock, BarChart3, Camera } from 'lucide-react';
import { TrayceTheme } from '../../hooks/useTrayceTheme';

export type TrayceNavDestination = 'home' | 'logs' | 'analytics' | 'photos';

interface TrayceBottomNavProps {
  theme: TrayceTheme;
  active: TrayceNavDestination;
  onNavigate: (destination: TrayceNavDestination) => void;
}

const TABS: {
  id: TrayceNavDestination;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'logs', label: 'History', icon: Clock },
  { id: 'analytics', label: 'Insights', icon: BarChart3 },
  { id: 'photos', label: 'Diary', icon: Camera },
];

export const TrayceBottomNav: React.FC<TrayceBottomNavProps> = ({ theme, active, onNavigate }) => {
  return (
    <nav
      className={`tz-scope tz-${theme} fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md rounded-full flex items-center justify-around px-2 py-2 shadow-2xl backdrop-blur-xl`}
      style={{ backgroundColor: 'var(--tz-surface-card)', border: '1px solid var(--tz-border-subtle)' }}
      aria-label="Primary"
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            className="flex flex-col items-center justify-center gap-1 min-w-[44px] min-h-[44px] px-3 py-1 rounded-full"
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon
              className="w-5 h-5"
              style={{ color: isActive ? 'var(--tz-brand-teal)' : 'var(--tz-text-secondary)' }}
            />
            <span
              className="text-[11px]"
              style={{
                color: isActive ? 'var(--tz-brand-teal)' : 'var(--tz-text-secondary)',
                fontWeight: isActive ? 700 : 400,
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
