import React, { useState } from 'react';
import { Calendar, Utensils, Coffee, Sparkles, Clock, Trash2, Plus, Edit2, CheckCircle, AlertTriangle } from 'lucide-react';
import { WearLog, OutReason, AlignerSettings } from '../types';
import { getTodayDateString, getAvailableMinutesForDate } from '../utils/storage';

interface DailyLogsListProps {
  logs: WearLog[];
  settings: AlignerSettings;
  onAddLog: (log: Omit<WearLog, 'id'>) => void;
  onEditLog: (log: WearLog) => void;
  onDeleteLog: (id: string) => void;
}

const REASON_LABELS: Record<OutReason, { label: string; bg: string; text: string }> = {
  breakfast: { label: 'Breakfast', bg: 'bg-amber-500/15', text: 'text-amber-300' },
  lunch: { label: 'Lunch', bg: 'bg-emerald-500/15', text: 'text-emerald-300' },
  dinner: { label: 'Dinner', bg: 'bg-indigo-500/15', text: 'text-indigo-300' },
  snack: { label: 'Snack', bg: 'bg-orange-500/15', text: 'text-orange-300' },
  coffee_drink: { label: 'Coffee / Tea', bg: 'bg-yellow-500/15', text: 'text-yellow-300' },
  brushing_cleaning: { label: 'Teeth Cleaning', bg: 'bg-teal-500/15', text: 'text-teal-300' },
  sports: { label: 'Sports / Activity', bg: 'bg-blue-500/15', text: 'text-blue-300' },
  other: { label: 'Other Out-Time', bg: 'bg-slate-700/50', text: 'text-slate-300' },
};

