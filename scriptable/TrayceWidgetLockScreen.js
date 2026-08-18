// Variables used by Scriptable.
// icon-color: teal; icon-glyph: clock;
//
// ── Setup ────────────────────────────────────────────────────────────────
// 1. Install Scriptable from the App Store (scriptable.app) if you haven't.
// 2. Create a new script in Scriptable, name it "TrayceWidgetLockScreen",
//    and paste this whole file in.
// 3. Fill in the two CONFIG values below (same values as your other Trayce
//    widget scripts, if you already set one up):
//      - chatId: your Telegram chat id (same one your /link CODE used).
//      - widgetSecret: the SAME secret you already put in your /out, /in,
//        or /toggle Shortcut's headers (TELEGRAM_WEBHOOK_SECRET in Vercel).
// 4. Long-press the Lock Screen -> Customize -> Lock Screen -> tap a
//    widget slot -> Scriptable -> pick a style (Rectangular is the "20h
//    19m / In since 19:12" one) -> set "Script" to TrayceWidgetLockScreen.
// 5. Lock Screen widgets are rendered by iOS itself in a monochrome
//    vibrancy style - plain white text/symbols only, no custom colors,
//    gradients, or images. That's a platform constraint, not a design
//    choice: don't add drawn graphics here, they won't render.
// 6. Tapping it posts a synthetic "/toggle" straight to the bot's webhook,
//    same as the Home Screen widgets - Scriptable briefly opens to run
//    the script (unavoidable for a "Run Script" widget), but no other app
//    is involved.
// ────────────────────────────────────────────────────────────────────────

// If a loader script (TrayceWidgetLockScreen-Loader.js) already defined
// globalThis.TRAYCE_CONFIG with real values before fetching and running
// this file, use that instead - keeps real secrets out of this file
// entirely, since this exact file lives in a PUBLIC GitHub repo.
const CONFIG = (typeof TRAYCE_CONFIG !== "undefined" && TRAYCE_CONFIG) || {
  apiBase: "https://align-track-rho.vercel.app",
  chatId: "REPLACE_WITH_YOUR_TELEGRAM_CHAT_ID",
  widgetSecret: "REPLACE_WITH_YOUR_SHORTCUTS_SECRET", // same value as your /out, /in, /toggle Shortcuts
};

