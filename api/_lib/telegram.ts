const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function sendMessage(chatId: number, text: string): Promise<void> {
  if (!BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not set — cannot send a reply');
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`Telegram sendMessage rejected: ${res.status} ${body}`);
    }
  } catch (err) {
    console.error('Telegram sendMessage threw:', err);
  }
}

export function formatElapsed(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
