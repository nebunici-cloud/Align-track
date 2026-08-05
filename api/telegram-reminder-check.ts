import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from './_lib/firebaseAdmin.js';
import { sendMessage, formatElapsed } from './_lib/telegram.js';
import type { ActiveTimerState } from '../src/services/firebaseService';

const REMINDER_START_MS = 30 * 60 * 1000;
const REMINDER_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Polled by a GitHub Actions scheduled workflow every 15 minutes (see
 * .github/workflows/telegram-reminders.yml) — Vercel itself has no
 * always-on process to drive this from, and its own Cron Jobs are capped at
 * once/day on the Hobby plan. Sends a nudge for any linked account whose
 * aligners have been out 30+ minutes, then every 15 minutes after that,
 * until they're back in or /silent is sent. Self-corrects for imprecise
 * cron timing since it's driven by actual elapsed time, not a tick count.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = req.headers['x-reminder-secret'];
  if (!process.env.REMINDER_CHECK_SECRET || secret !== process.env.REMINDER_CHECK_SECRET) {
    res.status(401).send('Unauthorized');
    return;
  }

  const db = getAdminDb();
  let checked = 0;
  let remindersSent = 0;

  try {
    const linksSnap = await db.collection('telegramLinks').get();

    for (const linkDoc of linksSnap.docs) {
      checked += 1;
      try {
        const chatId = Number(linkDoc.id);
        const { uid, accountId } = linkDoc.data() as { uid: string; accountId: string };

        const planRef = db.collection('users').doc(uid).collection('plans').doc(accountId);
        const metaRef = planRef.collection('meta').doc('main');
        const metaSnap = await metaRef.get();
        const activeTimer: ActiveTimerState | undefined = metaSnap.data()?.activeTimer;

        if (!activeTimer || activeTimer.wearStatus !== 'out' || !activeTimer.startTime || activeTimer.remindersMuted) {
          continue;
        }

        const elapsedMs = Date.now() - new Date(activeTimer.startTime).getTime();
        if (elapsedMs < REMINDER_START_MS) continue;

        const msSinceLastReminder = activeTimer.lastReminderSentAt
          ? Date.now() - new Date(activeTimer.lastReminderSentAt).getTime()
          : Infinity;
        if (msSinceLastReminder < REMINDER_INTERVAL_MS) continue;

        const reasonSuffix = activeTimer.reason ? ` (${activeTimer.reason.replace('_', ' ')})` : '';
        await sendMessage(
          chatId,
          `⏰ Aligners have been OUT for ${formatElapsed(elapsedMs)}${reasonSuffix}. Send /in when they're back, or /silent to stop these reminders.`
        );
        await metaRef.update({
          'activeTimer.lastReminderSentAt': new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        remindersSent += 1;
      } catch (err) {
        console.error(`Reminder check failed for link ${linkDoc.id}:`, err);
      }
    }

    res.status(200).json({ checked, remindersSent });
  } catch (err) {
    console.error('Reminder check batch failed:', err);
    res.status(500).json({ checked, remindersSent, error: String(err) });
  }
}
