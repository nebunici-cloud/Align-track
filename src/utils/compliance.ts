/**
 * The daily out-time budget model, shared by the web app's home screen and
 * the widget backend (api/_lib/widgetStatus.ts) so both speak the same
 * language rather than each inventing its own notion of "doing well today".
 *
 * The framing is deliberately inverted from "hours worn so far": a wear
 * goal of 22h/day is really a budget of 2h out per day, and the remaining
 * budget is the number that actually changes what someone does at lunch.
 * Hours-worn only becomes decision-relevant late at night, once it's too
 * late to act on.
 */

export type ComplianceBand = 'onTrack' | 'atRisk' | 'missed' | 'none';

/** Below this much remaining budget, the day is one long meal from failing. */
export const AT_RISK_THRESHOLD_MINUTES = 30;

/** A 22h/day wear goal means 2h of out-time is allowed. */
export function getAllowedOutMinutes(dailyTargetHours: number): number {
  return Math.max(0, Math.round((24 - dailyTargetHours) * 60));
}

export function computeBand(outMinutes: number, allowedOutMinutes: number): ComplianceBand {
  const outRemaining = allowedOutMinutes - outMinutes;
  if (outRemaining > AT_RISK_THRESHOLD_MINUTES) return 'onTrack';
  if (outRemaining > 0) return 'atRisk';
  return 'missed';
}
