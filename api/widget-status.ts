import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from './_lib/firebaseAdmin.js';
import { computeWidgetStatus } from './_lib/widgetStatus.js';
import type { ActiveTimerState } from '../src/services/firebaseService';
import type { AlignerSettings } from '../src/types';

/**
 * Read-only JSON status for the Scriptable Home Screen widget's background
 * refresh. Unlike the Telegram webhook, this needs to return structured
 * data to an arbitrary HTTP caller rather than reply via sendMessage.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Every response below must be JSON, including error paths: the caller
  // (Scriptable's req.loadJSON()) fails with an opaque "not in the correct
  // format" error if it ever receives a plain-text body.
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Reuses TELEGRAM_WEBHOOK_SECRET rather than a separate secret: it's
  // already embedded in the on-device Shortcuts, so a read-only status
  // endpoint sharing it doesn't widen exposure beyond what those already have.
  const secret = req.headers['x-widget-secret'];
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const chatIdParam = req.query.chatId;
  const chatId = Array.isArray(chatIdParam) ? chatIdParam[0] : chatIdParam;
  if (!chatId) {
    res.status(400).json({ error: 'Missing chatId query param' });
    return;
  }

  // Matches JS's Date#getTimezoneOffset() sign convention (e.g. -180 for
  // UTC+3) - the Scriptable widget sends its device's actual value. Falls
  // back to 0 (UTC) for any caller that doesn't pass it.
  const tzOffsetParam = req.query.tzOffsetMinutes;
  const tzOffsetRaw = Array.isArray(tzOffsetParam) ? tzOffsetParam[0] : tzOffsetParam;
  const tzOffsetMinutes = tzOffsetRaw !== undefined ? parseInt(tzOffsetRaw, 10) || 0 : 0;

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
    const settings: AlignerSettings | undefined = meta.settings;
    const activeTimer: ActiveTimerState = meta.activeTimer || {
      wearStatus: 'in',
      startTime: null,
      reason: null,
      presetTimerMinutes: null,
    };

    const payload = await computeWidgetStatus(planRef, activeTimer, settings, tzOffsetMinutes);
    res.status(200).json(payload);
  } catch (err) {
    console.error('widget-status error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
