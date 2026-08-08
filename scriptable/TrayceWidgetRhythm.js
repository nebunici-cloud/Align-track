// Variables used by Scriptable.
// icon-color: teal; icon-glyph: chart-bar;
//
// ── Setup ────────────────────────────────────────────────────────────────
// 1. Install Scriptable from the App Store (scriptable.app) if you haven't.
// 2. Create a new script in Scriptable, name it "TrayceWidgetRhythm", and
//    paste this whole file in.
// 3. Fill in the two CONFIG values below (same values as TrayceWidget.js,
//    if you already set that one up):
//      - chatId: your Telegram chat id (same one your /link CODE used).
//      - widgetSecret: the SAME secret you already put in your /out, /in,
//        or /toggle Shortcut's headers (TELEGRAM_WEBHOOK_SECRET in Vercel).
// 4. Long-press the Home Screen -> + -> Scriptable -> pick the LARGE
//    widget size (this design needs the extra room - Medium/Small will
//    clip it) -> add it -> long-press the widget -> Edit Widget -> set
//    "Script" to TrayceWidgetRhythm.
// 5. Tapping the widget posts a synthetic "/toggle" straight to the bot's
//    webhook, same as TrayceWidget.js - Scriptable briefly opens to run
//    the script (unavoidable for a "Run Script" widget), but no other app
//    is involved.
// ────────────────────────────────────────────────────────────────────────

// If a loader script (TrayceWidgetRhythm-Loader.js) already defined
// globalThis.TRAYCE_CONFIG with real values before fetching and running
// this file, use that instead - keeps real secrets out of this file
// entirely, since this exact file lives in a PUBLIC GitHub repo.
const CONFIG = (typeof TRAYCE_CONFIG !== "undefined" && TRAYCE_CONFIG) || {
  apiBase: "https://align-track-rho.vercel.app",
  chatId: "REPLACE_WITH_YOUR_TELEGRAM_CHAT_ID",
  widgetSecret: "REPLACE_WITH_YOUR_SHORTCUTS_SECRET", // same value as your /out, /in, /toggle Shortcuts
};

// Dark-theme palette only, hardcoded (not Color.dynamic) per design intent -
// this widget always renders the dark card look regardless of system theme.
const COLORS = {
  surfaceCard: new Color("#102a41"),
  textPrimary: new Color("#f5f7f8"),
  textSecondary: new Color("#91a8ba"),
  brandTeal: new Color("#18bcae"),
  accentSand: new Color("#f1bc5b"),
  stateInactive: new Color("#38536a"),
};

