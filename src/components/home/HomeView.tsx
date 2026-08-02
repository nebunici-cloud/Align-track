import React, { useEffect, useMemo, useState } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { AlignerSettings, MaintenanceTask, OutReason, WearLog, WearStatus, getTrayDuration } from '../../types';
import { getAvailableMinutesForDate, getDayNumberSince, getTodayDateString } from '../../utils/storage';
import { TrayceTheme } from '../../hooks/useTrayceTheme';
import { TrayceHeader } from './TrayceHeader';
import { WearProgressRing } from './WearProgressRing';
import { TodaysRhythm, RhythmSegmentState } from './TodaysRhythm';
import { NextUpCard } from './NextUpCard';
import { TreatmentShortcut } from './TreatmentShortcut';
import { OutReasonSheet } from './OutReasonSheet';

interface HomeViewProps {
  firstName: string;
  avatarUrl?: string | null;
  theme: TrayceTheme;
  onThemeChange: (theme: TrayceTheme) => void;
  wearStatus: WearStatus;
  currentOutStartTime: string | null;
  currentOutReason: OutReason | null;
  todayLogs: WearLog[];
  settings: AlignerSettings;
  tasks: MaintenanceTask[];
  onToggleStatus: (status: WearStatus, reason?: OutReason, presetMins?: number) => void;
  onOpenProfile: () => void;
  onOpenAccountSwitcher: () => void;
  onOpenDailyPlan: () => void;
  onOpenTreatment: () => void;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}m`;
}

export const HomeView: React.FC<HomeViewProps> = ({
  firstName,
  avatarUrl,
  theme,
  onThemeChange,
  wearStatus,
  currentOutStartTime,
  currentOutReason,
  todayLogs,
  settings,
  tasks,
  onToggleStatus,
  onOpenProfile,
  onOpenAccountSwitcher,
  onOpenDailyPlan,
  onOpenTreatment,
}) => {
  const [showReasonSheet, setShowReasonSheet] = useState(false);
  const [, forceTick] = useState(0);

  // Keep elapsed-time-derived values (available minutes today, live out
  // duration) fresh without waiting for unrelated prop changes.
  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  const todayStr = getTodayDateString();
  const { availableMins: trackedWindowMinutes } = getAvailableMinutesForDate(todayStr, settings);

  const totalOutMinutesToday = todayLogs.reduce((acc, log) => acc + (log.durationMinutes || 0), 0);
  const activeOutMins =
    wearStatus === 'out' && currentOutStartTime
      ? Math.max(0, Math.floor((Date.now() - new Date(currentOutStartTime).getTime()) / 60000))
      : 0;
  const totalOutMins = totalOutMinutesToday + activeOutMins;
  const wornMinutesToday = Math.max(0, trackedWindowMinutes - totalOutMins);

  const goalSeconds = settings.dailyTargetHours * 3600;
  const wornSeconds = wornMinutesToday * 60;
  const wearHours = Math.floor(wornMinutesToday / 60);
  const wearMins = wornMinutesToday % 60;

  const mostRecentInSince = todayLogs.find((l) => l.endTime)?.endTime;
  const stateSinceLabel = currentOutStartTime
    ? new Date(currentOutStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : mostRecentInSince
    ? new Date(mostRecentInSince).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const currentDurationDays = getTrayDuration(settings, settings.currentTray);
  const trayDayNumber = Math.min(currentDurationDays, getDayNumberSince(settings.trayStartDate));

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 18 ? 'Good afternoon' : 'Good evening';

  const isGoalMet = wornSeconds >= goalSeconds;
  const paceMessage = useMemo(() => {
    if (isGoalMet) return "Today's wear goal reached";
    const remainingMinutes = Math.max(0, Math.ceil((goalSeconds - wornSeconds) / 60));
    const hoursLeftInDay = 24 - new Date().getHours();
    if (remainingMinutes <= hoursLeftInDay * 60) {
      return "You're on pace to reach today's goal";
    }
    return `${formatDuration(remainingMinutes)} more today to reach your goal`;
  }, [isGoalMet, goalSeconds, wornSeconds]);

  // 24 hourly rhythm segments (worn / out / future), mirroring the same
  // out-log inspection the classic tracker view uses.
  const rhythmSegments: RhythmSegmentState[] = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    return Array.from({ length: 24 }).map((_, h) => {
      if (h > currentHour) return 'future';
      let wasOut = false;
      todayLogs.forEach((log) => {
        if (log.type === 'out' && log.startTime) {
          const startH = new Date(log.startTime).getHours();
          const endH = log.endTime ? new Date(log.endTime).getHours() : currentHour;
          if (h >= startH && h <= endH) wasOut = true;
        }
      });
      if (wearStatus === 'out' && currentOutStartTime) {
        const activeStartH = new Date(currentOutStartTime).getHours();
        if (h >= activeStartH && h <= currentHour) wasOut = true;
      }
      return wasOut ? 'out' : 'worn';
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayLogs, wearStatus, currentOutStartTime]);

  const incompleteTask = tasks.find((t) => !t.completed);
  const completedTasksCount = tasks.filter((t) => t.completed).length;

  const daysUntilTrayChange = Math.max(0, currentDurationDays - trayDayNumber);

  let nextUpTitle: string;
  let nextUpSubtitle: string;
  if (wearStatus === 'out') {
    nextUpTitle = 'Put aligners back in';
    nextUpSubtitle = 'Active out-session';
  } else if (incompleteTask) {
    nextUpTitle = incompleteTask.title;
    nextUpSubtitle = 'Daily routine';
  } else if (daysUntilTrayChange <= 1) {
    nextUpTitle = daysUntilTrayChange === 0 ? 'Tray change due today' : 'Tray change due tomorrow';
    nextUpSubtitle = 'Treatment';
  } else {
    nextUpTitle = 'All caught up for today';
    nextUpSubtitle = 'Nothing due right now';
  }

  const completionPercent = Math.round((settings.currentTray / settings.totalTrays) * 100);

  return (
    <div className={`tz-scope tz-${theme} min-h-screen`} style={{ backgroundColor: 'var(--tz-bg-canvas)' }}>
      <div className="max-w-[430px] mx-auto w-full px-5 pt-5 pb-24 space-y-3">
        <TrayceHeader theme={theme} onThemeChange={onThemeChange} avatarUrl={avatarUrl} onOpenProfile={onOpenProfile} />

        <div>
          <button
            type="button"
            onClick={onOpenAccountSwitcher}
            className="text-2xl font-bold text-left"
            style={{ color: 'var(--tz-text-primary)' }}
            title="Tap to switch patient profile"
          >
            {greeting}, {firstName}
          </button>
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <span
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium"
              style={{ backgroundColor: 'var(--tz-surface-card)', border: '1px solid var(--tz-border-subtle)', color: 'var(--tz-text-primary)' }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--tz-brand-teal)' }} />
              Tray {settings.currentTray} &middot; Day {trayDayNumber}
            </span>
            <span
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium"
              style={{
                backgroundColor: 'var(--tz-surface-card)',
                border: '1px solid var(--tz-border-subtle)',
                color: wearStatus === 'in' ? 'var(--tz-brand-teal)' : 'var(--tz-accent-sand)',
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: wearStatus === 'in' ? 'var(--tz-brand-teal)' : 'var(--tz-accent-sand)' }}
              />
              {stateSinceLabel
                ? `${wearStatus === 'in' ? 'In' : 'Out'} since ${stateSinceLabel}`
                : wearStatus === 'in'
                ? 'Aligners in'
                : 'Aligners out'}
            </span>
          </div>
        </div>

        <div
          className="rounded-[24px] p-4 space-y-3"
          style={{ backgroundColor: 'var(--tz-surface-card)', border: '1px solid var(--tz-border-subtle)' }}
        >
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--tz-text-secondary)' }}>
            Today&rsquo;s wear
          </p>

          <div className="flex items-center gap-4">
            <WearProgressRing
              wornSeconds={wornSeconds}
              goalSeconds={goalSeconds}
              hoursLabel={`${wearHours}h`}
              minutesLabel={`${wearMins}m`}
            />

            <button
              type="button"
              onClick={() => (wearStatus === 'in' ? setShowReasonSheet(true) : onToggleStatus('in'))}
              className="flex-1 min-h-[54px] rounded-2xl flex flex-col justify-center gap-1 px-3 py-2 font-bold shadow-lg transition-transform active:scale-[0.97]"
              style={{
                background: 'linear-gradient(90deg, var(--tz-brand-teal) 0%, var(--tz-brand-mint) 100%)',
                color: '#062018',
              }}
            >
              <span className="flex items-center justify-between">
                <span className="w-5 h-5 rounded-full bg-black/10 flex items-center justify-center shrink-0">
                  <Plus className="w-3 h-3" />
                </span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              </span>
              <span className="text-left uppercase text-[12px] leading-tight">
                {wearStatus === 'in' ? 'Take aligners out' : 'Put aligners in'}
              </span>
            </button>
          </div>

          <p className="text-xs" style={{ color: 'var(--tz-text-secondary)' }}>
            {paceMessage}
          </p>
        </div>

        <TodaysRhythm
          segments={rhythmSegments}
          wornLabel={`${wearHours}h ${wearMins.toString().padStart(2, '0')}m worn`}
          outLabel={`${formatDuration(totalOutMins)} out`}
        />

        <NextUpCard
          title={nextUpTitle}
          subtitle={nextUpSubtitle}
          completedRoutines={nextUpSubtitle === 'Daily routine' && tasks.length > 0 ? completedTasksCount : undefined}
          totalRoutines={nextUpSubtitle === 'Daily routine' && tasks.length > 0 ? tasks.length : undefined}
          onOpen={onOpenDailyPlan}
        />

        <TreatmentShortcut
          currentTray={settings.currentTray}
          totalTrays={settings.totalTrays}
          daysRemaining={daysUntilTrayChange}
          completionPercent={completionPercent}
          onOpen={onOpenTreatment}
        />
      </div>

      {showReasonSheet && (
        <OutReasonSheet
          theme={theme}
          onClose={() => setShowReasonSheet(false)}
          onSelect={(reason) => {
            onToggleStatus('out', reason, settings.outTimerAlertMinutes);
            setShowReasonSheet(false);
          }}
        />
      )}
    </div>
  );
};
