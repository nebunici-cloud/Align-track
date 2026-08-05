import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminDb } from './_lib/firebaseAdmin';
import type { OutReason, WearLog } from '../src/types';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const LINK_CODE_TTL_MS = 15 * 60 * 1000;

interface ActiveTimerState {
  wearStatus: 'in' | 'out';
  startTime: string | null;
  reason: OutReason | null;
  presetTimerMinutes: number | null;
  updatedAt?: string;
}

async function sendMessage(chatId: number, text: string): Promise<void> {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  }).catch((err) => console.error('Telegram sendMessage failed:', err));
}

const REASON_KEYWORDS: Record<OutReason, string[]> = {
  breakfast: ['breakfast'],
  lunch: ['lunch'],
  dinner: ['dinner', 'supper'],
  snack: ['snack'],
  coffee_drink: ['coffee', 'drink', 'tea'],
  brushing_cleaning: ['brush', 'clean', 'hygiene', 'teeth'],
  sports: ['sport', 'gym', 'exercise', 'workout'],
  other: [],
};

function parseReason(argsText: string): OutReason | undefined {
  const trimmed = argsText.trim().toLowerCase();
  if (!trimmed) return undefined;
  for (const [reason, keywords] of Object.entries(REASON_KEYWORDS) as [OutReason, string[]][]) {
    if (keywords.some((kw) => trimmed.includes(kw))) return reason;
  }
  return 'other';
}

