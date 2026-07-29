import React, { useState } from 'react';
import { User, Layers, Calendar, Clock, Sparkles, CheckCircle2, ChevronRight, ShieldCheck, Heart, UserPlus, ArrowLeft } from 'lucide-react';
import { UserProfile, AlignerSettings } from '../types';
import { DEFAULT_SETTINGS } from '../utils/storage';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (profile: UserProfile, settings: AlignerSettings) => void;
  isInitialFirstUse?: boolean;
}

const AVATAR_COLORS = [
  { name: 'Teal & Cyan', value: 'from-teal-500 to-cyan-400' },
  { name: 'Purple & Indigo', value: 'from-purple-500 to-indigo-400' },
  { name: 'Rose & Amber', value: 'from-rose-500 to-amber-400' },
  { name: 'Emerald & Lime', value: 'from-emerald-500 to-teal-400' },
  { name: 'Blue & Sky', value: 'from-blue-500 to-sky-400' },
  { name: 'Violet & Fuchsia', value: 'from-violet-500 to-fuchsia-400' },
];

const PLAN_BRANDS = [
  'Invisalign® Comprehensive',
  'Invisalign® Express / Lite',
  'Spark™ Clear Aligners',
  'ClearCorrect® System',
  '3M™ Clarity™ Aligners',
  'Custom Orthodontic Plan',
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  isInitialFirstUse = false,
}) => {
  const [step, setStep] = useState<number>(1);

  // Profile Form
  const [name, setName] = useState<string>('My Aligner Journey');
  const [planType, setPlanType] = useState<string>('Invisalign® Comprehensive');
  const [avatarColor, setAvatarColor] = useState<string>('from-teal-500 to-cyan-400');

  // Treatment Plan Settings Form
  const [totalTrays, setTotalTrays] = useState<number>(24);
  const [currentTray, setCurrentTray] = useState<number>(1);
  const [trayDurationDays, setTrayDurationDays] = useState<number>(7);
  const [dailyTargetHours, setDailyTargetHours] = useState<number>(22);
  const [starterTray14Days, setStarterTray14Days] = useState<boolean>(true);

  // Care Team & Notifications Form
  const [orthodontistName, setOrthodontistName] = useState<string>('Dr. Sarah Miller');
  const [clinicName, setClinicName] = useState<string>('BrightSmiles Orthodontics');
  const [outTimerAlertMinutes, setOutTimerAlertMinutes] = useState<number>(30);

  if (!isOpen) return null;

  const handleFinish = (e: React.FormEvent) => {
    e.preventDefault();

    const newProfile: UserProfile = {
      id: `acc_${Date.now()}`,
      name: name.trim() || 'My Aligner Journey',
      planType,
      avatarColor,
      createdAt: new Date().toISOString(),
    };

    const newSettings: AlignerSettings = {
      ...DEFAULT_SETTINGS,
      totalTrays,
      currentTray,
      trayDurationDays,
      dailyTargetHours,
      customTrayDurations: starterTray14Days ? { 1: 14 } : {},
      trayStartDate: new Date().toISOString(),
      orthodontistName,
      clinicName,
      outTimerAlertMinutes,
    };

    onComplete(newProfile, newSettings);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto custom-scrollbar">
        {/* Header Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${avatarColor} flex items-center justify-center text-slate-950 font-bold shadow-lg ring-1 ring-white/20`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-lg tracking-tight">
                {isInitialFirstUse ? 'Welcome to AlignerTrack' : 'Set Up New Treatment Plan'}
              </h3>
              <p className="text-xs text-slate-400">Step {step} of 3 • Individual Plan Setup</p>
            </div>
          </div>
          {!isInitialFirstUse && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Step Progress Dots */}
        <div className="flex items-center justify-between gap-2 bg-slate-950/50 p-2 rounded-2xl border border-slate-800/60">
          <div className={`flex-1 h-1.5 rounded-full transition-all ${step >= 1 ? 'bg-teal-400' : 'bg-slate-800'}`} />
          <div className={`flex-1 h-1.5 rounded-full transition-all ${step >= 2 ? 'bg-teal-400' : 'bg-slate-800'}`} />
          <div className={`flex-1 h-1.5 rounded-full transition-all ${step >= 3 ? 'bg-teal-400' : 'bg-slate-800'}`} />
        </div>

        {/* STEP 1: Account Profile & Brand */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="space-y-1">
              <h4 className="font-semibold text-slate-200 text-sm flex items-center gap-1.5">
                <User className="w-4 h-4 text-teal-400" />
                <span>Patient Account Details</span>
              </h4>
              <p className="text-xs text-slate-400">Personalize your profile for this orthodontic treatment plan.</p>
            </div>

            <div>
              <label className="text-xs text-slate-300 block mb-1 font-medium">Account / Patient Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sarah Jenkins"
                className="w-full bg-slate-800/80 border border-slate-700 focus:border-teal-400 text-slate-100 rounded-xl px-3.5 py-2.5 text-xs outline-none transition-colors"
                required
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 block mb-1 font-medium">Clear Aligner System / Brand</label>
              <select
                value={planType}
                onChange={(e) => setPlanType(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 focus:border-teal-400 text-slate-100 rounded-xl px-3 py-2.5 text-xs outline-none transition-colors"
              >
                {PLAN_BRANDS.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-300 block mb-1.5 font-medium">Avatar Theme Color</label>
              <div className="grid grid-cols-3 gap-2">
                {AVATAR_COLORS.map((col) => (
                  <button
                    key={col.value}
                    type="button"
                    onClick={() => setAvatarColor(col.value)}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-medium transition-all ${
                      avatarColor === col.value
                        ? 'bg-slate-800 border-teal-400 text-teal-300 shadow-md ring-1 ring-teal-400/30'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full bg-gradient-to-tr ${col.value}`} />
                    <span className="truncate text-[11px]">{col.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full bg-gradient-to-r from-teal-500 to-cyan-400 hover:from-teal-400 hover:to-cyan-300 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-teal-500/20"
              >
                <span>Next: Treatment Schedule</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Individual Plan Parameters */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="space-y-1">
              <h4 className="font-semibold text-slate-200 text-sm flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Your Individual Treatment Plan</span>
              </h4>
              <p className="text-xs text-slate-400">Configure your total trays, active tray, and wear interval goal.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1 font-medium">Total Trays in Plan</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={totalTrays}
                  onChange={(e) => setTotalTrays(Number(e.target.value))}
                  className="w-full bg-slate-800/80 border border-slate-700 focus:border-teal-400 text-slate-100 rounded-xl px-3 py-2.5 text-xs outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1 font-medium">Starting Active Tray #</label>
                <input
                  type="number"
                  min={1}
                  max={totalTrays}
                  value={currentTray}
                  onChange={(e) => setCurrentTray(Number(e.target.value))}
                  className="w-full bg-slate-800/80 border border-slate-700 focus:border-teal-400 text-slate-100 rounded-xl px-3 py-2.5 text-xs outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1 font-medium">Default Tray Switch Interval</label>
                <select
                  value={trayDurationDays}
                  onChange={(e) => setTrayDurationDays(Number(e.target.value))}
                  className="w-full bg-slate-800/80 border border-slate-700 focus:border-teal-400 text-slate-100 rounded-xl px-3 py-2.5 text-xs outline-none"
                >
                  <option value={5}>Every 5 Days</option>
                  <option value={7}>Every 7 Days (1 Week)</option>
                  <option value={10}>Every 10 Days</option>
                  <option value={14}>Every 14 Days (2 Weeks)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1 font-medium">Daily Wear Goal (Hours)</label>
                <select
                  value={dailyTargetHours}
                  onChange={(e) => setDailyTargetHours(Number(e.target.value))}
                  className="w-full bg-slate-800/80 border border-slate-700 focus:border-teal-400 text-slate-100 rounded-xl px-3 py-2.5 text-xs outline-none"
                >
                  <option value={20}>20 Hours / Day</option>
                  <option value={21}>21 Hours / Day</option>
                  <option value={22}>22 Hours / Day (Recommended)</option>
                  <option value={23}>23 Hours / Day</option>
                </select>
              </div>
            </div>

            {/* Custom starter tray preset check */}
            <div className="p-3 bg-slate-800/50 border border-slate-700/80 rounded-xl flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-amber-300 block">Tray #1 Starter Interval</span>
                <span className="text-[11px] text-slate-400 block">
                  Set Tray #1 to 14 days for initial teeth adaptation.
                </span>
              </div>
              <input
                type="checkbox"
                checked={starterTray14Days}
                onChange={(e) => setStarterTray14Days(e.target.checked)}
                className="w-4 h-4 accent-teal-400 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2 pt-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-400 hover:from-teal-400 hover:to-cyan-300 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-teal-500/20"
              >
                <span>Next: Care Team & Preferences</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Care Team & Final Confirmation */}
        {step === 3 && (
          <form onSubmit={handleFinish} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="space-y-1">
              <h4 className="font-semibold text-slate-200 text-sm flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Care Team & Alerts</span>
              </h4>
              <p className="text-xs text-slate-400">Set orthodontist details and meal out-timer limit.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1 font-medium">Orthodontist Name</label>
                <input
                  type="text"
                  value={orthodontistName}
                  onChange={(e) => setOrthodontistName(e.target.value)}
                  placeholder="e.g. Dr. Sarah Miller"
                  className="w-full bg-slate-800/80 border border-slate-700 focus:border-teal-400 text-slate-100 rounded-xl px-3 py-2.5 text-xs outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1 font-medium">Clinic / Office</label>
                <input
                  type="text"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  placeholder="e.g. BrightSmiles Ortho"
                  className="w-full bg-slate-800/80 border border-slate-700 focus:border-teal-400 text-slate-100 rounded-xl px-3 py-2.5 text-xs outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-300 block mb-1 font-medium">Out-Timer Meal Limit Alert</label>
              <select
                value={outTimerAlertMinutes}
                onChange={(e) => setOutTimerAlertMinutes(Number(e.target.value))}
                className="w-full bg-slate-800/80 border border-slate-700 focus:border-teal-400 text-slate-100 rounded-xl px-3 py-2.5 text-xs outline-none"
              >
                <option value={15}>15 Minutes (Strict)</option>
                <option value={30}>30 Minutes (Recommended)</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes</option>
              </select>
            </div>

            {/* Plan Overview Card */}
            <div className="p-3.5 bg-gradient-to-br from-slate-800/80 to-slate-900 border border-slate-700/80 rounded-2xl space-y-2">
              <span className="text-[11px] font-bold text-teal-400 uppercase tracking-wider block">
                Plan Setup Summary
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                <div>
                  <span className="text-slate-400 block text-[10px]">Patient Name</span>
                  <span className="font-semibold text-slate-100">{name || 'Unnamed Plan'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Aligner System</span>
                  <span className="font-semibold text-slate-100">{planType}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Total Trays</span>
                  <span className="font-semibold text-slate-100">{totalTrays} Trays</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Switch Schedule</span>
                  <span className="font-semibold text-slate-100">Every {trayDurationDays} Days</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Activate Treatment Plan</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
