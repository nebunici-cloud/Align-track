import React from 'react';
import { Home, Clock, BarChart3, Camera, HelpCircle, Settings, User } from 'lucide-react';
import { TrayceWordmark } from './TrayceWordmark';
import { TrayceTheme } from '../../hooks/useTrayceTheme';
import { UserProfile } from '../../types';
import type { TrayceNavDestination } from './TrayceBottomNav';

interface TrayceSidebarProps {
  theme: TrayceTheme;
  active: TrayceNavDestination;
  onNavigate: (destination: TrayceNavDestination) => void;
  currentAccount?: UserProfile;
  avatarUrl?: string | null;
  onOpenAccountSwitcher: () => void;
  onOpenSettings: () => void;
}

const NAV_ITEMS: { id: TrayceNavDestination; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'logs', label: 'History', icon: Clock },
  { id: 'analytics', label: 'Insights', icon: BarChart3 },
  { id: 'photos', label: 'Diary', icon: Camera },
];

export const TrayceSidebar: React.FC<TrayceSidebarProps> = ({
  theme,
  active,
  onNavigate,
  currentAccount,
  avatarUrl,
  onOpenAccountSwitcher,
  onOpenSettings,
}) => {
  return (
    <aside
      className={`tz-scope tz-${theme} w-[240px] shrink-0 h-screen sticky top-0 flex flex-col`}
      style={{ backgroundColor: 'var(--tz-surface-card)', borderRight: '1px solid var(--tz-border-subtle)' }}
    >
      <div className="px-8 pt-8 pb-6">
        <TrayceWordmark className="text-xl" />
      </div>

      <nav className="flex-1 px-4 space-y-1" aria-label="Primary">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className="w-full flex items-center gap-3 px-4 rounded-xl transition-colors"
              style={{
                minHeight: 48,
                backgroundColor: isActive ? 'var(--tz-surface-card-deep)' : 'transparent',
                color: isActive ? 'var(--tz-brand-teal)' : 'var(--tz-text-secondary)',
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className={`text-sm ${isActive ? 'font-semibold' : 'font-normal'}`}>{label}</span>
            </button>
          );
        })}
      </nav>

      {currentAccount && (
        <button
          type="button"
          onClick={onOpenAccountSwitcher}
          className="mx-4 mb-2 flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors"
          style={{ backgroundColor: 'var(--tz-surface-card-deep)' }}
          title="Switch patient profile"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
          ) : (
            <div
              className={`w-7 h-7 rounded-full bg-gradient-to-tr ${currentAccount.avatarColor || 'from-teal-500 to-cyan-400'} flex items-center justify-center text-slate-950 shrink-0`}
            >
              <User className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
          )}
          <span className="text-xs font-semibold truncate" style={{ color: 'var(--tz-text-primary)' }}>
            {currentAccount.name}
          </span>
        </button>
      )}

      <div className="px-4 pb-6 space-y-1">
        <a
          href="mailto:?subject=AlignerTrack%20help"
          className="w-full flex items-center gap-3 px-4 rounded-xl transition-colors"
          style={{ minHeight: 44, color: 'var(--tz-text-secondary)' }}
        >
          <HelpCircle className="w-4.5 h-4.5 shrink-0" />
          <span className="text-sm">Help</span>
        </a>
        <button
          type="button"
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 px-4 rounded-xl transition-colors"
          style={{ minHeight: 44, color: 'var(--tz-text-secondary)' }}
        >
          <Settings className="w-4.5 h-4.5 shrink-0" />
          <span className="text-sm">Settings</span>
        </button>
      </div>
    </aside>
  );
};
