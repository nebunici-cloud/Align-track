import React, { useState, useEffect } from 'react';
import { Play, Pause, Coffee, Utensils, Sparkles, AlertCircle, Plus, CheckCircle2, Clock, ShieldCheck, Flame } from 'lucide-react';
import { WearStatus, OutReason, WearLog, AlignerSettings } from '../types';
import { playAlertChime, triggerPushNotification } from '../utils/soundAndNotifications';
import { calculateWearStreak, getAvailableMinutesForDate, getTodayDateString } from '../utils/storage';

interface WearTimerCardProps {
  wearStatus: WearStatus;
  currentOutStartTime: string | null;
  currentOutReason: OutReason | null;
  presetTimerMinutes: number | null;
  todayLogs: WearLog[];
  allLogs?: WearLog[];
  settings: AlignerSettings;
  onToggleStatus: (newStatus: WearStatus, reason?: OutReason, presetMinutes?: number) => void;
  onAddManualLog: () => void;
}

const REASON_OPTIONS: { id: OutReason; label: string; icon: React.ReactNode }[] = [
  { id: 'breakfast', label: 'Breakfast', icon: <Utensils className="w-3.5 h-3.5 text-amber-400" /> },
  { id: 'lunch', label: 'Lunch', icon: <Utensils className="w-3.5 h-3.5 text-emerald-400" /> },
  { id: 'dinner', label: 'Dinner', icon: <Utensils className="w-3.5 h-3.5 text-indigo-400" /> },
  { id: 'snack', label: 'Snack', icon: <Utensils className="w-3.5 h-3.5 text-orange-400" /> },
  { id: 'coffee_drink', label: 'Coffee / Tea', icon: <Coffee className="w-3.5 h-3.5 text-yellow-500" /> },
  { id: 'brushing_cleaning', label: 'Clean Teeth', icon: <Sparkles className="w-3.5 h-3.5 text-teal-400" /> },
  { id: 'other', label: 'Other', icon: <Clock className="w-3.5 h-3.5 text-slate-400" /> },
];