const HEX = {
  brandTeal: "#18bcae",
  brandMint: "#80ddd0",
  accentSand: "#f1bc5b",
  accentSandLight: "#f7d38c",
  stateInactive: "#38536a",
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

function applyBrightness(hex, factor) {
  const { r, g, b } = hexToRgb(hex);
  const clamp = (v) => Math.min(255, Math.max(0, Math.round(v * factor)));
  return new Color(`#${[clamp(r), clamp(g), clamp(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`);
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

// 24 rounded bars, one per hour, each brightness-ramped left-to-right -
// mirrors src/components/home/TodaysRhythm.tsx's segment coloring exactly.
// Draws the bars AND the "00:00 / 12:00 / 23:59" axis labels into ONE
// bitmap so they're pixel-locked together regardless of the widget's true
// rendered width - keeping them as separate elements let the axis row's
// spacers stretch to the widget's real (wider-than-guessed) content width
// while the bars image stayed at a fixed guess, so the labels drifted past
// where the bars actually ended.
function drawRhythmBars(width, barsHeight, segments) {
  const labelGap = 4;
  const labelHeight = 14;
  const ctx = new DrawContext();
  ctx.size = new Size(width, barsHeight + labelGap + labelHeight);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  const barCount = segments.length || 24;
  const gap = 3;
  const barWidth = (width - gap * (barCount - 1)) / barCount;
  const cornerRadius = Math.min(3, barWidth / 2);
  const stateHex = { worn: HEX.brandTeal, out: HEX.accentSand, future: HEX.stateInactive };

  segments.forEach((state, i) => {
    // Wider range than the web app's subtle CSS filter (0.82-1.14) - at
    // ~10pt bar width that subtle a ramp barely reads, so this leans
    // harder into it for a visibly graduated look matching the mockup.
    const brightness = 0.62 + 0.65 * (i / (barCount - 1));
    const color = applyBrightness(stateHex[state] || HEX.stateInactive, brightness);
    const x = i * (barWidth + gap);
    const path = new Path();
    path.addRoundedRect(new Rect(x, 0, barWidth, barsHeight), cornerRadius, cornerRadius);
    ctx.addPath(path);
    ctx.setFillColor(color);
    ctx.fillPath();
  });

  const labelY = barsHeight + labelGap;
  ctx.setFont(Font.systemFont(11));
  ctx.setTextColor(COLORS.textSecondary);

  ctx.setTextAlignedLeft();
  ctx.drawTextInRect("00:00", new Rect(0, labelY, 70, labelHeight));

  ctx.setTextAlignedCenter();
  ctx.drawTextInRect("12:00", new Rect(width / 2 - 35, labelY, 70, labelHeight));

  ctx.setTextAlignedRight();
  ctx.drawTextInRect("23:59", new Rect(width - 70, labelY, 70, labelHeight));

  return ctx.getImage();
}

// Capsule button with a horizontal gradient + an icon badge + label, all
// baked into one bitmap. Scriptable's DrawContext has no clip-path
// primitive, so the "gradient" is straight vertical strips in the middle
// with solid-color rounded caps at each end - reads as a capsule gradient
// at this size, though not a mathematically exact one.
function drawPill(width, height, isOut) {
  const ctx = new DrawContext();
  ctx.size = new Size(width, height);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  const radius = height / 2;
  const colorAHex = isOut ? HEX.brandTeal : HEX.accentSand;
  const colorBHex = isOut ? HEX.brandMint : HEX.accentSandLight;

  const leftCap = new Path();
  leftCap.addEllipse(new Rect(0, 0, height, height));
  ctx.addPath(leftCap);
  ctx.setFillColor(new Color(colorAHex));
  ctx.fillPath();

  // Fewer, generously-overlapping strips (later ones painted on top) rather
  // than many hairline-adjacent ones - thin abutting rects left faint
  // antialiased seams that, repeated dozens of times, visibly washed out
  // the gradient. Each strip is explicitly clamped to end at `bodyEnd`: a
  // filled ellipse only paints inside its actual curve, not its full
  // bounding square, so a rect overshooting into the cap's corner zone
  // stayed visible as a jagged notch instead of being covered by the cap.
  const bodyEnd = width - radius;
  const steps = 16;
  const bandWidth = Math.max(0, bodyEnd - radius);
  const stepWidth = bandWidth / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const color = lerpColor(colorAHex, colorBHex, t);
    const x = radius + i * stepWidth;
    const rectWidth = Math.max(0, Math.min(stepWidth * 1.6, bodyEnd - x));
    if (rectWidth <= 0) continue;
    const rectPath = new Path();
    rectPath.addRect(new Rect(x, 0, rectWidth, height));
    ctx.addPath(rectPath);
    ctx.setFillColor(color);
    ctx.fillPath();
  }

  const rightCap = new Path();
  rightCap.addEllipse(new Rect(width - height, 0, height, height));
  ctx.addPath(rightCap);
  ctx.setFillColor(new Color(colorBHex));
  ctx.fillPath();

  const badgeSize = height * 0.62;
  const badgeX = radius - badgeSize / 2;
  const badgeY = (height - badgeSize) / 2;
  const badgePath = new Path();
  badgePath.addEllipse(new Rect(badgeX, badgeY, badgeSize, badgeSize));
  ctx.addPath(badgePath);
  ctx.setFillColor(new Color("#ffffff", 0.28));
  ctx.fillPath();

  ctx.setTextAlignedCenter();
  ctx.setTextColor(new Color("#092337"));
  ctx.setFont(Font.boldSystemFont(badgeSize * 0.62));
  ctx.drawTextInRect(isOut ? "+" : "−", new Rect(badgeX, badgeY - height * 0.02, badgeSize, badgeSize));

  ctx.setFont(Font.boldSystemFont(height * 0.32));
  const labelText = isOut ? "PUT ALIGNERS IN" : "TAKE ALIGNERS OUT";
  ctx.drawTextInRect(labelText, new Rect(height, 0, width - height * 1.4, height));

  return ctx.getImage();
}

function drawAccentRing(size) {
  const ctx = new DrawContext();
  ctx.size = new Size(size, size);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const lineWidth = size * 0.2;
  const path = new Path();
  path.addEllipse(new Rect(lineWidth / 2, lineWidth / 2, size - lineWidth, size - lineWidth));
  ctx.addPath(path);
  ctx.setStrokeColor(COLORS.brandTeal);
  ctx.setLineWidth(lineWidth);
  ctx.strokePath();
  return ctx.getImage();
}

// Scriptable has no API to read the widget's actual rendered width, so this
// maps the device's screen width to Apple's published Large-widget frame
// widths (widget frame width is shared with Medium) and subtracts our own
// left+right padding. A flat guess (previously 300) was narrower than the
// real content area on this device, leaving the bars/pill visibly short of
// the axis labels and other text, which naturally stretch to the true width.
function getContentWidth(horizontalPadding) {
  const screenWidth = Math.min(Device.screenSize().width, Device.screenSize().height);
  let widgetFrameWidth;
  if (screenWidth >= 430) widgetFrameWidth = 364; // Plus/Pro Max-class
  else if (screenWidth >= 390) widgetFrameWidth = 329; // standard/Pro-class
  else widgetFrameWidth = 291; // SE-class
  return widgetFrameWidth - horizontalPadding * 2;
}

function buildWidget(status) {
  // Sized for the LARGE Scriptable widget family - this much content (big
  // number, 24 bars, axis labels, status line, pill) does not fit Small or
  // Medium.
  const widget = new ListWidget();
  widget.backgroundColor = COLORS.surfaceCard;
  const horizontalPadding = 18;
  widget.setPadding(18, horizontalPadding, 16, horizontalPadding);
  const contentWidth = getContentWidth(horizontalPadding);

  const wordmarkRow = widget.addStack();
  wordmarkRow.centerAlignContent();
  const wordmark = wordmarkRow.addText("trayce");
  wordmark.font = Font.boldSystemFont(26);
  wordmark.textColor = COLORS.textPrimary;
  wordmarkRow.addSpacer(4);
  const accentImg = wordmarkRow.addImage(drawAccentRing(24));
  accentImg.imageSize = new Size(11, 11);
  wordmarkRow.addSpacer();

  widget.addSpacer(14);

  const isOut = status.wearStatus === "out" && !!status.startTime;
  const bigNumber = widget.addText(formatHm(status.wornSeconds));
  bigNumber.font = Font.heavySystemFont(44);
  bigNumber.textColor = COLORS.textPrimary;

  widget.addSpacer(6);

  const label = widget.addText("TODAY'S RHYTHM");
  label.font = Font.boldSystemFont(11);
  label.textColor = COLORS.textSecondary;

  widget.addSpacer(8);

  const barsHeight = 78;
  const barsImage = drawRhythmBars(contentWidth, barsHeight, status.segments || []);
  const barsElement = widget.addImage(barsImage);
  barsElement.imageSize = new Size(contentWidth, barsImage.size.height);

  widget.addSpacer(12);

  const statusRow = widget.addStack();
  statusRow.centerAlignContent();
  const dot = statusRow.addText("●");
  dot.font = Font.systemFont(12);
  dot.textColor = isOut ? COLORS.accentSand : COLORS.brandTeal;
  statusRow.addSpacer(6);
  const statusLabel = statusRow.addText(isOut ? "Aligners out" : "Aligners in");
  statusLabel.font = Font.boldSystemFont(15);
  statusLabel.textColor = COLORS.textPrimary;
  if (isOut) {
    statusRow.addSpacer(4);
    const elapsedText = statusRow.addText(`· ${formatElapsedSince(status.startTime)}`);
    elapsedText.font = Font.systemFont(15);
    elapsedText.textColor = COLORS.textSecondary;
  }
  statusRow.addSpacer();

  widget.addSpacer(14);

  const pillHeight = 52;
  const pillImage = drawPill(contentWidth, pillHeight, isOut);
  const pillElement = widget.addImage(pillImage);
  pillElement.imageSize = new Size(contentWidth, pillHeight);

  widget.refreshAfterDate = new Date(Date.now() + (isOut ? 5 : 20) * 60 * 1000);

  return widget;
}

function buildErrorWidget(message) {
  const widget = new ListWidget();
  widget.backgroundColor = COLORS.surfaceCard;
  widget.setPadding(18, 18, 18, 18);
  const title = widget.addText("trayce");
  title.font = Font.boldSystemFont(20);
  title.textColor = COLORS.brandTeal;
  widget.addSpacer(10);
  const body = widget.addText(`Widget error: ${message}`);
  body.font = Font.systemFont(13);
  body.textColor = COLORS.textSecondary;
  widget.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);
  return widget;
}

async function run() {
  // config.runsInWidget is only true for the OS's own background timeline
  // refresh - that path just displays the latest status. Any other run (a
  // Home Screen tap with "Run Script", or a manual ▶️ in the editor) means
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
  Script.complete();
}

await run();
