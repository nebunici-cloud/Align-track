import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Layers, Calendar, ArrowRight, CheckCircle2, Award, Sparkles, Camera, ShieldAlert } from 'lucide-react';
import confetti from 'canvas-confetti';
import { AlignerSettings, getTrayDuration } from '../types';
import { playAlertChime, triggerPushNotification } from '../utils/soundAndNotifications';
import { getDayNumberSince } from '../utils/storage';

interface TrayProgressCardProps {
  settings: AlignerSettings;
  onUpdateSettings: (newSettings: AlignerSettings) => void;
  onOpenPhotoDiary: () => void;
}

export const TrayProgressCard: React.FC<TrayProgressCardProps> = ({
  settings,
  onUpdateSettings,
  onOpenPhotoDiary,
}) => {
  const [showSwitchModal, setShowSwitchModal] = useState<boolean>(false);

  // Switch checklist state
  const [checkFit, setCheckFit] = useState<boolean>(false);
  const [checkCleaned, setCheckCleaned] = useState<boolean>(false);
  const [checkChewies, setCheckChewies] = useState<boolean>(false);
  const [checkPhoto, setCheckPhoto] = useState<boolean>(false);

  // Calculate days spent in current tray based on custom or default duration
  const currentDurationDays = getTrayDuration(settings, settings.currentTray);
  const isCustomInterval = settings.customTrayDurations && settings.customTrayDurations[settings.currentTray] !== undefined;

  const diffDays = getDayNumberSince(settings.trayStartDate);
  const daysInCurrentTray = Math.min(currentDurationDays, diffDays);
  const daysRemaining = Math.max(0, currentDurationDays - daysInCurrentTray);

  // Overall treatment progress considering custom durations for each tray
  let totalTreatmentDays = 0;
  let completedDaysBeforeCurrent = 0;
  for (let i = 1; i <= settings.totalTrays; i++) {
    const dur = getTrayDuration(settings, i);
    totalTreatmentDays += dur;
    if (i < settings.currentTray) {
      completedDaysBeforeCurrent += dur;
    }
  }
  const totalDaysCompleted = completedDaysBeforeCurrent + daysInCurrentTray;
  const overallProgressPercent = Math.min(
    100,
    Math.round((totalDaysCompleted / (totalTreatmentDays || 1)) * 100)
  );

  const allChecklistDone = checkFit && checkCleaned && checkChewies;

  const handleConfirmSwitchTray = () => {
    if (settings.currentTray >= settings.totalTrays) return;

    const updatedSettings: AlignerSettings = {
      ...settings,
      currentTray: settings.currentTray + 1,
      trayStartDate: new Date().toISOString(),
    };

    onUpdateSettings(updatedSettings);
    setShowSwitchModal(false);

    // Reset modal checklist
    setCheckFit(false);
    setCheckCleaned(false);
    setCheckChewies(false);
    setCheckPhoto(false);

    // Fire Confetti!
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore if fail
    }

    playAlertChime('success');
    triggerPushNotification(`Switched to Tray ${settings.currentTray + 1}! 🎉`, {
      body: `Congratulations on advancing to Tray ${settings.currentTray + 1} of ${settings.totalTrays}. Remember to use chewies to seat your new aligners!`,
    });
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
              <span>Tray {settings.currentTray}</span>
              <span className="text-slate-400 text-xs font-normal">of {settings.totalTrays}</span>
            </h3>
            <p className="text-xs text-slate-400">
              {daysRemaining === 0 ? 'Ready to switch trays today!' : `${daysRemaining} days left in current tray`}
            </p>
          </div>
        </div>

        {/* Switch Tray Button */}
        <button
          onClick={() => setShowSwitchModal(true)}
          className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md ${
            daysRemaining === 0
              ? 'bg-gradient-to-r from-teal-400 to-cyan-400 text-slate-950 hover:from-teal-300 hover:to-cyan-300 shadow-teal-500/20 animate-bounce'
              : 'bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Switch to Tray {settings.currentTray + 1}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress Bar Rows */}
      <div className="mt-4 space-y-4">
        {/* Current Tray Days Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-medium text-slate-300">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-400" />
              <span>Current Tray Schedule</span>
              {isCustomInterval && (
                <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded text-[10px] font-semibold">
                  Custom Interval
                </span>
              )}
            </span>
            <span className="text-teal-400 font-semibold">
              Day {daysInCurrentTray} of {currentDurationDays}
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
            <div
              className="bg-gradient-to-r from-teal-500 to-cyan-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (daysInCurrentTray / currentDurationDays) * 100)}%` }}
            />
          </div>
        </div>

        {/* Overall Treatment Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-medium text-slate-300">
            <span className="flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-cyan-400" />
              <span>Total Orthodontic Treatment</span>
            </span>
            <span className="text-cyan-400 font-semibold">{overallProgressPercent}% Completed</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${overallProgressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tray Switch Confirmation Modal - portaled to document.body so it
          escapes this card's own backdrop-blur + overflow-hidden, which
          would otherwise become its containing block (per the CSS filter/
          backdrop-filter spec) and silently clip it instead of covering
          the real viewport. */}
      {showSwitchModal && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full max-h-[85dvh] overflow-y-auto p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 sticky -top-6 -mx-6 -mt-6 px-6 pt-6 bg-slate-900 z-10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-teal-400" />
                <h3 className="text-base font-bold text-slate-100">
                  Advancing to Tray {settings.currentTray + 1}
                </h3>
              </div>
              <button
                onClick={() => setShowSwitchModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Before inserting Tray #{settings.currentTray + 1}, please verify these safety & tracking steps:
            </p>

            {/* Checklist */}
            <div className="space-y-2.5">
              <label
                onClick={() => setCheckFit(!checkFit)}
                className={`flex items-start gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                  checkFit ? 'bg-teal-500/10 border-teal-500/40 text-teal-200' : 'bg-slate-800/60 border-slate-700/60 text-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checkFit}
                  onChange={(e) => setCheckFit(e.target.checked)}
                  className="mt-0.5 rounded text-teal-500 focus:ring-0"
                />
                <div>
                  <div className="font-semibold">Fit & Seating Check</div>
                  <div className="text-[11px] text-slate-400">
                    Verify new tray snaps firmly over teeth without excessive force or sharp plastic edges.
                  </div>
                </div>
              </label>

              <label
                onClick={() => setCheckCleaned(!checkCleaned)}
                className={`flex items-start gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                  checkCleaned ? 'bg-teal-500/10 border-teal-500/40 text-teal-200' : 'bg-slate-800/60 border-slate-700/60 text-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checkCleaned}
                  onChange={(e) => setCheckCleaned(e.target.checked)}
                  className="mt-0.5 rounded text-teal-500 focus:ring-0"
                />
                <div>
                  <div className="font-semibold">Rinse & Sanitize Tray #{settings.currentTray + 1}</div>
                  <div className="text-[11px] text-slate-400">
                    Rinse under cool water and store old Tray #{settings.currentTray} safely in case as backup.
                  </div>
                </div>
              </label>

              <label
                onClick={() => setCheckChewies(!checkChewies)}
                className={`flex items-start gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                  checkChewies ? 'bg-teal-500/10 border-teal-500/40 text-teal-200' : 'bg-slate-800/60 border-slate-700/60 text-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checkChewies}
                  onChange={(e) => setCheckChewies(e.target.checked)}
                  className="mt-0.5 rounded text-teal-500 focus:ring-0"
                />
                <div>
                  <div className="font-semibold">5-Minute Chewies Seating</div>
                  <div className="text-[11px] text-slate-400">
                    Bite gently on chewies across all teeth to eliminate air gaps and seat aligners fully.
                  </div>
                </div>
              </label>
            </div>

            <div className="p-3 bg-slate-800/60 border border-slate-700/50 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Camera className="w-4 h-4 text-cyan-400" />
                <span>Take Progress Photo for Tray #{settings.currentTray + 1}?</span>
              </div>
              <button
                onClick={() => {
                  setShowSwitchModal(false);
                  onOpenPhotoDiary();
                }}
                className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-lg text-xs font-semibold transition-colors"
              >
                Open Diary
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2 sticky -bottom-6 -mx-6 -mb-6 px-6 pb-6 bg-slate-900">
              <button
                onClick={() => setShowSwitchModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!allChecklistDone}
                onClick={handleConfirmSwitchTray}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                  allChecklistDone
                    ? 'bg-gradient-to-r from-teal-400 to-cyan-400 text-slate-950 hover:from-teal-300 hover:to-cyan-300 shadow-teal-500/20'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                }`}
              >
                Confirm Switch
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
