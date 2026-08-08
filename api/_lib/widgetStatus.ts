import type { DocumentReference } from 'firebase-admin/firestore';
import type { ActiveTimerState } from '../../src/services/firebaseService';
import type { AlignerSettings } from '../../src/types';

export interface WidgetStatusPayload {
  wearStatus: ActiveTimerState['wearStatus'];
  startTime: string | null;
  reason: string | null;
  wornSeconds: number;
  goalSeconds: number;
  outMinutesToday: number;
}

/**
 * Minutes available for wear-tracking today, mirroring
 * src/utils/storage.ts#getAvailableMinutesForDate. `now` here is expected to
 * already be shifted to the caller's local wall-clock time (see
 * `toLocalTime` below) so getUTCHours()/getUTCMinutes() read as local time.
 */
function getAvailableMinutesToday(settings: AlignerSettings | undefined, todayStr: string, now: Date): number {
  const planStartStr = settings?.planStartDate || (settings?.trayStartDate ? settings.trayStartDate.slice(0, 10) : todayStr);
  if (todayStr < planStartStr) return 0;

  let startWindowMin = 0;
  if (todayStr === planStartStr && settings?.planStartTime) {
    const [h, m] = settings.planStartTime.split(':').map((n) => parseInt(n, 10) || 0);
    startWindowMin = h * 60 + m;
  }

  const endWindowMin = Math.min(1440, Math.max(1, now.getUTCHours() * 60 + now.getUTCMinutes()));
  return Math.max(0, endWindowMin - startWindowMin);
}

/**
 * Shifts a UTC Date by the caller's timezone offset (in the same sign
 * convention as JS's Date#getTimezoneOffset — minutes to SUBTRACT from UTC
 * to get local time) so its getUTC*() accessors read as local wall-clock
 * values. The server itself runs in UTC and has no notion of the user's
 * timezone otherwise.
 */
export function toLocalTime(utcNow: Date, tzOffsetMinutes: number): Date {
  return new Date(utcNow.getTime() - tzOffsetMinutes * 60000);
}

/**
 * Shared by widget-status.ts (a plain status GET) and telegram-webhook.ts's
 * /toggle handler (which returns this directly in its response so the
 * Scriptable widget gets fresh data in the same round trip as the toggle,
 * instead of a second separate GET).
 */
export async function computeWidgetStatus(
  planRef: DocumentReference,
  activeTimer: ActiveTimerState,
  settings: AlignerSettings | undefined,
  tzOffsetMinutes: number
): Promise<WidgetStatusPayload> {
  const now = new Date();
  const localNow = toLocalTime(now, tzOffsetMinutes);
  const todayStr = localNow.toISOString().slice(0, 10);

  const todaysLogsSnap = await planRef.collection('wearLogs').where('date', '==', todayStr).get();
  let outMinutesToday = 0;
  todaysLogsSnap.forEach((d) => {
    outMinutesToday += d.data().durationMinutes || 0;
  });

  const isOut = activeTimer.wearStatus === 'out' && !!activeTimer.startTime;
  if (isOut) {
    const activeMs = now.getTime() - new Date(activeTimer.startTime as string).getTime();
    outMinutesToday += Math.max(0, Math.round(activeMs / 60000));
  }

  const goalSeconds = (settings?.dailyTargetHours ?? 22) * 3600;
  const trackedWindowMinutes = getAvailableMinutesToday(settings, todayStr, localNow);
  const wornMinutesToday = Math.max(0, trackedWindowMinutes - outMinutesToday);
  const wornSeconds = wornMinutesToday * 60;

  return {
    wearStatus: activeTimer.wearStatus,
    startTime: activeTimer.startTime ?? null,
    reason: activeTimer.reason ?? null,
    wornSeconds,
    goalSeconds,
    outMinutesToday,
  };
}