function formatHm(totalSeconds) {
  const totalMinutes = Math.max(0, Math.round(totalSeconds / 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Device-local clock time (Scriptable runs on-device, so Date's own
// local-time getters are already correct - no tzOffsetMinutes math needed
// here, unlike the server side).
function formatClockTime(iso) {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

async function fetchStatus() {
  const tzOffsetMinutes = new Date().getTimezoneOffset();
  const url = `${CONFIG.apiBase}/api/widget-status?chatId=${encodeURIComponent(CONFIG.chatId)}&tzOffsetMinutes=${tzOffsetMinutes}`;
  const req = new Request(url);
  req.headers = { "x-widget-secret": CONFIG.widgetSecret };
  req.timeoutInterval = 10;
  const json = await req.loadJSON();
  if (req.response && req.response.statusCode >= 400) {
    throw new Error(json.error || `HTTP ${req.response.statusCode}`);
  }
  return json;
}

async function performToggle() {
  const tzOffsetMinutes = new Date().getTimezoneOffset();
  const url = `${CONFIG.apiBase}/api/telegram-webhook?tzOffsetMinutes=${tzOffsetMinutes}`;
  const req = new Request(url);
  req.method = "POST";
  req.headers = {
    "Content-Type": "application/json",
    "x-telegram-bot-api-secret-token": CONFIG.widgetSecret,
  };
  req.body = JSON.stringify({
    message: { chat: { id: Number(CONFIG.chatId) }, text: "/toggle" },
  });
  req.timeoutInterval = 10;
  const json = await req.loadJSON();
  if (req.response && req.response.statusCode >= 400) {
    throw new Error((json && json.error) || `Toggle failed: HTTP ${req.response.statusCode}`);
  }
  return json;
}

// "20h 19m" / "In since 19:12" (or "Out since HH:MM") - the reference
// design. No backgroundColor/gradient/images: iOS ignores or rejects them
// in this context, so keeping the widget itself plain-text-only is what
// makes it render correctly rather than falling back to a broken state.
function buildRectangularWidget(status) {
  const widget = new ListWidget();
  const isOut = status.wearStatus === "out" && !!status.startTime;

  const bigNumber = widget.addText(formatHm(status.wornSeconds));
  bigNumber.font = Font.boldSystemFont(20);
  bigNumber.textColor = Color.white();

  widget.addSpacer(2);

  const stateText = status.sinceIso
    ? `${isOut ? "Out" : "In"} since ${formatClockTime(status.sinceIso)}`
    : isOut
    ? "Out"
    : "In";
  const stateLabel = widget.addText(stateText);
  stateLabel.font = Font.systemFont(13);
  stateLabel.textColor = Color.white();

  widget.refreshAfterDate = new Date(Date.now() + (isOut ? 5 : 20) * 60 * 1000);
  return widget;
}

function buildCircularWidget(status) {
  const widget = new ListWidget();
  widget.setPadding(2, 2, 2, 2);
  const isOut = status.wearStatus === "out" && !!status.startTime;
  const totalMinutes = Math.max(0, Math.round(status.wornSeconds / 60));

  const hLine = widget.addText(`${Math.floor(totalMinutes / 60)}h`);
  hLine.font = Font.boldSystemFont(15);
  hLine.textColor = Color.white();
  hLine.centerAlignText();

  const mLine = widget.addText(`${totalMinutes % 60}m`);
  mLine.font = Font.systemFont(11);
  mLine.textColor = Color.white();
  mLine.centerAlignText();

  widget.refreshAfterDate = new Date(Date.now() + (isOut ? 5 : 20) * 60 * 1000);
  return widget;
}

function buildInlineWidget(status) {
  const widget = new ListWidget();
  const isOut = status.wearStatus === "out" && !!status.startTime;
  const line = widget.addText(`🦷 ${formatHm(status.wornSeconds)} · ${isOut ? "Out" : "In"}`);
  line.textColor = Color.white();
  widget.refreshAfterDate = new Date(Date.now() + (isOut ? 5 : 20) * 60 * 1000);
  return widget;
}

function buildWidget(status) {
  if (config.widgetFamily === "accessoryCircular") return buildCircularWidget(status);
  if (config.widgetFamily === "accessoryInline") return buildInlineWidget(status);
  // Rectangular is both the explicit match and the default fallback -
  // this script is Lock-Screen-only, so any unrecognized family here is
  // still some Lock Screen slot, and rectangular's plain two-line text
  // fits essentially anywhere without overflowing.
  return buildRectangularWidget(status);
}

function buildErrorWidget(message) {
  const widget = new ListWidget();
  const text = widget.addText(message.length > 40 ? "Trayce error" : `Trayce: ${message}`);
  text.font = Font.systemFont(12);
  text.textColor = Color.white();
  widget.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);
  return widget;
}

async function run() {
  // config.runsInWidget is only true for the OS's own background timeline
  // refresh - that path just displays the latest status. Any other run (a
  // Lock Screen tap with "Run Script", or a manual ▶️ in the editor) means
  // the user wants to toggle; performToggle() returns the freshly-toggled
  // status directly (one round trip), so the redraw doesn't need a second
  // separate status fetch.
  let widget;
  try {
    const status = config.runsInWidget ? await fetchStatus() : await performToggle();
    widget = buildWidget(status);
  } catch (err) {
    widget = buildErrorWidget(err.message || String(err));
  }

  Script.setWidget(widget);
  // A tap ("Run Script") briefly opens Scriptable to execute this file -
  // App.close() collapses it back immediately once the toggle/redraw is
  // done, instead of leaving the app sitting open until the user backs
  // out manually.
  if (!config.runsInWidget) {
    App.close();
  }
  Script.complete();
}

await run();