export const WearTimerCard: React.FC<WearTimerCardProps> = ({
  wearStatus,
  currentOutStartTime,
  currentOutReason,
  presetTimerMinutes,
  todayLogs,
  allLogs,
  settings,
  onToggleStatus,
  onAddManualLog,
}) => {
  const [elapsedOutSeconds, setElapsedOutSeconds] = useState<number>(0);
  const [selectedReason, setSelectedReason] = useState<OutReason>('lunch');
  const [customPreset, setCustomPreset] = useState<number | null>(30);
  const [showOutReasonModal, setShowOutReasonModal] = useState<boolean>(false);

  // Calculate today's total out time in minutes from completed logs + current active log
  const completedOutMinutes = todayLogs
    .filter((log) => log.type === 'out' && log.durationMinutes)
    .reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0);

  const activeOutMinutes = wearStatus === 'out' ? Math.floor(elapsedOutSeconds / 60) : 0;
  const totalOutMinutesToday = completedOutMinutes + activeOutMinutes;

  // Calculate elapsed time today so far taking plan start time into account
  const todayStr = getTodayDateString();
  const { availableMins: availableMinsToday, isPlanStartDay } = getAvailableMinutesForDate(todayStr, settings);

  // Target wear hours e.g. 22 => 1320 mins. Pro-rated on plan start day if starting mid-day.
  const targetWearMinutes = isPlanStartDay
    ? (settings.dailyTargetHours / 24) * availableMinsToday
    : settings.dailyTargetHours * 60;

  const currentWearMinutes = Math.max(0, availableMinsToday - totalOutMinutesToday);

  const percentageWear = targetWearMinutes > 0 ? Math.min(100, Math.round((currentWearMinutes / targetWearMinutes) * 100)) : 100;
  const isGoalMet = currentWearMinutes >= targetWearMinutes;
  const streak = calculateWearStreak(allLogs || todayLogs, settings);

  // Active out timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (wearStatus === 'out' && currentOutStartTime) {
      const updateTimer = () => {
        const start = new Date(currentOutStartTime).getTime();
        const now = Date.now();
        const diffSecs = Math.max(0, Math.floor((now - start) / 1000));
        setElapsedOutSeconds(diffSecs);

        // Check if preset alert limit reached
        const outLimitSecs = (settings.outTimerAlertMinutes || 30) * 60;
        if (diffSecs === outLimitSecs) {
          playAlertChime('alarm');
          triggerPushNotification('Aligner Warning: Out-Time Limit Reached!', {
            body: `Your aligners have been out for ${settings.outTimerAlertMinutes} minutes. Put them back in to stay on target!`,
          });
        }
      };

      updateTimer();
      interval = setInterval(updateTimer, 1000);
    } else {
      setElapsedOutSeconds(0);
    }

    return () => clearInterval(interval);
  }, [wearStatus, currentOutStartTime, settings.outTimerAlertMinutes]);

  const handleStartOut = () => {
    onToggleStatus('out', selectedReason, customPreset || undefined);
    setShowOutReasonModal(false);
    playAlertChime('tray_out');
  };

  const handlePutIn = () => {
    onToggleStatus('in');
    playAlertChime('tray_in');
  };

  const formatHoursMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  const formatSeconds = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
      {/* Ambient background glow depending on status */}
      <div
        className={`absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          wearStatus === 'in' ? 'bg-teal-500/10' : 'bg-amber-500/15'
        }`}
      />

      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 relative z-10">
        {/* Left Side: Today's Wear Ring & Realtime Stats */}
        <div className="flex items-center gap-5 sm:gap-6 w-full lg:w-auto">
          {/* Circular Progress Ring */}
          <div className="relative w-32 h-32 sm:w-36 sm:h-36 flex-shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
              {/* Background Track */}
              <circle
                cx="60"
                cy="60"
                r="48"
                className="stroke-slate-800/80"
                strokeWidth="10"
                fill="transparent"
              />
              {/* Wear Time Progress Bar */}
              <circle
                cx="60"
                cy="60"
                r="48"
                className={`transition-all duration-500 ${
                  isGoalMet
                    ? 'stroke-emerald-400'
                    : percentageWear >= 80
                    ? 'stroke-teal-400'
                    : 'stroke-amber-400'
                }`}
                strokeWidth="10"
                strokeDasharray="301.59"
                strokeDashoffset={301.59 * (1 - Math.min(1, currentWearMinutes / targetWearMinutes))}
                strokeLinecap={percentageWear > 0 && percentageWear < 100 ? 'round' : 'butt'}
                fill="transparent"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100">
                {formatHoursMinutes(currentWearMinutes)}
              </span>
              <span className="text-[11px] font-medium text-slate-400">
                of {settings.dailyTargetHours}h Goal
              </span>
              <span className="text-[10px] font-semibold text-teal-400 mt-0.5">
                {percentageWear}%
              </span>
            </div>
          </div>

          {/* Detailed Stat Pillars */}
          <div className="space-y-2.5 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Today's Summary
              </span>
              {isGoalMet && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Goal Met
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-2.5">
                <div className="text-slate-400 text-[11px]">Total Out Time</div>
                <div className="font-bold text-slate-200 text-sm mt-0.5">
                  {formatHoursMinutes(totalOutMinutesToday)}
                </div>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-2.5">
                <div className="text-slate-400 text-[11px]">Allowed Out Left</div>
                <div className="font-bold text-teal-300 text-sm mt-0.5">
                  {formatHoursMinutes(Math.max(0, (24 - settings.dailyTargetHours) * 60 - totalOutMinutesToday))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Flame className="w-4 h-4 text-orange-400 shrink-0" />
              <span>{streak}-Day Wear Target Streak</span>
            </div>
          </div>
        </div>

        {/* Right Side: Giant Intuitive Status Toggle Controller */}
        <div className="w-full lg:w-[320px] flex flex-col items-center gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-800">
          {wearStatus === 'out' ? (
            <div className="w-full flex flex-col items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-center shadow-lg shadow-amber-500/5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/30">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>
                  ALIGNERS OUT • {REASON_OPTIONS.find((r) => r.id === currentOutReason)?.label || 'Meal'}
                </span>
              </div>

              {/* Giant Live Count Up Timer Display */}
              <div className="font-mono text-4xl sm:text-5xl font-black tracking-widest text-amber-300 my-0.5 drop-shadow-[0_0_16px_rgba(251,191,36,0.4)]">
                {formatSeconds(elapsedOutSeconds)}
              </div>

              {/* Giant Intuitive "PUT ALIGNERS BACK IN" Button */}
              <button
                onClick={handlePutIn}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-extrabold text-base shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] active:scale-95 ring-2 ring-emerald-400/40"
              >
                <CheckCircle2 className="w-6 h-6 stroke-[2.8]" />
                <div className="flex flex-col items-start text-left">
                  <span className="leading-tight text-sm sm:text-base">PUT ALIGNERS BACK IN</span>
                  <span className="text-[10px] font-medium opacity-85">Tap when aligners are back on teeth</span>
                </div>
              </button>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center gap-3 bg-slate-800/50 border border-slate-700/80 rounded-2xl p-4 text-center">
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold bg-emerald-500/15 px-3 py-1 rounded-full border border-emerald-500/25">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>ALIGNERS CURRENTLY IN</span>
              </div>

              {/* Giant Intuitive "TAKE ALIGNERS OUT" Main Hero Button */}
              <button
                onClick={() => setShowOutReasonModal(true)}
                className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-slate-800 to-amber-500/10 hover:bg-slate-700/80 border-2 border-amber-500/50 hover:border-amber-400 text-amber-300 font-extrabold text-sm shadow-lg shadow-amber-500/10 flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] active:scale-95"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Utensils className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex flex-col items-start text-left">
                  <span className="text-amber-200 text-sm sm:text-base leading-tight">TAKE ALIGNERS OUT</span>
                  <span className="text-[10px] text-slate-400 font-normal">Tap to start out-timer for meal/drink</span>
                </div>
              </button>

              {/* 1-Tap Quick Reason Selector Pills */}
              <div className="w-full pt-1">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5 text-center">
                  1-Tap Quick Out Reasons
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {REASON_OPTIONS.slice(0, 6).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onToggleStatus('out', opt.id, customPreset || undefined);
                        playAlertChime('tray_out');
                      }}
                      className="p-1.5 rounded-xl bg-slate-900/80 border border-slate-700/60 hover:border-amber-500/40 hover:bg-amber-500/10 text-slate-300 hover:text-amber-300 text-[11px] font-medium flex items-center justify-center gap-1 transition-all"
                    >
                      {opt.icon}
                      <span className="truncate">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={onAddManualLog}
            className="text-xs text-slate-400 hover:text-teal-300 flex items-center gap-1 transition-colors pt-0.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add or Edit Past Wear Log</span>
          </button>
        </div>
      </div>

      {/* Out Reason & Preset Selection Modal */}
      {showOutReasonModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Utensils className="w-4 h-4 text-amber-400" />
                Why are you taking aligners out?
              </h3>
              <button
                onClick={() => setShowOutReasonModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Reason Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {REASON_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSelectedReason(opt.id)}
                  className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium transition-all ${
                    selectedReason === opt.id
                      ? 'bg-amber-500/20 border-amber-500 text-amber-200 font-semibold'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>

            {/* Preset Reminder Selector */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Set Out-Timer Reminder Limit</span>
                <span className="text-slate-400 font-normal">Alert when exceeded</span>
              </label>
              <div className="grid grid-cols-4 gap-2 text-xs">
                {[15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => setCustomPreset(mins)}
                    className={`py-2 rounded-lg border font-medium transition-all ${
                      customPreset === mins
                        ? 'bg-teal-500/20 border-teal-500 text-teal-300 font-bold'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowOutReasonModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartOut}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition-all"
              >
                Start Out Timer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
