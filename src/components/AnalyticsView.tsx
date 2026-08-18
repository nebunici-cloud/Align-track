import React, { useState } from 'react';
import { BarChart3, TrendingUp, Award, Download, Copy, Check, Calendar, FileText, PieChart } from 'lucide-react';
import { WearLog, AlignerSettings } from '../types';
import { calculateWearStreak, getTodayDateString, getAvailableMinutesForDate, formatLocalDate } from '../utils/storage';

interface AnalyticsViewProps {
  logs: WearLog[];
  settings: AlignerSettings;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ logs, settings }) => {
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  const todayStr = getTodayDateString();

  // Calculate past 7 days wear hours
  const past7DaysData: { date: string; dayName: string; wearHours: number; goalMet: boolean; isBeforeStart: boolean }[] = [];
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dateStr = formatLocalDate(d);
    const dayName = daysOfWeek[d.getDay()];

    const { availableMins, isBeforeStart, isPlanStartDay } = getAvailableMinutesForDate(dateStr, settings);

    if (isBeforeStart) {
      past7DaysData.push({
        date: dateStr,
        dayName,
        wearHours: 0,
        goalMet: false,
        isBeforeStart: true,
      });
      continue;
    }

    const dayLogs = logs.filter((l) => l.date === dateStr);
    const outMins = dayLogs.reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
    const wearMins = Math.max(0, availableMins - outMins);
    const wearHours = parseFloat((wearMins / 60).toFixed(1));

    const targetMins = isPlanStartDay
      ? (settings.dailyTargetHours / 24) * availableMins
      : settings.dailyTargetHours * 60;

    past7DaysData.push({
      date: dateStr,
      dayName,
      wearHours,
      goalMet: wearMins >= targetMins && availableMins > 0,
      isBeforeStart: false,
    });
  }

  // Active days starting from treatment start date
  const activeDays = past7DaysData.filter((d) => !d.isBeforeStart);

  // Calculate average wear hours past 7 days (only active treatment days)
  const avgWearHours = activeDays.length > 0
    ? (activeDays.reduce((acc, d) => acc + d.wearHours, 0) / activeDays.length).toFixed(1)
    : '0.0';

  const complianceRate = activeDays.length > 0
    ? Math.round((activeDays.filter((d) => d.goalMet).length / activeDays.length) * 100)
    : 0;

  const currentStreak = calculateWearStreak(logs, settings);

  // Reasons breakdown
  const reasonCounts: Record<string, number> = {};
  logs.forEach((l) => {
    if (l.reason) {
      reasonCounts[l.reason] = (reasonCounts[l.reason] || 0) + (l.durationMinutes || 0);
    }
  });

  const totalReasonMins = Object.values(reasonCounts).reduce((a, b) => a + b, 0) || 1;

  // Generate Orthodontist Report Text
  const generateReportText = () => {
    return `=== ALIGNER COMPLIANCE & WEAR REPORT ===
Patient Name: AlignTrack User
Current Tray: Tray #${settings.currentTray} of ${settings.totalTrays}
Daily Wear Goal: ${settings.dailyTargetHours} Hours/Day
Orthodontist: ${settings.orthodontistName} (${settings.clinicName})
Report Generated: ${new Date().toLocaleDateString()}

--- 7-DAY COMPLIANCE STATS ---
7-Day Average Wear Time: ${avgWearHours} Hours/Day
Goal Compliance Rate: ${complianceRate}%
Streak: ${currentStreak} Day${currentStreak === 1 ? '' : 's'} Meeting Goal

Daily Breakdown (Past 7 Days):
${past7DaysData.map((d) => ` - ${d.date} (${d.dayName}): ${d.isBeforeStart ? 'N/A (Before Plan Start)' : `${d.wearHours}h (${d.goalMet ? 'GOAL MET' : 'BELOW GOAL'})`}`).join('\n')}

--- SUMMARY FOR DOCTOR VISIT ---
Patient is tracking wear time consistently and adhering to tray schedule. Next appointment: ${settings.nextApptDate} at ${settings.nextApptTime}.
=======================================`;
  };

  const handleCopyReport = () => {
    navigator.clipboard.writeText(generateReportText());
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <BarChart3 className="w-5 h-5 text-teal-400" />
          <div>
            <h3 className="font-bold text-slate-100 text-base">Wear Adherence Analytics</h3>
            <p className="text-xs text-slate-400">Weekly breakdown and compliance insights</p>
          </div>
        </div>

        <button
          onClick={handleCopyReport}
          className="px-3 py-1.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedReport ? 'Report Copied!' : 'Copy Doctor Report'}</span>
        </button>
      </div>

      {/* Top Stat Summary Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
          <div className="text-slate-400 text-xs font-medium flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>7-Day Average</span>
          </div>
          <div className="text-lg font-bold text-slate-100 mt-1">{avgWearHours} h/day</div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
          <div className="text-slate-400 text-xs font-medium flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>Compliance Rate</span>
          </div>
          <div className="text-lg font-bold text-teal-300 mt-1">{complianceRate}%</div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 col-span-2 sm:col-span-1">
          <div className="text-slate-400 text-xs font-medium flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span>Target Wear Goal</span>
          </div>
          <div className="text-lg font-bold text-slate-100 mt-1">{settings.dailyTargetHours} h/day</div>
        </div>
      </div>

      {/* 7-Day Bar Chart */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
          <span>Daily Wear Hours (Past 7 Days)</span>
          <span className="text-slate-400 font-normal">Goal Line: {settings.dailyTargetHours}h</span>
        </div>

        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4">
          <div className="flex items-end justify-between gap-2">
            {past7DaysData.map((d, idx) => {
              const barHeightPercent = d.isBeforeStart ? 0 : Math.min(100, (d.wearHours / 24) * 100);
              const goalLinePercent = Math.min(100, (settings.dailyTargetHours / 24) * 100);
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className={`text-[11px] font-bold ${d.isBeforeStart ? 'text-slate-600 font-normal' : 'text-slate-200'}`}>
                    {d.isBeforeStart ? '-' : `${d.wearHours}h`}
                  </span>
                  {/* Fixed-height track (h-36 = 144px) so the bar fill and the
                      goal line below both use the exact same 0-24h scale and
                      the same reference box — every column's goal line then
                      lands at an identical pixel offset, forming one
                      continuous line across the chart instead of a badge
                      floating at an unrelated height. */}
                  <div className="relative w-full h-36 bg-slate-800/60 rounded-t-lg overflow-hidden border border-slate-700/30">
                    {!d.isBeforeStart && (
                      <div
                        className="absolute left-0 right-0 border-t border-dashed border-teal-400/70 z-10 pointer-events-none"
                        style={{ bottom: `${goalLinePercent}%` }}
                      />
                    )}
                    {d.isBeforeStart ? (
                      <div className="absolute bottom-0.5 left-0.5 right-0.5 h-1 bg-slate-700/40 rounded-t" title="Before treatment plan start" />
                    ) : (
                      <div
                        className={`absolute bottom-0 left-0 right-0 rounded-t-md transition-all duration-500 ${
                          d.goalMet
                            ? 'bg-gradient-to-t from-teal-500 to-emerald-400'
                            : 'bg-gradient-to-t from-amber-600 to-amber-400'
                        }`}
                        style={{ height: `${barHeightPercent}%` }}
                      />
                    )}
                  </div>
                  <span className={`text-[11px] font-medium ${d.isBeforeStart ? 'text-slate-600' : 'text-slate-400'}`}>
                    {d.dayName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Out-Time Reasons Breakdown */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
          <PieChart className="w-4 h-4 text-cyan-400" />
          <span>Out-Time Reasons Breakdown</span>
        </h4>

        <div className="space-y-2">
          {Object.entries(reasonCounts).map(([reason, mins]) => {
            const pct = Math.round((mins / totalReasonMins) * 100);
            return (
              <div key={reason} className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span className="capitalize font-medium">{reason.replace('_', ' ')}</span>
                  <span className="text-slate-400 font-mono">
                    {Math.round(mins / 60)}h {mins % 60}m ({pct}%)
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-cyan-400 h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
