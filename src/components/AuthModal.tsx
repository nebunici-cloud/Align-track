import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Cloud,
  CheckCircle2,
  LogOut,
  ShieldCheck,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { auth, googleProvider, signInWithPopup, signOut, User } from '../lib/firebase';

interface AuthModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onSuccessToast?: (msg: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  user,
  onClose,
  onSuccessToast,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (onSuccessToast) {
        onSuccessToast(`Signed in as ${result.user.displayName || result.user.email}! Data syncing enabled.`);
      }
      onClose();
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      setErrorMsg(err.message || 'Failed to sign in with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      if (onSuccessToast) {
        onSuccessToast('Signed out of Google account. Local data preserved.');
      }
      onClose();
    } catch (err: any) {
      console.error('Sign Out Error:', err);
      setErrorMsg('Failed to sign out.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-slate-100">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-slate-950 shadow-lg shadow-teal-500/20 shrink-0">
            <Cloud className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              {user ? 'Cloud Sync Status' : 'Sync Across Devices'}
            </h3>
            <p className="text-xs text-slate-400">
              {user ? 'Your aligner data is backed up to Google' : 'Sign in to access your data anywhere'}
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* User Logged In Card */}
        {user ? (
          <div className="space-y-4">
            <div className="p-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl flex items-center gap-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Google User'}
                  className="w-12 h-12 rounded-full border-2 border-teal-400 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-teal-500 text-slate-950 font-black text-lg flex items-center justify-center">
                  {(user.displayName || user.email || 'G')[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-sm text-slate-100 truncate">
                    {user.displayName || 'Google User'}
                  </p>
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                </div>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-teal-300 font-semibold">
                  <RefreshCw className="w-3 h-3 text-teal-400 animate-spin" />
                  <span>Real-time cross-device sync active</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-xl text-xs text-teal-200 space-y-1">
              <span className="font-bold flex items-center gap-1 text-teal-300">
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                Your data is safe & private
              </span>
              <p className="text-slate-300 text-[11px]">
                Every edit to your tray schedule, timers, and photos is automatically saved to your Google account in real time.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-rose-300 hover:text-rose-200 font-bold text-xs flex items-center justify-center gap-2 transition-all"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span>Sign Out of Google</span>
            </button>
          </div>
        ) : (
          /* User Not Logged In - Sign In Button */
          <div className="space-y-4">
            <div className="p-4 bg-slate-800/50 border border-slate-700/60 rounded-2xl space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-2 text-teal-300 font-bold text-sm">
                <Sparkles className="w-4 h-4 text-teal-400" />
                <span>Seamless Cross-Device Experience</span>
              </div>
              <ul className="space-y-1.5 text-slate-300 text-[11px] list-disc list-inside">
                <li>Sync your daily wear timers live on mobile & desktop</li>
                <li>Never lose your smile diary photos or historical logs</li>
                <li>Instant Google login without creating passwords</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3.5 px-5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-black text-sm shadow-xl flex items-center justify-center gap-3 transition-all transform active:scale-98"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-slate-700" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
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
              <span>Continue with Google</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
