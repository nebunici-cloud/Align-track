import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Utensils,
  Coffee,
  Apple,
  Sparkles,
  AlertCircle,
  Clock,
  Activity,
  RotateCcw,
  Check,
  History,
  Play,
  Calendar,
  ListTodo,
  CheckSquare,
  Square,
  Bell,
  Layers,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { WearStatus, OutReason, WearLog, AlignerSettings, MaintenanceTask, getTrayDuration } from '../types';
import { getAvailableMinutesForDate, getTodayDateString, getDayNumberSince } from '../utils/storage';

interface QuickTrackViewProps {
  wearStatus: WearStatus;
  currentOutStartTime: string | null;
  currentOutReason: OutReason | null;
  todayLogs: WearLog[];
  settings: AlignerSettings;
  tasks?: MaintenanceTask[];
  onToggleStatus: (status: WearStatus, reason?: OutReason, presetMins?: number) => void;
  onToggleTask?: (taskId: string) => void;
  onOpenChewiesTimer?: () => void;
  onOpenAddManualLog?: () => void;
  onUpdateSettings?: (settings: AlignerSettings) => void;
}

const QUICK_REASONS: {
  id: OutReason;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: 'lunch', label: 'Lunch', icon: <Utensils className="w-5 h-5" /> },
  { id: 'dinner', label: 'Dinner', icon: <Utensils className="w-5 h-5" /> },
  { id: 'breakfast', label: 'Breakfast', icon: <Apple className="w-5 h-5" /> },
  { id: 'snack', label: 'Snack', icon: <Apple className="w-5 h-5" /> },
  { id: 'coffee_drink', label: 'Drinks', icon: <Coffee className="w-5 h-5" /> },
  { id: 'brushing_cleaning', label: 'Hygiene', icon: <Sparkles className="w-5 h-5" /> },
  { id: 'sports', label: 'Sports', icon: <Activity className="w-5 h-5" /> },
  { id: 'other', label: 'Other', icon: <Clock className="w-5 h-5" /> },
];