function formatElapsed(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const HELP_TEXT = `<b>AlignerTrack bot</b>
/out [reason] - take aligners out (reason optional, e.g. "/out lunch")
/in - put aligners back in, logs the session
/status - show current wear status
/link CODE - link this chat to your AlignerTrack account
/help - show this message`;

async function tryLinkCode(db: Firestore, chatId: number, code: string): Promise<void> {
  if (!code) {
    await sendMessage(chatId, 'Send /link followed by the code shown in the app (Settings → Connect Telegram).');
    return;
  }

  const codeRef = db.collection('telegramLinkCodes').doc(code);
  const codeSnap = await codeRef.get();
  if (!codeSnap.exists) {
    await sendMessage(chatId, '❌ That code is invalid or already used. Generate a new one in the app.');
    return;
  }

  const codeData = codeSnap.data() as { uid: string; accountId: string; createdAt: string };
  const age = Date.now() - new Date(codeData.createdAt).getTime();
  await codeRef.delete();

  if (age > LINK_CODE_TTL_MS) {
    await sendMessage(chatId, '❌ That code expired. Generate a new one in the app.');
    return;
  }

  await db.collection('telegramLinks').doc(String(chatId)).set({
    uid: codeData.uid,
    accountId: codeData.accountId,
    linkedAt: new Date().toISOString(),
  });

  await sendMessage(chatId, '✅ Linked! Try /out, /in, or /status.');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const secret = req.headers['x-telegram-bot-api-secret-token'];
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    res.status(401).send('Unauthorized');
    return;
  }

  // Always ack 200 quickly after this point — Telegram retries aggressively
  // on non-2xx responses, and we don't want duplicate command processing.
  try {
    const update = req.body;
    const message = update?.message;
    const chatId: number | undefined = message?.chat?.id;
    const text: string = (message?.text || '').trim();

    if (!chatId || !text.startsWith('/')) {
      res.status(200).send('ok');
      return;
    }

    const [rawCommand, ...rest] = text.split(/\s+/);
    const command = rawCommand.split('@')[0].toLowerCase();
    const argsText = rest.join(' ');

    const db = getAdminDb();

    if (command === '/help') {
      await sendMessage(chatId, HELP_TEXT);
      res.status(200).send('ok');
      return;
    }

    // /start with no args is the default Telegram greeting; /start CODE is
    // what a t.me/<bot>?start=CODE deep link sends, so it doubles as linking.
    if (command === '/start') {
      if (argsText.trim()) {
        await tryLinkCode(db, chatId, argsText.trim());
      } else {
        await sendMessage(chatId, HELP_TEXT);
      }
      res.status(200).send('ok');
      return;
    }

    if (command === '/link') {
      await tryLinkCode(db, chatId, argsText.trim());
      res.status(200).send('ok');
      return;
    }

    // Every other command needs an existing link.
    const linkSnap = await db.collection('telegramLinks').doc(String(chatId)).get();
    if (!linkSnap.exists) {
      await sendMessage(
        chatId,
        "This chat isn't linked yet. Open the app → Settings → Connect Telegram to get a code, then send /link CODE here."
      );
      res.status(200).send('ok');
      return;
    }
    const { uid, accountId } = linkSnap.data() as { uid: string; accountId: string };

    const metaRef = db.collection('users').doc(uid).collection('plans').doc(accountId).collection('meta').doc('main');
    const metaSnap = await metaRef.get();
    const meta = metaSnap.data() || {};
    const activeTimer: ActiveTimerState = meta.activeTimer || {
      wearStatus: 'in',
      startTime: null,
      reason: null,
      presetTimerMinutes: null,
    };

    if (command === '/status') {
      if (activeTimer.wearStatus === 'out' && activeTimer.startTime) {
        const elapsed = formatElapsed(Date.now() - new Date(activeTimer.startTime).getTime());
        await sendMessage(chatId, `🦷 Aligners OUT for ${elapsed}${activeTimer.reason ? ` (${activeTimer.reason})` : ''}.`);
      } else {
        await sendMessage(chatId, '✅ Aligners are IN.');
      }
      res.status(200).send('ok');
      return;
    }

    if (command === '/out') {
      if (activeTimer.wearStatus === 'out' && activeTimer.startTime) {
        const elapsed = formatElapsed(Date.now() - new Date(activeTimer.startTime).getTime());
        await sendMessage(chatId, `Already out for ${elapsed}. Send /in when they're back in.`);
        res.status(200).send('ok');
        return;
      }

      const nowIso = new Date().toISOString();
      const reason = parseReason(argsText);
      const newTimer: ActiveTimerState = {
        wearStatus: 'out',
        startTime: nowIso,
        reason: reason ?? null,
        presetTimerMinutes: null,
        updatedAt: nowIso,
      };
      await metaRef.set({ activeTimer: newTimer, updatedAt: nowIso }, { merge: true });
      await sendMessage(chatId, `🦷 Aligners OUT${reason ? ` for ${reason.replace('_', ' ')}` : ''}. Send /in when they're back.`);
      res.status(200).send('ok');
      return;
    }

    if (command === '/in') {
      if (activeTimer.wearStatus !== 'out' || !activeTimer.startTime) {
        await sendMessage(chatId, 'Aligners are already IN.');
        res.status(200).send('ok');
        return;
      }

      const nowIso = new Date().toISOString();
      const startMs = new Date(activeTimer.startTime).getTime();
      const durationMins = Math.max(1, Math.round((Date.now() - startMs) / 60000));

      const newLog: WearLog = {
        id: `log_${Date.now()}`,
        date: nowIso.slice(0, 10),
        type: 'out',
        startTime: activeTimer.startTime,
        endTime: nowIso,
        durationMinutes: durationMins,
        reason: activeTimer.reason || undefined,
      };
      await db
        .collection('users')
        .doc(uid)
        .collection('plans')
        .doc(accountId)
        .collection('wearLogs')
        .doc(newLog.id)
        .set(JSON.parse(JSON.stringify(newLog)));

      const newTimer: ActiveTimerState = {
        wearStatus: 'in',
        startTime: null,
        reason: null,
        presetTimerMinutes: null,
        updatedAt: nowIso,
      };
      await metaRef.set({ activeTimer: newTimer, updatedAt: nowIso }, { merge: true });

      await sendMessage(chatId, `✅ Aligners back IN! Logged ${durationMins}m out.`);
      res.status(200).send('ok');
      return;
    }

    await sendMessage(chatId, `Unknown command. ${HELP_TEXT}`);
    res.status(200).send('ok');
  } catch (err) {
    console.error('Telegram webhook error:', err);
    // Still 200 so Telegram doesn't hammer retries on a bug we need to fix server-side.
    res.status(200).send('ok');
  }
}
