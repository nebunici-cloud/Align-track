// Variables used by Scriptable.
// icon-color: teal; icon-glyph: circle-notch;
//
// ── Setup ────────────────────────────────────────────────────────────────
// 1. Install Scriptable from the App Store (scriptable.app).
// 2. Create a new script in Scriptable, name it "TrayceWidget", and paste
//    this whole file in.
// 3. Fill in the three CONFIG values below:
//      - chatId: your Telegram chat id (same one your /link CODE used).
//      - widgetSecret: the SAME secret you already put in your /out, /in,
//        or /toggle Shortcut's headers (TELEGRAM_WEBHOOK_SECRET in Vercel) -
//        this endpoint reuses it instead of needing its own.
//      - toggleShortcutName: the exact name of the Shortcut you already
//        built that sends /toggle to the bot.
// 4. Long-press the Home Screen -> + -> Scriptable -> pick the small
//    widget size -> add it -> long-press the widget -> Edit Widget ->
//    set "Script" to TrayceWidget.
// 5. Tapping the widget runs your existing /toggle Shortcut directly
//    (via the shortcuts:// URL scheme) instead of opening Scriptable or
//    the app, so the on/off switch you already built stays the single
//    source of truth for toggling.
// ────────────────────────────────────────────────────────────────────────

const CONFIG = {
  apiBase: "https://align-track-rho.vercel.app",
  chatId: "REPLACE_WITH_YOUR_TELEGRAM_CHAT_ID",
  widgetSecret: "REPLACE_WITH_YOUR_SHORTCUTS_SECRET", // same value as your /out, /in, /toggle Shortcuts
  toggleShortcutName: "Toggle Aligners",
};

const COLORS = {
  surfaceCard: Color.dynamic(new Color("#ffffff"), new Color("#102a41")),
  borderSubtle: Color.dynamic(new Color("#c9ddda"), new Color("#27506a")),
  textPrimary: Color.dynamic(new Color("#092337"), new Color("#f5f7f8")),
  textSecondary: Color.dynamic(new Color("#617a89"), new Color("#91a8ba")),
  brandTeal: Color.dynamic(new Color("#13aa9e"), new Color("#18bcae")),
  brandMint: Color.dynamic(new Color("#69d2c4"), new Color("#80ddd0")),
  accentSand: Color.dynamic(new Color("#d99b35"), new Color("#f1bc5b")),
  stateInactive: Color.dynamic(new Color("#d5e2e2"), new Color("#38536a")),
};

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function lerpColor(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return new Color(`#${[r, g, bl].map((c) => c.toString(16).padStart(2, "0")).join("")}`);
}

