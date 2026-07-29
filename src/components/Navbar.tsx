import React from 'react';
import { Smile, Bell, Settings, ShieldCheck, Sparkles, Clock, User, ChevronDown, Calendar, Cloud, CheckCircle2 } from 'lucide-react';
import { WearStatus, UserProfile, AlignerSettings, getTrayDuration } from '../types';
import { User as FirebaseUser } from '../lib/firebase';

interface NavbarProps {
  currentTray: number;
  totalTrays: number;
  wearStatus: WearStatus;
  unreadCount: number;
  currentAccount?: UserProfile;
  settings?: AlignerSettings;
  authUser?: FirebaseUser | null;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  onOpenChewiesTimer: () => void;
  onOpenAccountSwitcher: () => void;
  onOpenAuthModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTray,
  totalTrays,
  wearStatus,
  unreadCount,
  currentAccount,
  settings,
  authUser,
  onOpenNotifications,
  onOpenSettings,
  onOpenChewiesTimer,
  onOpenAccountSwitcher,
  onOpenAuthModal,
}) => {
  const trayStart = settings?.trayStartDate ? new Date(settings.trayStartDate).getTime() : Date.now();
  const diffDays = Math.max(1, Math.floor((Date.now() - trayStart) / (1000 * 60 * 60 * 24)) + 1);
  const durationDays = settings ? getTrayDuration(settings, currentTray) : 7;
  const currentDay = Math.min(durationDays, diffDays);

  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Logo & Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-teal-500/20 shrink-0">
            <Smile className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="font-bold text-base sm:text-lg tracking-tight text-slate-100">AlignerTrack</h1>
            </div>
          </div>
        </div>

        {/* Header Center/Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Google Auth / Cloud Sync Status Button */}
          <button
            type="button"
            onClick={onOpenAuthModal}
            className={`flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              authUser
                ? 'bg-teal-500/10 border-teal-500/30 text-teal-300 hover:bg-teal-500/20'
                : 'bg-white hover:bg-slate-100 text-slate-900 border-white shadow-sm'
            }`}
            title={authUser ? `Synced as ${authUser.displayName || authUser.email}` : 'Sign in with Google to sync across devices'}
          >
            {authUser ? (
              <>
                {authUser.photoURL ? (
                  <img
                    src={authUser.photoURL}
                    alt="User"
                    className="w-4 h-4 rounded-full border border-teal-400 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Cloud className="w-3.5 h-3.5 text-teal-400" />
                )}
                <span className="hidden sm:inline-block max-w-[90px] truncate text-[11px]">
                  {authUser.displayName?.split(' ')[0] || 'Synced'}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse shadow-[0_0_6px_#2dd4bf]" />
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.15C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.39l3.99-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.72-4.96z"
                  />
                </svg>
                <span className="text-[11px] font-bold">Google Login</span>
              </>
            )}
          </button>

          {/* Tray & Day Status Badge (Hidden on Mobile) */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-200 text-xs">
            <Calendar className="w-3.5 h-3.5 text-teal-400" />
            <div className="flex items-center gap-1 text-[11px] font-semibold">
              <span className="text-slate-100">Tray {currentTray}</span>
              <span className="text-slate-500">•</span>
              <span className="text-teal-300">Day {currentDay}</span>
            </div>
          </div>

          {/* Active Account Switcher Pill */}
          {currentAccount && (
            <button
              onClick={onOpenAccountSwitcher}
              className="flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-slate-200 text-xs border border-slate-700/80 transition-all"
              title="Switch Patient Profile"
            >
              <div
                className={`w-5 h-5 rounded-lg bg-gradient-to-tr ${
                  currentAccount.avatarColor || 'from-teal-500 to-cyan-400'
                } flex items-center justify-center text-slate-950 text-[10px] font-bold shadow-sm shrink-0`}
              >
                <User className="w-3 h-3 stroke-[2.5]" />
              </div>
              <span className="font-medium hidden sm:inline-block max-w-[100px] truncate">
                {currentAccount.name}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          )}

          {/* Live Wear Status Dot (Hidden on Mobile) */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              wearStatus === 'in'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                wearStatus === 'in' ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
              }`}
            />
            <span className="text-[11px]">{wearStatus === 'in' ? 'In' : 'Out'}</span>
          </div>

          {/* Notification Bell */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Settings Button (Hidden on Mobile, available in bottom menu) */}
          <button
            onClick={onOpenSettings}
            className="hidden sm:flex p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-colors"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
