import React, { useEffect, useMemo, useState } from 'react';
import { Plus, ChevronRight, Flame } from 'lucide-react';
import { AlignerSettings, MaintenanceTask, OutReason, WearLog, WearStatus, getTrayDuration } from '../../types';
import {
  calculateWearStreak,
  formatLocalDate,
  getAvailableMinutesForDate,
  getDayNumberSince,
  getTodayDateString,
} from '../../utils/storage';
import { computeBand, getAllowedOutMinutes } from '../../utils/compliance';
import { TrayceTheme } from '../../hooks/useTrayceTheme';
import { TrayceHeader } from './TrayceHeader';
import { WearProgressRing } from './WearProgressRing';
import { TodaysRhythm, RhythmSegmentState } from './TodaysRhythm';
import { NextUpCard } from './NextUpCard';
import { TreatmentShortcut } from './TreatmentShortcut';
import { TodaysPlanCard } from './TodaysPlanCard';
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
  /** Full log history - needed for the wear streak and yesterday's total. */
  allLogs: WearLog[];
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

function formatStopwatch(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
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
  allLogs,
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
  const [elapsedOutSeconds, setElapsedOutSeconds] = useState(0);

  // Keep elapsed-time-derived values (available minutes today, live out
  // duration) fresh without waiting for unrelated prop changes.
  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  // Live current-out-session stopwatch, ticking every second while out.
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

  // The out-time budget: a 22h/day wear goal is really "2h out allowed".
  // This replaces the old pace message, whose "on pace" branch stayed true
  // right up until the goal was arithmetically unreachable - reassuring all
  // day, and only warning once nothing could be done about it.
  const allowedOutMinutes = getAllowedOutMinutes(settings.dailyTargetHours);
  const outRemainingMinutes = allowedOutMinutes - totalOutMins;
  const band = computeBand(totalOutMins, allowedOutMinutes);

  const budgetLabel =
    band === 'missed'
      ? `${formatDuration(Math.abs(outRemainingMinutes))} over today's out-time budget`
      : `${formatDuration(outRemainingMinutes)} of out-time left today`;
  const budgetColor =
    band === 'missed'
      ? 'var(--tz-accent-coral)'
      : band === 'atRisk'
      ? 'var(--tz-accent-sand)'
      : 'var(--tz-text-secondary)';

  // Streak and yesterday's result - both already derivable from data the app
  // has, and the two numbers that make the screen feel different day to day.
  const streak = useMemo(() => calculateWearStreak(allLogs, settings), [allLogs, settings]);

  const yesterdayWornLabel = useMemo(() => {
    const yesterdayStr = formatLocalDate(new Date(Date.now() - 86400000));
    const { availableMins, isBeforeStart } = getAvailableMinutesForDate(yesterdayStr, settings);
    if (isBeforeStart || availableMins <= 0) return null;
    const outMins = allLogs
      .filter((l) => l.date === yesterdayStr)
      .reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
    return formatDuration(Math.max(0, availableMins - outMins));
  }, [allLogs, settings]);

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

  // Shared between the mobile and desktop trees below (both are always in
  // the DOM, toggled with responsive classes, so this is called once per
  // tree rather than reusing a single JSX reference across both).
  const renderHeroCard = () => (
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

      {wearStatus === 'out' && (
        <div
          className="flex items-center justify-between rounded-xl px-3 py-2"
          style={{ backgroundColor: 'var(--tz-bg-canvas)', border: '1px solid var(--tz-border-subtle)' }}
        >
          <span className="text-xs font-medium" style={{ color: 'var(--tz-text-secondary)' }}>
            Out for
          </span>
          <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--tz-accent-sand)' }} aria-live="polite">
            {formatStopwatch(elapsedOutSeconds)}
          </span>
        </div>
      )}

      {/* Shown in both states - the budget is most decision-relevant while
          out, since that's when it's actively draining. */}
      <p
        className={`text-xs ${band === 'onTrack' ? '' : 'font-semibold'}`}
        style={{ color: budgetColor }}
        aria-live="polite"
      >
        {budgetLabel}
      </p>
    </div>
  );

  // Quiet by default: a brand-new user with no streak and no yesterday gets
  // nothing here rather than a row of zeroes.
  const renderInsightStrip = () => {
    if (streak <= 0 && !yesterdayWornLabel) return null;
    return (
      <div
        className="rounded-[18px] px-4 py-2.5 flex items-center gap-2.5 text-xs"
        style={{ backgroundColor: 'var(--tz-surface-card)', border: '1px solid var(--tz-border-subtle)' }}
      >
        {streak > 0 && (
          <span className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--tz-brand-teal)' }}>
            <Flame className="w-3.5 h-3.5 shrink-0" />
            {streak}-day streak
          </span>
        )}
        {streak > 0 && yesterdayWornLabel && (
          <span aria-hidden="true" style={{ color: 'var(--tz-text-secondary)' }}>
            &middot;
          </span>
        )}
        {yesterdayWornLabel && (
          <span style={{ color: 'var(--tz-text-secondary)' }}>
            Yesterday{' '}
            <span className="font-semibold tabular-nums" style={{ color: 'var(--tz-text-primary)' }}>
              {yesterdayWornLabel}
            </span>
          </span>
        )}
      </div>
    );
  };

  const renderGreetingChips = () => (
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
  );

  return (
    <>
      {/* Mobile (<1024px): single column, own embedded header, floating bottom nav lives in App.tsx */}
      <div className={`tz-scope tz-${theme} min-h-screen lg:hidden`} style={{ backgroundColor: 'var(--tz-bg-canvas)' }}>
        <div className="max-w-[430px] mx-auto w-full px-5 pt-5 pb-24 space-y-3">
          <TrayceHeader theme={theme} onThemeChange={onThemeChange} avatarUrl={avatarUrl} onOpenProfile={onOpenProfile} />
          {renderGreetingChips()}
          {renderHeroCard()}
          {renderInsightStrip()}

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
      </div>

      {/* Desktop (>=1024px): two-column grid, no embedded header - the
          persistent sidebar + top bar in App.tsx own that at this size. */}
      <div className={`tz-scope tz-${theme} hidden lg:block`}>
        {renderGreetingChips()}

        <div className="grid gap-6 mt-6" style={{ gridTemplateColumns: '65% 1fr' }}>
          <div className="space-y-6 min-w-0">
            {renderHeroCard()}
            {renderInsightStrip()}
            <TodaysRhythm
              segments={rhythmSegments}
              wornLabel={`${wearHours}h ${wearMins.toString().padStart(2, '0')}m worn`}
              outLabel={`${formatDuration(totalOutMins)} out`}
            />
          </div>

          <div className="space-y-6 min-w-0">
            <NextUpCard
              title={nextUpTitle}
              subtitle={nextUpSubtitle}
              completedRoutines={nextUpSubtitle === 'Daily routine' && tasks.length > 0 ? completedTasksCount : undefined}
              totalRoutines={nextUpSubtitle === 'Daily routine' && tasks.length > 0 ? tasks.length : undefined}
              onOpen={onOpenDailyPlan}
            />
            <TodaysPlanCard tasks={tasks} onOpen={onOpenDailyPlan} />
            <TreatmentShortcut
              currentTray={settings.currentTray}
              totalTrays={settings.totalTrays}
              daysRemaining={daysUntilTrayChange}
              completionPercent={completionPercent}
              onOpen={onOpenTreatment}
            />
          </div>
        </div>
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
    </>
  );
};
