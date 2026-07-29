import React, { useState, useEffect } from 'react';
import { Sparkles, Play, Pause, RotateCcw, CheckCircle2, ShieldCheck, Volume2, VolumeX } from 'lucide-react';
import { playAlertChime } from '../utils/soundAndNotifications';

interface ChewiesTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleteExercise: (minutes: number) => void;
}

const QUADRANTS = ['Upper Right Teeth', 'Upper Front Teeth', 'Upper Left Teeth', 'Lower Left Teeth', 'Lower Front Teeth', 'Lower Right Teeth'];

export const ChewiesTimerModal: React.FC<ChewiesTimerModalProps> = ({
  isOpen,
  onClose,
  onCompleteExercise,
}) => {
  const [totalSeconds, setTotalSeconds] = useState<number>(300); // 5 mins default
  const [remainingSeconds, setRemainingSeconds] = useState<number>(300);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Quadrant index calculation
  const elapsed = totalSeconds - remainingSeconds;
  const quadrantIndex = Math.min(QUADRANTS.length - 1, Math.floor((elapsed / totalSeconds) * QUADRANTS.length));
  const activeQuadrant = QUADRANTS[quadrantIndex];

  // Timer loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && remainingSeconds > 0) {
      interval = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            playAlertChime('success');
            onCompleteExercise(Math.round(totalSeconds / 60));
            return 0;
          }

          // Gentle tick sound every 5 seconds for bite tempo
          if (soundEnabled && prev % 5 === 0) {
            playAlertChime('tick');
          }

          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, remainingSeconds, soundEnabled, totalSeconds, onCompleteExercise]);

  if (!isOpen) return null;

  const handleSelectDuration = (mins: number) => {
    const secs = mins * 60;
    setTotalSeconds(secs);
    setRemainingSeconds(secs);
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setRemainingSeconds(totalSeconds);
  };

  const formatMinSec = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = Math.round(((totalSeconds - remainingSeconds) / totalSeconds) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-left">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base">Chewies Seating Exercise</h3>
              <p className="text-xs text-slate-400">Eliminate air gaps & seat aligners tightly</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-sm font-bold p-1"
          >
            ✕
          </button>
        </div>

        {/* Duration selector */}
        <div className="flex justify-center gap-2 text-xs">
          {[3, 5, 10].map((m) => (
            <button
              key={m}
              onClick={() => handleSelectDuration(m)}
              className={`px-3 py-1.5 rounded-xl border font-semibold transition-all ${
                totalSeconds === m * 60
                  ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {m} Minutes
            </button>
          ))}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200"
            title={soundEnabled ? 'Mute Tempo Sound' : 'Enable Tempo Sound'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-teal-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>
        </div>

        {/* Interactive Pulsing Bite Target */}
        <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
          {/* Animated pulsing ring */}
          {isRunning && (
            <div className="absolute inset-0 rounded-full bg-teal-500/10 border border-teal-400/30 animate-ping opacity-30" />
          )}

          <svg className="w-full h-full transform -rotate-90">
            <circle cx="50%" cy="50%" r="42%" className="stroke-slate-800" strokeWidth="8%" fill="transparent" />
            <circle
              cx="50%"
              cy="50%"
              r="42%"
              className="stroke-teal-400 transition-all duration-300"
              strokeWidth="8%"
              strokeDasharray={`${2 * Math.PI * 65}`}
              strokeDashoffset={`${2 * Math.PI * 65 * (1 - progressPercent / 100)}`}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          <div className="absolute flex flex-col items-center justify-center space-y-1">
            <div className="font-mono text-4xl font-extrabold text-slate-100 tracking-wider">
              {formatMinSec(remainingSeconds)}
            </div>
            <div className="text-[11px] font-bold text-teal-400 uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20">
              {activeQuadrant}
            </div>
          </div>
        </div>

        {/* Guidance instructions */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-3 text-xs text-slate-300 leading-relaxed space-y-1">
          <div className="font-semibold text-slate-200 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span>Bite & hold chewies for 3–5 seconds</span>
          </div>
          <p className="text-slate-400 text-[11px]">
            Work systematically around the teeth arch from upper right to lower right to ensure full tray contact.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handleReset}
            className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
            title="Reset Timer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`flex-1 py-3 px-6 rounded-2xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all ${
              isRunning
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                : 'bg-gradient-to-r from-teal-400 to-cyan-400 hover:from-teal-300 hover:to-cyan-300 text-slate-950 shadow-teal-500/20'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4" /> Pause Exercise
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" /> Start Bite Exercise
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
