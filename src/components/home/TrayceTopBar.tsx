import React from 'react';
import { Sun, Moon, Bell, User } from 'lucide-react';
import { TrayceTheme } from '../../hooks/useTrayceTheme';

interface TrayceTopBarProps {
  theme: TrayceTheme;
  onThemeChange: (theme: TrayceTheme) => void;
  unreadCount: number;
  avatarUrl?: string | null;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
}

export const TrayceTopBar: React.FC<TrayceTopBarProps> = ({
  theme,
  onThemeChange,
  unreadCount,
  avatarUrl,
  onOpenNotifications,
  onOpenProfile,
}) => {
  return (
    <div className="flex items-center justify-end gap-2.5 px-10 pt-8">
      <div
        className="flex items-center gap-0.5 p-1 rounded-full"
        style={{ backgroundColor: 'var(--tz-surface-card-deep)', border: '1px solid var(--tz-border-subtle)' }}
        role="radiogroup"
        aria-label="Theme"
      >
        <button
          type="button"
          role="radio"
          aria-checked={theme === 'light'}
          aria-label="Light theme"
          onClick={() => onThemeChange('light')}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
          style={{
            backgroundColor: theme === 'light' ? 'var(--tz-accent-sand)' : 'transparent',
            color: theme === 'light' ? '#092337' : 'var(--tz-text-secondary)',
          }}
        >
          <Sun className="w-4 h-4" />
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={theme === 'dark'}
          aria-label="Dark theme"
          onClick={() => onThemeChange('dark')}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
          style={{
            backgroundColor: theme === 'dark' ? 'var(--tz-surface-card)' : 'transparent',
            color: theme === 'dark' ? 'var(--tz-brand-mint)' : 'var(--tz-text-secondary)',
          }}
        >
          <Moon className="w-4 h-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={onOpenNotifications}
        aria-label="Notifications"
        className="relative w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: 'var(--tz-surface-card-deep)', border: '1px solid var(--tz-border-subtle)' }}
      >
        <Bell className="w-4 h-4" style={{ color: 'var(--tz-text-secondary)' }} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={onOpenProfile}
        aria-label="Open settings"
        className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden shrink-0"
        style={{ backgroundColor: 'var(--tz-surface-card-deep)', border: '1px solid var(--tz-border-subtle)' }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <User className="w-4.5 h-4.5" style={{ color: 'var(--tz-brand-teal)' }} />
        )}
      </button>
    </div>
  );
};