export const DailyLogsList: React.FC<DailyLogsListProps> = ({
  logs,
  settings,
  onAddLog,
  onEditLog,
  onDeleteLog,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingLog, setEditingLog] = useState<WearLog | null>(null);

  // Manual Add / Edit Form State
  const [manualReason, setManualReason] = useState<OutReason>('lunch');
  const [manualStartTime, setManualStartTime] = useState<string>('12:30');
  const [manualEndTime, setManualEndTime] = useState<string>('13:00');
  const [manualNotes, setManualNotes] = useState<string>('');

  // Get unique dates available in logs + today
  const todayStr = getTodayDateString();
  const allDates = Array.from(new Set([todayStr, ...logs.map((l) => l.date)])).sort().reverse();

  // Logs for selected date
  const filteredLogs = logs.filter((l) => l.date === selectedDate);

  // Calculate stats for selected date
  const totalOutMins = filteredLogs.reduce((sum, l) => sum + (l.durationMinutes || 0), 0);
  const { availableMins, isBeforeStart, isPlanStartDay } = getAvailableMinutesForDate(selectedDate, settings);

  const totalWearMins = isBeforeStart ? 0 : Math.max(0, availableMins - totalOutMins);
  const totalWearHours = (totalWearMins / 60).toFixed(1);

  const targetMins = isPlanStartDay
    ? (settings.dailyTargetHours / 24) * availableMins
    : settings.dailyTargetHours * 60;
  const isTargetMet = totalWearMins >= targetMins && availableMins > 0;

  const handleOpenEdit = (log: WearLog) => {
    setEditingLog(log);
    setManualReason(log.reason || 'other');
    try {
      const s = new Date(log.startTime);
      const sHours = s.getHours().toString().padStart(2, '0');
      const sMins = s.getMinutes().toString().padStart(2, '0');
      setManualStartTime(`${sHours}:${sMins}`);

      if (log.endTime) {
        const e = new Date(log.endTime);
        const eHours = e.getHours().toString().padStart(2, '0');
        const eMins = e.getMinutes().toString().padStart(2, '0');
        setManualEndTime(`${eHours}:${eMins}`);
      } else {
        setManualEndTime('13:00');
      }
    } catch {
      setManualStartTime('12:30');
      setManualEndTime('13:00');
    }
    setManualNotes(log.notes || '');
  };

  const handleSaveEditLog = () => {
    if (!editingLog || !manualStartTime || !manualEndTime) return;

    const startIso = new Date(`${selectedDate}T${manualStartTime}:00`).toISOString();
    const endIso = new Date(`${selectedDate}T${manualEndTime}:00`).toISOString();

    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();
    const durationMins = Math.max(1, Math.round((endMs - startMs) / 60000));

    onEditLog({
      ...editingLog,
      date: selectedDate,
      startTime: startIso,
      endTime: endIso,
      durationMinutes: durationMins,
      reason: manualReason,
      notes: manualNotes.trim() || undefined,
    });

    setEditingLog(null);
  };

  const handleSaveManualLog = () => {
    if (!manualStartTime || !manualEndTime) return;

    // Construct ISO dates for selected date & time
    const startIso = new Date(`${selectedDate}T${manualStartTime}:00`).toISOString();
    const endIso = new Date(`${selectedDate}T${manualEndTime}:00`).toISOString();

    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();
    const durationMins = Math.max(1, Math.round((endMs - startMs) / 60000));

    onAddLog({
      date: selectedDate,
      type: 'out',
      startTime: startIso,
      endTime: endIso,
      durationMinutes: durationMins,
      reason: manualReason,
      notes: manualNotes.trim() || undefined,
    });

    setShowAddModal(false);
    setManualNotes('');
  };

  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-sm space-y-4">
      {/* Header & Date Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <Clock className="w-5 h-5 text-teal-400" />
          <h3 className="font-bold text-slate-100 text-base">Wear & Out Time Logs</h3>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-400"
          />
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 rounded-xl text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Entry</span>
          </button>
        </div>
      </div>

      {/* Selected Day Compliance Summary Banner */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {isTargetMet ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <div>
            <span className="font-semibold text-slate-200">
              {selectedDate === todayStr ? "Today's Total Wear" : `Wear on ${selectedDate}`}:
            </span>{' '}
            <span className={isTargetMet ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {totalWearHours} Hours
            </span>
          </div>
        </div>

        <span className="text-slate-400 font-mono">
          {filteredLogs.length} Out Session{filteredLogs.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Logs List */}
      <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No out logs recorded for this day. Aligners stayed in continuously!
          </div>
        ) : (
          filteredLogs.map((log) => {
            const reasonData = REASON_LABELS[log.reason || 'other'];
            return (
              <div
                key={log.id}
                className="bg-slate-800/40 hover:bg-slate-800/70 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-1 rounded-lg font-semibold border border-slate-700/50 ${reasonData.bg} ${reasonData.text}`}
                  >
                    {reasonData.label}
                  </span>

                  <div>
                    <div className="text-slate-200 font-medium">
                      {formatTime(log.startTime)} - {log.endTime ? formatTime(log.endTime) : 'Active'}
                    </div>
                    {log.notes && <div className="text-slate-400 text-[11px] mt-0.5">{log.notes}</div>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                    {log.durationMinutes} min out
                  </span>
                  <button
                    onClick={() => handleOpenEdit(log)}
                    className="text-slate-400 hover:text-teal-300 transition-colors p-1 rounded-md hover:bg-slate-700/50"
                    title="Edit log entry"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteLog(log.id)}
                    className="text-slate-500 hover:text-rose-400 transition-colors p-1 rounded-md hover:bg-slate-700/50"
                    title="Delete log entry"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Manual Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-teal-400" />
                Add Past Out-Time Entry
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium mb-1 block">Reason Out</label>
                <select
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value as OutReason)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-teal-400"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                  <option value="coffee_drink">Coffee / Tea / Beverage</option>
                  <option value="brushing_cleaning">Teeth Cleaning & Hygiene</option>
                  <option value="sports">Sports / Swimming / Activity</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium mb-1 block">Start Time</label>
                  <input
                    type="time"
                    value={manualStartTime}
                    onChange={(e) => setManualStartTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-teal-400"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium mb-1 block">End Time</label>
                  <input
                    type="time"
                    value={manualEndTime}
                    onChange={(e) => setManualEndTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-teal-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-medium mb-1 block">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Dining out with friends..."
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-teal-400"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveManualLog}
                className="flex-1 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold shadow-md transition-colors"
              >
                Save Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Log Modal */}
      {editingLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-teal-400" />
                Edit Out-Time Log Entry
              </h3>
              <button
                onClick={() => setEditingLog(null)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium mb-1 block">Reason Out</label>
                <select
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value as OutReason)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-teal-400"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                  <option value="coffee_drink">Coffee / Tea / Beverage</option>
                  <option value="brushing_cleaning">Teeth Cleaning & Hygiene</option>
                  <option value="sports">Sports / Activity</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium mb-1 block">Start Time</label>
                  <input
                    type="time"
                    value={manualStartTime}
                    onChange={(e) => setManualStartTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-teal-400"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium mb-1 block">End Time</label>
                  <input
                    type="time"
                    value={manualEndTime}
                    onChange={(e) => setManualEndTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-teal-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-medium mb-1 block">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Adjusted time for long dinner..."
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-teal-400"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setEditingLog(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditLog}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-400 hover:from-teal-400 hover:to-cyan-300 text-slate-950 text-xs font-bold shadow-md transition-all"
              >
                Update Log Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
