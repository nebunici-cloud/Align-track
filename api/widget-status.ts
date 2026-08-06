import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from './_lib/firebaseAdmin.js';
import type { ActiveTimerState } from '../src/services/firebaseService';
import type { AlignerSettings } from '../src/types';

/**
 * Minutes available for wear-tracking today, mirroring
 * src/utils/storage.ts#getAvailableMinutesForDate but using the server's
 * UTC clock (there's no user-local timezone available here) — consistent
 * with the rest of the bot, which already buckets "today" by UTC date.
 */
function getAvailableMinutesToday(settings: AlignerSettings, todayStr: string, now: Date): number {
  const planStartStr = settings.planStartDate || (settings.trayStartDate ? settings.trayStartDate.slice(0, 10) : todayStr);
  if (todayStr < planStartStr) return 0;

  let startWindowMin = 0;
  if (todayStr === planStartStr && settings.planStartTime) {
    const [h, m] = settings.planStartTime.split(':').map((n) => parseInt(n, 10) || 0);
    startWindowMin = h * 60 + m;
  }

  const endWindowMin = Math.min(1440, Math.max(1, now.getUTCHours() * 60 + now.getUTCMinutes()));
  return Math.max(0, endWindowMin - startWindowMin);
}

/**
 * Read-only JSON status for the Scriptable Home Screen widget. Unlike the
 * Telegram webhook, this needs to return structured data to an arbitrary
 * HTTP caller rather than reply via sendMessage.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).send('Method not allowed');
    return;
  }

  // Reuses TELEGRAM_WEBHOOK_SECRET rather than a separate secret: it's
  // already embedded in the on-device Shortcuts, so a read-only status
  // endpoint sharing it doesn't widen exposure beyond what those already have.
  const secret = req.headers['x-widget-secret'];
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    res.status(401).send('Unauthorized');
    return;
  }

  const chatIdParam = req.query.chatId;
  const chatId = Array.isArray(chatIdParam) ? chatIdParam[0] : chatIdParam;
  if (!chatId) {
    res.status(400).json({ error: 'Missing chatId query param' });
    return;
  }

  try {
    const db = getAdminDb();
    const linkSnap = await db.collection('telegramLinks').doc(String(chatId)).get();
    if (!linkSnap.exists) {
      res.status(404).json({ error: 'This chat is not linked to an AlignerTrack account' });
      return;
    }
    const { uid, accountId } = linkSnap.data() as { uid: string; accountId: string };

    const planRef = db.collection('users').doc(uid).collection('plans').doc(accountId);
    const metaRef = planRef.collection('meta').doc('main');
    const metaSnap = await metaRef.get();
    const meta = metaSnap.data() || {};
    const settings: AlignerSettings = meta.settings;
    const activeTimer: ActiveTimerState = meta.activeTimer || {
      wearStatus: 'in',
      startTime: null,
      reason: null,
      presetTimerMinutes: null,
    };

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

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
    const trackedWindowMinutes = getAvailableMinutesToday(settings, todayStr, now);
    const wornMinutesToday = Math.max(0, trackedWindowMinutes - outMinutesToday);
    const wornSeconds = wornMinutesToday * 60;

    res.status(200).json({
      wearStatus: activeTimer.wearStatus,
      startTime: activeTimer.startTime ?? null,
      reason: activeTimer.reason ?? null,
      wornSeconds,
      goalSeconds,
      outMinutesToday,
    });
  } catch (err) {
    console.error('widget-status error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
