import React, { useState, useRef } from 'react';
import {
  Settings,
  Save,
  RotateCcw,
  User,
  Clock,
  Layers,
  Calendar,
  Plus,
  Trash2,
  Sparkles,
  Cloud,
  CheckCircle2,
  Download,
  Upload,
  Database,
  HardDrive,
} from 'lucide-react';
import { AlignerSettings, WearLog } from '../types';
import { User as FirebaseUser } from '../lib/firebase';

interface SettingsModalProps {
  isOpen: boolean;
  settings: AlignerSettings;
  logs?: WearLog[];
  authUser?: FirebaseUser | null;
  onClose: () => void;
  onSave: (newSettings: AlignerSettings) => void;
  onResetAll: () => void;
  onOpenAuthModal?: () => void;
  onImportBackup?: (backupData: any) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  logs = [],
  authUser,
  onClose,
  onSave,
  onResetAll,
  onOpenAuthModal,
  onImportBackup,
}) => {
  const [formData, setFormData] = useState<AlignerSettings>(settings);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local states for custom interval manager
  const [singleTrayNum, setSingleTrayNum] = useState<number>(1);
  const [singleDays, setSingleDays] = useState<number>(14);

  const [rangeFrom, setRangeFrom] = useState<number>(1);
  const [rangeTo, setRangeTo] = useState<number>(3);
  const [rangeDays, setRangeDays] = useState<number>(10);

  if (!isOpen) return null;

  const handleExportBackup = () => {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      settings: formData,
      logs: logs,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AlignerTrack_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.settings || parsed.logs) {
          if (onImportBackup) {
            onImportBackup(parsed);
          }
          if (parsed.settings) {
            setFormData(parsed.settings);
          }
        } else {
          alert('Invalid backup file. Missing settings or logs structure.');
        }
      } catch {
        alert('Could not parse JSON backup file.');
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleAddOrUpdateSingle = () => {
    setFormData({
      ...formData,
      customTrayDurations: {
        ...(formData.customTrayDurations || {}),
        [singleTrayNum]: singleDays,
      },
    });
  };

  const handleRemoveSingle = (trayNum: number) => {
    const updated = { ...(formData.customTrayDurations || {}) };
    delete updated[trayNum];
    setFormData({
      ...formData,
      customTrayDurations: updated,
    });
  };

  const handleApplyRange = () => {
    if (rangeFrom > rangeTo) return;
    const updated = { ...(formData.customTrayDurations || {}) };
    for (let t = rangeFrom; t <= rangeTo; t++) {
      updated[t] = rangeDays;
    }
    setFormData({
      ...formData,
      customTrayDurations: updated,
    });
  };

  const handleClearAllCustoms = () => {
    setFormData({
      ...formData,
      customTrayDurations: {},
    });
  };

  const customOverrides = formData.customTrayDurations || {};
  const customTrayNumbers = Object.keys(customOverrides)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-teal-400" />
            <h3 className="text-base font-bold text-slate-100">Aligner & Treatment Settings</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm font-bold">
            ✕
          </button>
        </div>

        {/* GOOGLE CLOUD SYNC CARD */}
        <div className="bg-gradient-to-r from-slate-800/90 to-slate-800/50 p-3.5 border border-slate-700/80 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-100">
              <Cloud className="w-4 h-4 text-teal-400" />
              <span>Cross-Device Cloud Sync</span>
            </div>
            {authUser && (
              <span className="text-[10px] font-semibold text-teal-300 bg-teal-500/10 border border-teal-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-teal-400" />
                Active
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 text-xs">
            <p className="text-slate-400 text-[11px] leading-snug">
              {authUser
                ? `Signed in as ${authUser.displayName || authUser.email}. Live sync enabled across all browsers.`
                : 'Sign in with your Google account to sync timer logs, progress photos, and settings everywhere.'}
            </p>

            <button
              type="button"
              onClick={onOpenAuthModal}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 transition-all ${
                authUser
                  ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                  : 'bg-white hover:bg-slate-100 text-slate-900 shadow-md'
              }`}
            >
              {authUser ? 'Manage Account' : 'Sign in with Google'}
            </button>
          </div>
        </div>

        {/* DATA STORAGE & BACKUP MANAGEMENT CARD */}
        <div className="bg-slate-800/60 p-3.5 border border-slate-700/60 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Database className="w-4 h-4 text-cyan-400" />
              <span>Storage & Backup Safeguards</span>
            </div>
            <span className="text-[10px] text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded-md border border-slate-700/40">
              {logs.length} wear logs stored
            </span>
          </div>

          <p className="text-[11px] text-slate-400 leading-normal">
            Your aligner logs are saved continuously in your browser’s Local Storage (`localStorage`) and merged with your Google Firestore Cloud database to prevent accidental data loss.
          </p>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleExportBackup}
              className="flex-1 px-3 py-1.5 bg-slate-700/80 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-600/50"
            >
              <Download className="w-3.5 h-3.5 text-teal-400" />
              <span>Export Backup (.JSON)</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 px-3 py-1.5 bg-slate-700/80 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-600/50"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>Restore Backup</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Treatment Goals & Timeline */}
          <div className="space-y-3 bg-slate-800/40 p-3.5 border border-slate-800 rounded-xl">
            <h4 className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
              <Clock className="w-3.5 h-3.5 text-teal-400" />
              <span>Wear Goal & Schedule</span>
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Daily Target Hours</label>
                <select
                  value={formData.dailyTargetHours}
                  onChange={(e) => setFormData({ ...formData, dailyTargetHours: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-2 focus:ring-1 focus:ring-teal-400"
                >
                  {[18, 19, 20, 21, 22, 23].map((h) => (
                    <option key={h} value={h}>
                      {h} Hours / Day
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Default Switch Interval</label>
                <select
                  value={formData.trayDurationDays}
                  onChange={(e) => setFormData({ ...formData, trayDurationDays: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-2 focus:ring-1 focus:ring-teal-400"
                >
                  {[5, 7, 10, 14].map((d) => (
                    <option key={d} value={d}>
                      Every {d} Days (Default)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Current Active Tray</label>
                <input
                  type="number"
                  min={1}
                  max={formData.totalTrays}
                  value={formData.currentTray}
                  onChange={(e) => setFormData({ ...formData, currentTray: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-2 focus:ring-1 focus:ring-teal-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Total Trays in Plan</label>
                <input
                  type="number"
                  min={1}
                  value={formData.totalTrays}
                  onChange={(e) => setFormData({ ...formData, totalTrays: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-2 focus:ring-1 focus:ring-teal-400"
                />
              </div>
            </div>

            {/* Plan Start Date & Start Time */}
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
              <span className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-400" />
                <span>Aligners Plan Start Date & Time</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Plan Start Date</label>
                  <input
                    type="date"
                    value={formData.planStartDate || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setFormData({ ...formData, planStartDate: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-teal-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Plan Start Time</label>
                  <input
                    type="time"
                    value={formData.planStartTime || '09:00'}
                    onChange={(e) => setFormData({ ...formData, planStartTime: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-teal-400"
                  />
                </div>
              </div>
            </div>

            {/* Preferred Tray Change Time Reminder */}
            <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2.5">
              <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Next Tray Change Preferred Time</span>
              </span>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-400 block mb-1">Reminder Time</label>
                  <input
                    type="time"
                    value={formData.preferredTrayChangeTime || '21:00'}
                    onChange={(e) => setFormData({ ...formData, preferredTrayChangeTime: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-amber-400"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block">Presets:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, preferredTrayChangeTime: '21:00' })}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-semibold transition-colors"
                    >
                      21:00
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, preferredTrayChangeTime: '22:00' })}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-semibold transition-colors"
                    >
                      22:00
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, preferredTrayChangeTime: '08:00' })}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-semibold transition-colors"
                    >
                      08:00
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-400/90 leading-normal pt-0.5">
                Notifications and schedule timers will remind you at this preferred time on tray change days (e.g. 21:00 before bed).
              </p>
            </div>

            {/* Rubber Bands / Elastics Settings */}
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Rubber Bands / Elastics Tracking</span>
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.useRubberBands ?? true}
                    onChange={(e) => setFormData({ ...formData, useRubberBands: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {formData.useRubberBands && (
                <div className="pt-1.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-slate-400">Target Changes Per Day</label>
                    <select
                      value={formData.rubberBandsTargetPerDay || 3}
                      onChange={(e) => setFormData({ ...formData, rubberBandsTargetPerDay: Number(e.target.value) })}
                      className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg p-1.5 text-xs focus:ring-1 focus:ring-amber-400"
                    >
                      <option value={1}>1x / day</option>
                      <option value={2}>2x / day (e.g. Morning & Night)</option>
                      <option value={3}>3x / day (e.g. Breakfast, Lunch, Dinner)</option>
                      <option value={4}>4x / day (With snacks)</option>
                    </select>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Shows 1-tap Rubber Bands logger in Quick Tracker for changing elastics 2-3x daily as prescribed by your orthodontist.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Out-Timer Alert Limit (Minutes)</label>
              <select
                value={formData.outTimerAlertMinutes}
                onChange={(e) => setFormData({ ...formData, outTimerAlertMinutes: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-2 focus:ring-1 focus:ring-teal-400"
              >
                {[15, 20, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    Alert after {m} minutes out
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Tray Intervals Manager */}
          <div className="space-y-3 bg-slate-800/40 p-3.5 border border-slate-800 rounded-xl">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Custom Tray Intervals</span>
              </h4>
              {customTrayNumbers.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllCustoms}
                  className="text-[11px] text-rose-400 hover:text-rose-300 transition-colors"
                >
                  Clear Overrides
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Set custom wear durations for specific trays (e.g. 14 days for Tray #1 or refinement stages).
            </p>

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Presets:</span>
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    customTrayDurations: { ...(formData.customTrayDurations || {}), 1: 14 },
                  })
                }
                className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-semibold transition-colors"
              >
                Tray #1 = 14 Days (Starter)
              </button>
              <button
                type="button"
                onClick={() => {
                  const updated = { ...(formData.customTrayDurations || {}) };
                  updated[1] = 14;
                  updated[2] = 10;
                  updated[3] = 10;
                  setFormData({ ...formData, customTrayDurations: updated });
                }}
                className="px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-lg text-[10px] font-semibold transition-colors"
              >
                Trays #1-3 Graduated
              </button>
            </div>

            {/* Set Single Tray Custom Duration */}
            <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
              <span className="text-[11px] font-semibold text-slate-300 block">Single Tray Override</span>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-400 block">Tray #</label>
                  <select
                    value={singleTrayNum}
                    onChange={(e) => setSingleTrayNum(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg p-1.5 text-xs"
                  >
                    {Array.from({ length: formData.totalTrays }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={num}>
                        Tray #{num}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1">
                  <label className="text-[10px] text-slate-400 block">Duration (Days)</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={singleDays}
                    onChange={(e) => setSingleDays(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg p-1.5 text-xs"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddOrUpdateSingle}
                  className="mt-3.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Set</span>
                </button>
              </div>
            </div>

            {/* Set Range Override */}
            <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
              <span className="text-[11px] font-semibold text-slate-300 block">Bulk Range Override</span>
              <div className="flex items-center gap-2">
                <div className="w-20">
                  <label className="text-[10px] text-slate-400 block">From Tray</label>
                  <input
                    type="number"
                    min={1}
                    max={formData.totalTrays}
                    value={rangeFrom}
                    onChange={(e) => setRangeFrom(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg p-1.5 text-xs"
                  />
                </div>

                <div className="w-20">
                  <label className="text-[10px] text-slate-400 block">To Tray</label>
                  <input
                    type="number"
                    min={1}
                    max={formData.totalTrays}
                    value={rangeTo}
                    onChange={(e) => setRangeTo(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg p-1.5 text-xs"
                  />
                </div>

                <div className="flex-1">
                  <label className="text-[10px] text-slate-400 block">Days / Tray</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={rangeDays}
                    onChange={(e) => setRangeDays(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg p-1.5 text-xs"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleApplyRange}
                  className="mt-3.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 font-bold rounded-lg text-xs transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* List of active custom overrides */}
            {customTrayNumbers.length > 0 ? (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Active Custom Intervals ({customTrayNumbers.length})
                </span>
                <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                  {customTrayNumbers.map((num) => (
                    <div
                      key={num}
                      className="flex items-center justify-between p-2 bg-slate-800/80 border border-slate-700/60 rounded-lg text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-teal-300">Tray #{num}</span>
                        <span className="text-slate-400">→</span>
                        <span className="font-semibold text-amber-300">{customOverrides[num]} Days</span>
                        <span className="text-[10px] text-slate-500">
                          (Default is {formData.trayDurationDays} days)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSingle(num)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                        title="Remove override"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 italic p-2 bg-slate-900/40 rounded-lg text-center">
                All trays are currently following the default interval of {formData.trayDurationDays} days.
              </div>
            )}
          </div>

          {/* Orthodontist Details */}
          <div className="space-y-3 bg-slate-800/40 p-3.5 border border-slate-800 rounded-xl">
            <h4 className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span>Orthodontist & Care Info</span>
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Doctor Name</label>
                <input
                  type="text"
                  value={formData.orthodontistName}
                  onChange={(e) => setFormData({ ...formData, orthodontistName: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-2 focus:ring-1 focus:ring-teal-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Clinic Name</label>
                <input
                  type="text"
                  value={formData.clinicName}
                  onChange={(e) => setFormData({ ...formData, clinicName: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-2 focus:ring-1 focus:ring-teal-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Next Appt Date</label>
                <input
                  type="date"
                  value={formData.nextApptDate}
                  onChange={(e) => setFormData({ ...formData, nextApptDate: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-2 focus:ring-1 focus:ring-teal-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Next Appt Time</label>
                <input
                  type="time"
                  value={formData.nextApptTime}
                  onChange={(e) => setFormData({ ...formData, nextApptTime: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-2 focus:ring-1 focus:ring-teal-400"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onResetAll}
              className="text-rose-400 hover:text-rose-300 flex items-center gap-1 font-medium text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Sample Data</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl font-bold transition-colors flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Settings</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