function formatHm(totalSeconds) {
  const totalMinutes = Math.max(0, Math.round(totalSeconds / 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatElapsedSince(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  return formatHm(ms / 1000);
}

async function fetchStatus() {
  const url = `${CONFIG.apiBase}/api/widget-status?chatId=${encodeURIComponent(CONFIG.chatId)}`;
  const req = new Request(url);
  req.headers = { "x-widget-secret": CONFIG.widgetSecret };
  req.timeoutInterval = 10;
  const json = await req.loadJSON();
  if (req.response && req.response.statusCode >= 400) {
    throw new Error(json.error || `HTTP ${req.response.statusCode}`);
  }
  return json;
}

// Draws the progress ring AND the centered "20h 19m" label into one bitmap,
// since ListWidget stacks can't overlay text on top of an image directly.
// Scriptable's DrawContext has no native "stroke an arc" primitive, so the
// filled portion is built from many short straight segments walked around
// the circle — dense enough at this size to read as a smooth ring — each
// colored by interpolating brandTeal -> brandMint for a soft gradient feel.
function drawRing(size, progress, centerLabel) {
  const ctx = new DrawContext();
  ctx.size = new Size(size, size);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  const lineWidth = size * 0.09;
  const radius = size / 2 - lineWidth / 2;
  const cx = size / 2;
  const cy = size / 2;

  const track = new Path();
  track.addEllipse(new Rect(lineWidth / 2, lineWidth / 2, size - lineWidth, size - lineWidth));
  ctx.addPath(track);
  ctx.setStrokeColor(COLORS.stateInactive);
  ctx.setLineWidth(lineWidth);
  ctx.strokePath();

  const totalSegments = 120;
  const clamped = Math.max(0, Math.min(1, progress));
  const filledSegments = Math.round(totalSegments * clamped);
  const startAngle = -Math.PI / 2;

  const tealHex = "#13aa9e";
  const mintHex = "#69d2c4";

  for (let i = 0; i < filledSegments; i++) {
    const a1 = startAngle + (i / totalSegments) * 2 * Math.PI;
    const a2 = startAngle + ((i + 1) / totalSegments) * 2 * Math.PI;
    const p1 = new Point(cx + radius * Math.cos(a1), cy + radius * Math.sin(a1));
    const p2 = new Point(cx + radius * Math.cos(a2), cy + radius * Math.sin(a2));
    const seg = new Path();
    seg.move(p1);
    seg.addLine(p2);
    ctx.addPath(seg);
    ctx.setStrokeColor(lerpColor(tealHex, mintHex, i / totalSegments));
    ctx.setLineWidth(lineWidth);
    ctx.strokePath();
  }

  ctx.setTextAlignedCenter();
  ctx.setTextColor(COLORS.textPrimary);
  ctx.setFont(Font.boldSystemFont(size * 0.135));
  const labelHeight = size * 0.2;
  ctx.drawTextInRect(centerLabel, new Rect(0, cy - labelHeight / 2, size, labelHeight));

  return ctx.getImage();
}

function buildWidget(status) {
  const widget = new ListWidget();
  widget.backgroundColor = COLORS.surfaceCard;
  widget.setPadding(14, 14, 14, 14);
  widget.url = `shortcuts://run-shortcut?name=${encodeURIComponent(CONFIG.toggleShortcutName)}`;

  const wordmark = widget.addText("trayce");
  wordmark.font = Font.boldSystemFont(14);
  wordmark.textColor = COLORS.brandTeal;

  widget.addSpacer(6);

  const isOut = status.wearStatus === "out" && !!status.startTime;
  const progress = status.goalSeconds > 0 ? status.wornSeconds / status.goalSeconds : 0;
  const ringLabel = formatHm(status.wornSeconds);
  const ringSize = 118;
  // respectScreenScale in drawRing() renders at the device's native pixel
  // density, so passing the point size directly is already retina-sharp.
  const ringImage = drawRing(ringSize, progress, ringLabel);

  const ringRow = widget.addStack();
  ringRow.addSpacer();
  const ringElement = ringRow.addImage(ringImage);
  ringElement.imageSize = new Size(ringSize, ringSize);
  ringRow.addSpacer();

  widget.addSpacer(10);

  const statusRow = widget.addStack();
  statusRow.centerAlignContent();
  statusRow.addSpacer();
  const dot = statusRow.addText(isOut ? "🟠" : "🟢");
  dot.font = Font.systemFont(12);
  statusRow.addSpacer(5);
  const statusText = statusRow.addText(
    isOut ? `Aligners out · ${formatElapsedSince(status.startTime)}` : "Aligners in"
  );
  statusText.font = Font.mediumSystemFont(13);
  statusText.textColor = COLORS.textSecondary;
  statusRow.addSpacer();

  widget.addSpacer(12);

  const pillRow = widget.addStack();
  pillRow.addSpacer();
  const pill = pillRow.addStack();
  pill.backgroundColor = isOut ? COLORS.brandTeal : COLORS.accentSand;
  pill.cornerRadius = 16;
  pill.setPadding(8, 16, 8, 16);
  const pillText = pill.addText(isOut ? "↺ Put aligners in" : "🦷 Take aligners out");
  pillText.font = Font.semiboldSystemFont(12);
  pillText.textColor = new Color("#ffffff");
  pillRow.addSpacer();

  widget.refreshAfterDate = new Date(Date.now() + (isOut ? 5 : 20) * 60 * 1000);

  return widget;
}

function buildErrorWidget(message) {
  const widget = new ListWidget();
  widget.backgroundColor = COLORS.surfaceCard;
  widget.setPadding(14, 14, 14, 14);
  const title = widget.addText("trayce");
  title.font = Font.boldSystemFont(14);
  title.textColor = COLORS.brandTeal;
  widget.addSpacer(8);
  const body = widget.addText(`Widget error: ${message}`);
  body.font = Font.systemFont(12);
  body.textColor = COLORS.textSecondary;
  widget.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);
  return widget;
}

async function run() {
  let widget;
  try {
    const status = await fetchStatus();
    widget = buildWidget(status);
  } catch (err) {
    widget = buildErrorWidget(err.message || String(err));
  }

  if (config.runsInWidget) {
    Script.setWidget(widget);
  } else {
    await widget.presentSmall();
  }
  Script.complete();
}

await run();
