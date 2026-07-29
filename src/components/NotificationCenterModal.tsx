import React from 'react';
import { Bell, Check, Sparkles, AlertTriangle, Send, ShieldCheck, Volume2 } from 'lucide-react';
import { NotificationLog } from '../types';
import { playAlertChime, triggerPushNotification } from '../utils/soundAndNotifications';

interface NotificationCenterModalProps {
  isOpen: boolean;
  notifications: NotificationLog[];
  onClose: () => void;
  onClearAll: () => void;
  onAddNotification: (notif: Omit<NotificationLog, 'id'>) => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  notifications,
  onClose,
  onClearAll,
  onAddNotification,
}) => {
  if (!isOpen) return null;

  const handleTestNotification = async (type: NotificationLog['type']) => {
    let title = '';
    let body = '';

    if (type === 'out_limit') {
      title = 'Aligner Alert: Out Time Limit Exceeded!';
      body = 'Your aligners have been out for over 30 minutes. Time to rinse and put them back in!';
      playAlertChime('alarm');
    } else if (type === 'tray_change') {
      title = 'Tray Change Day! 🦷';
      body = 'Today is the scheduled day to switch to Tray #8. Perform chewies exercise upon seating.';
      playAlertChime('success');
    } else if (type === 'goal_achieved') {
      title = 'Daily Goal Met! 🎉';
      body = 'Awesome work! You completed 22 hours 15 mins of aligner wear today.';
      playAlertChime('success');
    }

    onAddNotification({
      title,
      body,
      timestamp: new Date().toISOString(),
      type,
      read: false,
    });

    await triggerPushNotification(title, { body });
  };

  const handleRequestPushPermission = async () => {
    if ('Notification' in window) {
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        playAlertChime('success');
        triggerPushNotification('Push Notifications Activated!', {
          body: 'AlignerTrack will notify you when aligners are out too long or when tray changes are due.',
        });
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-teal-400" />
            <h3 className="text-base font-bold text-slate-100">Notifications & Alerts</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm font-bold">
            ✕
          </button>
        </div>

        {/* Web Push Permission Bar */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span className="text-slate-300">Browser Push Notifications</span>
          </div>
          <button
            onClick={handleRequestPushPermission}
            className="px-2.5 py-1 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 rounded-lg font-semibold transition-colors"
          >
            Enable Push
          </button>
        </div>

        {/* Test Trigger Simulator */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Test Notification Alerts</span>
          </label>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <button
              onClick={() => handleTestNotification('out_limit')}
              className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 font-medium text-[11px] transition-colors"
            >
              Out Limit Alarm
            </button>
            <button
              onClick={() => handleTestNotification('tray_change')}
              className="p-2 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/20 font-medium text-[11px] transition-colors"
            >
              Tray Switch Alert
            </button>
            <button
              onClick={() => handleTestNotification('goal_achieved')}
              className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 font-medium text-[11px] transition-colors"
            >
              Goal Met Fanfare
            </button>
          </div>
        </div>

        {/* Notification List */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {notifications.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">No notifications yet.</div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className="bg-slate-800/40 border border-slate-800 rounded-xl p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">{n.title}</span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">{n.body}</p>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            onClick={onClearAll}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Clear History
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
