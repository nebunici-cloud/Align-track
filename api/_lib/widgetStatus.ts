import type { DocumentReference } from 'firebase-admin/firestore';
import type { ActiveTimerState } from '../../src/services/firebaseService';
import type { AlignerSettings } from '../../src/types';

export type RhythmSegmentState = 'worn' | 'out' | 'future';
export type ComplianceBand = 'onTrack' | 'atRisk' | 'missed' | 'none';

export interface WidgetStatusPayload {
  wearStatus: ActiveTimerState['wearStatus'];
  startTime: string | null;
  reason: string | null;
  wornSeconds: number;
  goalSeconds: number;
  outMinutesToday: number;
  segments: RhythmSegmentState[];
  /**
   * When the current state began: the active out-session's start while
   * out, or the most recent today's-log endTime (when the last out-session
   * ended) while in - mirrors HomeView.tsx's stateSinceLabel. Null if
   * there's nothing today to anchor it to (e.g. still "in" with no
   * completed out-session yet today).
   */
  sinceIso: string | null;
  currentTray: number;
  totalTrays: number;
  /** Clamped to trayDurationDays, mirroring HomeView.tsx's trayDayNumber. */
  trayDayNumber: number;
  trayDurationDays: number;
  /**
   * Today's raw out-intervals (endIso null = still ongoing), for a
   * minute-accurate continuous timeline rather than 24 hourly buckets.
   * Client converts to local minutes-of-day itself (same as
   * formatClockTime already does) since the device's own Date getters are
   * timezone-correct there for free, unlike on the server.
   */
  intervals: { startIso: string; endIso: string | null }[];
  /** outRemaining = allowedOutMinutes - outMinutesToday; see computeBand. */
  allowedOutMinutes: number;
  /** Oldest first, ending with today. */
  last7Days: { dateStr: string; band: ComplianceBand }[];
}

/**
 * onTrack / atRisk / missed thresholds, shared between today's live band
 * and each day in the 7-day history row so they mean the same thing
 * everywhere.
 */