export const QuickTrackView: React.FC<QuickTrackViewProps> = ({
  wearStatus,
  currentOutStartTime,
  currentOutReason,
  todayLogs,
  settings,
  tasks = [],
  onToggleStatus,
  onToggleTask,
  onOpenChewiesTimer,
  onOpenAddManualLog,
  onUpdateSettings,
}) => {
  const [elapsedOutSeconds, setElapsedOutSeconds] = useState<number>(0);
  const [selectedReason, setSelectedReason] = useState<OutReason>('lunch');

  // Sync current reason if aligners are out
  useEffect(() => {
    if (currentOutReason) {
      setSelectedReason(currentOutReason);
    }
  }, [currentOutReason]);

  // Calculate live elapsed seconds when out
  useEffect(() => {
    if (wearStatus === 'out' && currentOutStartTime) {
      const calculateElapsed = () => {
        const start = new Date(currentOutStartTime).getTime();
        const now = Date.now();
        setElapsedOutSeconds(Math.max(0, Math.floor((now - start) / 1000)));
      };
      calculateElapsed();
      const interval = setInterval(calculateElapsed, 1000);
      return () => clearInterval(interval);
    } else {
      setElapsedOutSeconds(0);
      // Periodic ticker every 10s to update current time elapsed today when aligners are in
      const interval = setInterval(() => {
        setElapsedOutSeconds((s) => s);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [wearStatus, currentOutStartTime]);

  // Program / Plan Start Date & Time calculations
  const todayStr = getTodayDateString();
  const { availableMins: trackedWindowMinutes, isPlanStartDay } = getAvailableMinutesForDate(todayStr, settings);

  let planStartHour = 0;
  if (isPlanStartDay && settings.planStartTime) {
    const parts = settings.planStartTime.split(':');
    planStartHour = parseInt(parts[0], 10) || 0;
  }

  const now = new Date();
  const currentHour = now.getHours();

  // Total out time calculation
  const totalOutMinutesToday = todayLogs.reduce((acc, log) => acc + (log.durationMinutes || 0), 0);
  const activeOutMins = wearStatus === 'out' ? Math.floor(elapsedOutSeconds / 60) : 0;
  const totalOutMins = totalOutMinutesToday + activeOutMins;

  // Real wear minutes today (counts only hours/minutes that have passed so far today)
  const currentWearMinutes = Math.max(0, trackedWindowMinutes - totalOutMins);

  const wearHoursNum = Math.floor(currentWearMinutes / 60);
  const wearMinsNum = currentWearMinutes % 60;

  const targetMinutes = settings.dailyTargetHours * 60;
  const isGoalMet = currentWearMinutes >= targetMinutes;

  const totalOutHoursNum = Math.floor(totalOutMins / 60);
  const totalOutMinsNum = totalOutMins % 60;
  const maxAllowedOutMins = 1440 - targetMinutes;
  const maxAllowedOutHours = Math.floor(maxAllowedOutMins / 60);

  const allowedOutLeftMins = Math.max(0, maxAllowedOutMins - totalOutMins);

  // 24 Hour Blocks Calculation (0h to 23h)
  const hourBlocks = Array.from({ length: 24 }).map((_, h) => {
    // Check if before plan start time on day 1
    if (isPlanStartDay && h < planStartHour) {
      return { hour: h, status: 'pre-start', label: `Hour ${h}: Pre-start (${settings.planStartTime || '17:00'})` };
    }

    // Check if future hour today
    if (h > currentHour) {
      return { hour: h, status: 'future', label: `Hour ${h}: Upcoming` };
    }

    // Check if aligners were OUT during hour h
    let wasOut = false;

    // 1. Inspect completed out logs
    todayLogs.forEach((log) => {
      if (log.type === 'out' && log.startTime) {
        const startH = new Date(log.startTime).getHours();
        const endH = log.endTime ? new Date(log.endTime).getHours() : currentHour;
        if (h >= startH && h <= endH) {
          wasOut = true;
        }
      }
    });

    // 2. Inspect active out timer
    if (wearStatus === 'out' && currentOutStartTime) {
      const activeStartH = new Date(currentOutStartTime).getHours();
      if (h >= activeStartH && h <= currentHour) {
        wasOut = true;
      }
    }

    if (wasOut) {
      return { hour: h, status: 'out', label: `Hour ${h}: Aligners OUT (Yellow/Gold)` };
    }

    return { hour: h, status: 'worn', label: `Hour ${h}: Aligners WORN (Teal)` };
  });

  // Next Tray Change calculation
  const currentDurationDays = getTrayDuration(settings, settings.currentTray);
  const trayStartDateObj = new Date(settings.trayStartDate);
  const diffDays = getDayNumberSince(settings.trayStartDate);
  const daysInCurrentTray = Math.min(currentDurationDays, diffDays);
  const daysUntilTrayChange = Math.max(0, currentDurationDays - daysInCurrentTray);

  const targetTrayChangeDate = new Date(trayStartDateObj.getTime() + currentDurationDays * 86400000);
  const formattedChangeDate = targetTrayChangeDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const preferredTime = settings.preferredTrayChangeTime || '21:00';

  // Format stopwatch
  const formatTimer = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const currentReasonObj = QUICK_REASONS.find((r) => r.id === (currentOutReason || selectedReason)) || QUICK_REASONS[0];

  const handleStartTimer = () => {
    onToggleStatus('out', selectedReason, settings.outTimerAlertMinutes);
  };

  // Formatted start time string: when out, the time this out-session started;
  // when in, the time aligners were last put back in (the most recent
  // completed session's end time today, if any).
  const mostRecentInSince = todayLogs.find((l) => l.endTime)?.endTime;
  const formattedStartTime = currentOutStartTime
    ? new Date(currentOutStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : mostRecentInSince
    ? new Date(mostRecentInSince).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  // Rubber Bands handlers
  const rubberTarget = settings.rubberBandsTargetPerDay || 3;
  const rubberCount = settings.rubberBandsChangedToday || 0;

  const handleIncrementRubberBands = () => {
    if (onUpdateSettings) {
      onUpdateSettings({
        ...settings,
        rubberBandsChangedToday: Math.min(rubberTarget + 2, rubberCount + 1),
      });
    }
  };

  const handleResetRubberBands = () => {
    if (onUpdateSettings) {
      onUpdateSettings({
        ...settings,
        rubberBandsChangedToday: 0,
      });
    }
  };

  // Daily routines completion count
  const completedTasksCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="max-w-md mx-auto w-full flex flex-col space-y-4 py-1 animate-in fade-in duration-200">
      {/* 1. TOP "TODAY'S WEAR" STATS CARD */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-5 shadow-xl space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold text-slate-400 tracking-widest uppercase block">
            TODAY'S WEAR
          </span>

          {/* ALIGNERS STATUS BADGE */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700/80 text-[11px] font-semibold text-slate-200 shadow-sm">
            <span
              className={`w-2 h-2 rounded-full ${
                wearStatus === 'in' ? 'bg-teal-400 shadow-[0_0_8px_#2dd4bf]' : 'bg-amber-400 animate-pulse shadow-[0_0_8px_#fbbf24]'
              }`}
            />
            <span>
              {wearStatus === 'in'
                ? formattedStartTime
                  ? `Aligners in · since ${formattedStartTime}`
                  : 'Aligners in'
                : `Aligners out · since ${formattedStartTime}`}
            </span>
          </div>
        </div>

        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-black text-teal-300 font-mono tracking-tight">
              {wearHoursNum}h {wearMinsNum}m
            </span>
          </div>
          {isPlanStartDay && (
            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
              Start: Today at {settings.planStartTime || '17:00'}
            </span>
          )}
        </div>

        {/* 24 HOUR TIMELINE SQUARES (0h to 23h) */}
        <div className="space-y-1.5 pt-1">
          <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-0.5 sm:gap-1 h-3.5 w-full">
            {hourBlocks.map((block) => {
              let styleClass = 'bg-slate-800/80';
              if (block.status === 'pre-start') {
                styleClass = 'bg-slate-800/30 border border-slate-700/30 opacity-40';
              } else if (block.status === 'out') {
                styleClass = 'bg-amber-400 shadow-[0_0_8px_#fbbf24] ring-1 ring-amber-300/40';
              } else if (block.status === 'worn') {
                styleClass = 'bg-teal-400 shadow-[0_0_6px_#2dd4bf]';
              }

              return (
                <div
                  key={block.hour}
                  title={block.label}
                  className={`h-full rounded-sm transition-all duration-300 cursor-pointer hover:scale-110 ${styleClass}`}
                />
              );
            })}
          </div>

          {/* Time Labels */}
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>00:00</span>
            <span>12:00</span>
            <span>23:59</span>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400 font-medium pt-0.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-teal-400 inline-block shadow-[0_0_4px_#2dd4bf]" />
              <span>Worn</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block shadow-[0_0_4px_#fbbf24]" />
              <span>Out Time</span>
            </div>
            {isPlanStartDay && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-800/40 border border-slate-700/50 inline-block" />
                <span>Pre-start</span>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-800/80 pt-3 grid grid-cols-3 text-center gap-1">
          {/* Goal Achieved */}
          <div className="flex flex-col items-center justify-center">
            <span className={`text-xs font-bold ${isGoalMet ? 'text-teal-400' : 'text-slate-300'}`}>
              {isGoalMet ? 'Goal achieved!' : `${settings.dailyTargetHours}h goal`}
            </span>
          </div>

          {/* Out Time Spent */}
          <div className="flex flex-col items-center justify-center border-x border-slate-800/80 px-1">
            <span className="text-[10px] text-slate-400">Out time</span>
            <span className="text-xs font-bold text-slate-200">
              {totalOutHoursNum > 0 ? `${totalOutHoursNum}h ` : ''}{totalOutMinsNum}m / {maxAllowedOutHours}h
            </span>
          </div>

          {/* Out Time Left */}
          <div className="flex flex-col items-center justify-center">
            <span className={`text-xs font-bold ${allowedOutLeftMins > 0 ? 'text-amber-400' : 'text-rose-400'}`}>
              {allowedOutLeftMins > 0 ? `${allowedOutLeftMins}m left` : '0m left'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. IF ALIGNERS OUT: ACTIVE STOPWATCH CARD */}
      {wearStatus === 'out' && (
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-5 shadow-2xl text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-wider">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Out for {currentReasonObj.label}</span>
          </div>

          <div className="space-y-1">
            <div className="font-mono text-5xl font-black text-amber-300 tracking-wider my-2 drop-shadow-[0_0_20px_rgba(251,191,36,0.3)]">
              {formatTimer(elapsedOutSeconds)}
            </div>
            <p className="text-xs text-slate-400">
              Tap button below when aligners are back on your teeth.
            </p>
          </div>

          {/* Giant STOP TIMER CTA Button */}
          <button
            type="button"
            onClick={() => onToggleStatus('in')}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black text-base shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2.5 transition-all transform active:scale-95"
          >
            <CheckCircle2 className="w-6 h-6 stroke-[2.8]" />
            <span className="uppercase tracking-wide">PUT ALIGNERS BACK IN</span>
          </button>
        </div>
      )}

      {/* 3. START TIMER BUTTON */}
      {wearStatus === 'in' && (
        <button
          type="button"
          onClick={handleStartTimer}
          className="w-full py-4 px-6 rounded-2xl bg-amber-400 hover:bg-amber-300 border-2 border-amber-300 text-slate-950 font-black text-base sm:text-lg shadow-xl shadow-amber-500/20 flex items-center justify-center gap-3 transition-all transform active:scale-95 my-1"
        >
          <div className="w-7 h-7 rounded-full bg-slate-950/20 flex items-center justify-center">
            <Play className="w-4 h-4 fill-slate-950 text-slate-950 ml-0.5" />
          </div>
          <span className="uppercase tracking-wide">
            START {currentReasonObj.label.toUpperCase()} TIMER
          </span>
        </button>
      )}

      {/* 4. WHY ARE YOU TAKING THEM OUT? */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-5 shadow-xl space-y-3.5">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-100">
            Why are you taking them out?
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Select one reason
          </p>
        </div>

        {/* 2x4 Grid of Reasons */}
        <div className="grid grid-cols-4 gap-2">
          {QUICK_REASONS.map((r) => {
            const isSelected = selectedReason === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSelectedReason(r.id);
                  if (wearStatus === 'out') {
                    onToggleStatus('out', r.id, settings.outTimerAlertMinutes);
                  }
                }}
                className={`relative p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 text-center min-h-[70px] ${
                  isSelected
                    ? 'bg-amber-500/10 border-2 border-amber-400 text-amber-300 shadow-lg ring-1 ring-amber-400/30'
                    : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
                <div className={isSelected ? 'text-amber-400' : 'text-slate-400'}>
                  {r.icon}
                </div>
                <span className="text-xs font-semibold leading-tight">{r.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. RUBBER BANDS / ELASTICS TRACKER CARD */}
      {settings.useRubberBands !== false && (
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                Rubber Bands / Elastics
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                rubberCount >= rubberTarget
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}>
                {rubberCount} / {rubberTarget} changed
              </span>
              {rubberCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetRubberBands}
                  className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                  title="Reset today's count"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-slate-200">
                {rubberCount >= rubberTarget ? '🎉 Rubber bands goal complete!' : 'Change fresh rubber bands'}
              </p>
              <p className="text-[10px] text-slate-400">
                Recommended: Change 2–3x daily with meals or morning/night
              </p>
            </div>

            <button
              type="button"
              onClick={handleIncrementRubberBands}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-md transition-all active:scale-95 shrink-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Log Change</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. NEXT TASK & DAILY ROUTINES SECTION */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-teal-400" />
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
              Next Task & Daily Routines
            </h2>
          </div>
          {tasks.length > 0 && (
            <span className="text-[11px] font-semibold text-teal-300 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-full">
              {completedTasksCount}/{tasks.length} Done
            </span>
          )}
        </div>

        {/* Highlighted Next Task: Next Tray Change Schedule Card */}
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-800/40 border border-slate-700/70 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-amber-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Next Tray Switch (# Tray {settings.currentTray + 1})</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-400/15 text-amber-300 border border-amber-400/30">
              {daysUntilTrayChange === 0 ? 'Today!' : `${daysUntilTrayChange} days left`}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-teal-400" />
              <span>{formattedChangeDate} at {preferredTime}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Bell className="w-3 h-3 text-cyan-400" />
              <span>Reminder set</span>
            </div>
          </div>
        </div>

        {/* Daily Maintenance Tasks Checklist */}
        {tasks.length > 0 && (
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Today's Care Routines
            </span>
            <div className="space-y-1.5">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onToggleTask && onToggleTask(task.id)}
                  className={`p-3 rounded-2xl border flex items-center justify-between text-xs cursor-pointer transition-all active:scale-98 ${
                    task.completed
                      ? 'bg-slate-800/40 border-slate-800 text-slate-500 line-through'
                      : 'bg-slate-800/80 border-slate-700/80 text-slate-200 hover:border-teal-500/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {task.completed ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className="font-medium">{task.title}</span>
                  </div>

                  {task.category === 'chewies' && onOpenChewiesTimer && !task.completed && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenChewiesTimer();
                      }}
                      className="px-2 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 font-semibold text-[10px] transition-colors"
                    >
                      Start Chewies
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 7. BOTTOM ACTION BUTTONS */}
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        {onOpenChewiesTimer && (
          <button
            type="button"
            onClick={onOpenChewiesTimer}
            className="py-3 px-4 rounded-2xl bg-slate-900/90 border border-slate-800/90 hover:border-teal-500/40 text-slate-200 hover:text-teal-300 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md"
          >
            <RotateCcw className="w-4 h-4 text-teal-400" />
            <span>Chewies</span>
          </button>
        )}

        {onOpenAddManualLog && (
          <button
            type="button"
            onClick={onOpenAddManualLog}
            className="py-3 px-4 rounded-2xl bg-slate-900/90 border border-slate-800/90 hover:border-amber-500/40 text-slate-200 hover:text-amber-300 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md"
          >
            <History className="w-4 h-4 text-amber-400" />
            <span>History</span>
          </button>
        )}
      </div>
    </div>
  );
};
