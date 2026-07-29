import React, { useState } from 'react';
import {
  Smile,
  Sparkles,
  ShieldCheck,
  Clock,
  Layers,
  Calendar,
  Camera,
  Loader2,
  AlertCircle,
  Cloud,
} from 'lucide-react';
import { auth, googleProvider, signInWithPopup } from '../lib/firebase';

interface LoginScreenProps {
  onSuccessToast?: (msg: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccessToast }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (onSuccessToast) {
        onSuccessToast(`Welcome back, ${result.user.displayName || result.user.email}!`);
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      setErrorMsg(err.message || 'Failed to sign in with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4 sm:p-6 text-slate-100 font-sans relative overflow-hidden">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 backdrop-blur-md">
        {/* App Logo & Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-500 via-teal-400 to-cyan-400 text-slate-950 shadow-xl shadow-teal-500/20 mb-1">
            <Smile className="w-9 h-9 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight flex items-center justify-center gap-2">
              Aligner Tracker
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">
              Invisalign & Clear Aligner Treatment Companion
            </p>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2.5 text-xs text-slate-300">
            <div className="p-1.5 rounded-lg bg-teal-500/15 text-teal-400 shrink-0">
              <Cloud className="w-4 h-4" />
            </div>
            <span>
              <strong className="text-slate-100 font-bold">Seamless Cross-Device Sync:</strong> Wear logs sync live between mobile & desktop.
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-slate-300">
            <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <span>
              <strong className="text-slate-100 font-bold">Live Out-Timer & Reminders:</strong> Track meal times & reach your 22h daily goal.
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-slate-300">
            <div className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-400 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <span>
              <strong className="text-slate-100 font-bold">Care Routines & Elastics:</strong> Daily chewies timer, rubber bands, & tray change schedules.
            </span>
          </div>
        </div>

        {/* Error Alert if any */}
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Sign In CTA Button */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-4 px-6 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-black text-sm sm:text-base shadow-xl flex items-center justify-center gap-3 transition-all transform active:scale-98 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-700" />
            ) : (
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.15C3.26 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.39l3.99-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.72-4.96z"
                />
              </svg>
            )}
            <span>Sign in with Google</span>
          </button>

          <p className="text-[11px] text-slate-500 text-center flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>Sign in required to access your account & sync treatment logs</span>
          </p>
        </div>
      </div>
    </div>
  );
};