export function computeBand(outMinutes: number, allowedOutMinutes: number): ComplianceBand {
  const outRemaining = allowedOutMinutes - outMinutes;
  if (outRemaining > 30) return 'onTrack';
  if (outRemaining > 0) return 'atRisk';
  return 'missed';
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

/** Mirrors src/types.ts#getTrayDuration. */
function getTrayDuration(settings: AlignerSettings | undefined, trayNumber: number): number {
  if (settings?.customTrayDurations && settings.customTrayDurations[trayNumber] !== undefined) {
    return settings.customTrayDurations[trayNumber];
  }
  return settings?.trayDurationDays || 7;
}

/**
 * Mirrors src/utils/storage.ts#getDayNumberSince, using the caller's local
 * "today" (already computed via toLocalTime upstream) instead of the
 * browser's own local Date.
 *
 * trayStartDate is a UTC ISO timestamp - slicing its first 10 characters
 * directly (as an earlier version of this did) reads the UTC calendar
 * date, not the local one. If the tray was started late in the evening
 * local time, UTC has already rolled to the next day (or hasn't yet
 * rolled from the previous one for negative offsets), throwing the day
 * count off by one - exactly the "app says Day 14, widget says Day 15"
 * bug this fixes. The client's getDayNumberSince avoids this for free
 * since `new Date(startDateInput)` + local getters are already
 * timezone-correct in a browser; the server has no such luxury and must
 * shift to local time explicitly first, same as every other timestamp
 * this file handles.
 */
function getTrayDayNumberSince(trayStartDate: string, todayStr: string, tzOffsetMinutes: number): number {
  const startDateStr = toLocalTime(new Date(trayStartDate), tzOffsetMinutes).toISOString().slice(0, 10);
  const startMidnight = new Date(`${startDateStr}T00:00:00`).getTime();
  const todayMidnight = new Date(`${todayStr}T00:00:00`).getTime();
  const daysElapsed = Math.round((todayMidnight - startMidnight) / 86400000);
  return Math.max(1, daysElapsed + 1);
}

/**
 * 24 hourly worn/out/future segments, mirroring
 * HomeView.tsx#rhythmSegments exactly (same hour-overlap logic), just
 * computed server-side from Firestore-shaped log data instead of React
 * state, and using local hours derived from the caller's tzOffsetMinutes.
 */
function computeRhythmSegments(
  todaysLogs: { type?: string; startTime?: string; endTime?: string }[],
  activeTimer: ActiveTimerState,
  tzOffsetMinutes: number,
  currentHour: number
): RhythmSegmentState[] {
  const localHour = (iso: string) => toLocalTime(new Date(iso), tzOffsetMinutes).getUTCHours();

  const outRanges: [number, number][] = [];
  todaysLogs.forEach((log) => {
    if (log.type === 'out' && log.startTime) {
      const startH = localHour(log.startTime);
      const endH = log.endTime ? localHour(log.endTime) : currentHour;
      outRanges.push([startH, endH]);
    }
  });
  if (activeTimer.wearStatus === 'out' && activeTimer.startTime) {
    outRanges.push([localHour(activeTimer.startTime), currentHour]);
  }

  return Array.from({ length: 24 }, (_, h) => {
    if (h > currentHour) return 'future';
    const wasOut = outRanges.some(([s, e]) => h >= s && h <= e);
    return wasOut ? 'out' : 'worn';
  });
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
  const todaysLogs: { type?: string; startTime?: string; endTime?: string }[] = [];
  todaysLogsSnap.forEach((d) => {
    const data = d.data();
    outMinutesToday += data.durationMinutes || 0;
    todaysLogs.push({ type: data.type, startTime: data.startTime, endTime: data.endTime });
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

  const segments = computeRhythmSegments(todaysLogs, activeTimer, tzOffsetMinutes, localNow.getUTCHours());

  let sinceIso: string | null = null;
  if (isOut) {
    sinceIso = activeTimer.startTime ?? null;
  } else {
    for (const log of todaysLogs) {
      if (!log.endTime) continue;
      if (!sinceIso || new Date(log.endTime).getTime() > new Date(sinceIso).getTime()) {
        sinceIso = log.endTime;
      }
    }
  }

  const currentTray = settings?.currentTray ?? 1;
  const totalTrays = settings?.totalTrays ?? 1;
  const trayDurationDays = getTrayDuration(settings, currentTray);
  const trayDayNumber = settings?.trayStartDate
    ? Math.min(trayDurationDays, getTrayDayNumberSince(settings.trayStartDate, todayStr, tzOffsetMinutes))
    : 1;

  const intervals: { startIso: string; endIso: string | null }[] = todaysLogs
    .filter((log) => log.type === 'out' && log.startTime)
    .map((log) => ({ startIso: log.startTime as string, endIso: log.endTime ?? null }));
  if (isOut && activeTimer.startTime) {
    intervals.push({ startIso: activeTimer.startTime, endIso: null });
  }

  const dailyTargetHours = settings?.dailyTargetHours ?? 22;
  const allowedOutMinutes = (24 - dailyTargetHours) * 60;

  const last7Days = await computeLast7DaysCompliance(planRef, settings, todayStr, allowedOutMinutes, outMinutesToday);

  return {
    wearStatus: activeTimer.wearStatus,
    startTime: activeTimer.startTime ?? null,
    reason: activeTimer.reason ?? null,
    wornSeconds,
    goalSeconds,
    outMinutesToday,
    segments,
    sinceIso,
    currentTray,
    totalTrays,
    trayDayNumber,
    trayDurationDays,
    intervals,
    allowedOutMinutes,
    last7Days,
  };
}

/**
 * Per-day compliance band for the last 7 calendar days (today inclusive),
 * for the Large widget's seven-day row. A single range query on `date`
 * covers all 7 days; today's bucket uses the already-computed
 * outMinutesToday (which includes the live in-progress session) rather
 * than re-deriving it from completed log documents only. Days before the
 * user's plan started are 'none' rather than a misleadingly-perfect
 * onTrack.
 */
async function computeLast7DaysCompliance(
  planRef: DocumentReference,
  settings: AlignerSettings | undefined,
  todayStr: string,
  allowedOutMinutes: number,
  outMinutesToday: number
): Promise<{ dateStr: string; band: ComplianceBand }[]> {
  const todayMidnight = new Date(`${todayStr}T00:00:00`).getTime();
  const dateStrs: string[] = [];
  for (let i = 6; i >= 0; i--) {
    dateStrs.push(new Date(todayMidnight - i * 86400000).toISOString().slice(0, 10));
  }
  const earliestStr = dateStrs[0];

  const planStartStr = settings?.planStartDate || (settings?.trayStartDate ? settings.trayStartDate.slice(0, 10) : todayStr);

  const outMinutesByDate: Record<string, number> = {};
  if (earliestStr < todayStr) {
    const rangeSnap = await planRef
      .collection('wearLogs')
      .where('date', '>=', earliestStr)
      .where('date', '<', todayStr)
      .get();
    rangeSnap.forEach((d) => {
      const data = d.data();
      const dateStr: string | undefined = data.date;
      if (!dateStr) return;
      outMinutesByDate[dateStr] = (outMinutesByDate[dateStr] || 0) + (data.durationMinutes || 0);
    });
  }
  outMinutesByDate[todayStr] = outMinutesToday;

  return dateStrs.map((dateStr) => {
    if (dateStr < planStartStr) return { dateStr, band: 'none' as ComplianceBand };
    const outMinutes = outMinutesByDate[dateStr] || 0;
    return { dateStr, band: computeBand(outMinutes, allowedOutMinutes) };
  });
}
