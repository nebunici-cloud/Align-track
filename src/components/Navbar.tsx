import React, { useEffect, useState } from 'react';
import { Smile, Bell, Settings, User, ChevronDown, Calendar } from 'lucide-react';
import { WearStatus, UserProfile, AlignerSettings, getTrayDuration } from '../types';
import { User as FirebaseUser } from '../lib/firebase';
import { getDayNumberSince } from '../utils/storage';

interface NavbarProps {
  currentTray: number;
  totalTrays: number;
  wearStatus: WearStatus;
  currentOutStartTime?: string | null;
  unreadCount: number;
  currentAccount?: UserProfile;
  settings?: AlignerSettings;
  authUser?: FirebaseUser | null;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  onOpenChewiesTimer: () => void;
  onOpenAccountSwitcher: () => void;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTray,
  totalTrays,
  wearStatus,
  currentOutStartTime,
  unreadCount,
  currentAccount,
  settings,
  authUser,
  onOpenNotifications,
  onOpenSettings,
  onOpenChewiesTimer,
  onOpenAccountSwitcher,
}) => {
  const diffDays = settings?.trayStartDate ? getDayNumberSince(settings.trayStartDate) : 1;
  const durationDays = settings ? getTrayDuration(settings, currentTray) : 7;
  const currentDay = Math.min(durationDays, diffDays);

  const [elapsedOutSeconds, setElapsedOutSeconds] = useState<number>(0);

  useEffect(() => {
    if (wearStatus !== 'out' || !currentOutStartTime) {
      setElapsedOutSeconds(0);
      return;
    }
    const tick = () => {
      setElapsedOutSeconds(Math.max(0, Math.floor((Date.now() - new Date(currentOutStartTime).getTime()) / 1000)));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [wearStatus, currentOutStartTime]);

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
          {/* Tray & Day Status Badge (Hidden on Mobile) */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-200 text-xs">
            <Calendar className="w-3.5 h-3.5 text-teal-400" />
            <div className="flex items-center gap-1 text-[11px] font-semibold">
              <span className="text-slate-100">Tray {currentTray}</span>
              <span className="text-slate-500">•</span>
              <span className="text-teal-300">Day {currentDay}</span>
            </div>
          </div>

          {/* Account Switcher + Sync Status + Live Wear Status (one combined control) */}
          {currentAccount && (
            <button
              onClick={onOpenAccountSwitcher}
              className="flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-slate-200 text-xs border border-slate-700/80 transition-all"
              title={
                authUser
                  ? `Signed in as ${authUser.displayName || authUser.email} — tap to switch patient profile`
                  : 'Tap to switch patient profile'
              }
            >
              {authUser?.photoURL ? (
                <img
                  src={authUser.photoURL}
                  alt=""
                  className="w-5 h-5 rounded-lg border border-slate-600 object-cover shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  className={`w-5 h-5 rounded-lg bg-gradient-to-tr ${
                    currentAccount.avatarColor || 'from-teal-500 to-cyan-400'
                  } flex items-center justify-center text-slate-950 text-[10px] font-bold shadow-sm shrink-0`}
                >
                  <User className="w-3 h-3 stroke-[2.5]" />
                </div>
              )}
              <span className="font-medium hidden sm:inline-block max-w-[100px] truncate">
                {currentAccount.name}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />

              <span
                className={`flex items-center gap-1 pl-1.5 sm:pl-2 ml-0.5 border-l border-slate-700 text-[10px] font-bold ${
                  wearStatus === 'in' ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    wearStatus === 'in' ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-amber-400 animate-pulse shadow-[0_0_6px_#fbbf24]'
                  }`}
                />
                {wearStatus === 'in' ? 'In' : `Out ${formatElapsed(elapsedOutSeconds)}`}
              </span>
            </button>
          )}

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
