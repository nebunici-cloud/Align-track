// Variables used by Scriptable.
// icon-color: teal; icon-glyph: columns;
//
// ── Setup ────────────────────────────────────────────────────────────────
// 1. Install Scriptable from the App Store (scriptable.app) if you haven't.
// 2. Create a new script in Scriptable, name it "TrayceWidgetHorizontal",
//    and paste this whole file in.
// 3. Fill in the two CONFIG values below (same values as your other Trayce
//    widget scripts, if you already set one up):
//      - chatId: your Telegram chat id (same one your /link CODE used).
//      - widgetSecret: the SAME secret you already put in your /out, /in,
//        or /toggle Shortcut's headers (TELEGRAM_WEBHOOK_SECRET in Vercel).
// 4. Long-press the Home Screen -> + -> Scriptable -> pick the MEDIUM
//    widget size (this is the wide/horizontal one - Small/Large use the
//    other two Trayce scripts instead) -> add it -> long-press the widget
//    -> Edit Widget -> set "Script" to TrayceWidgetHorizontal.
// 5. Tapping the widget posts a synthetic "/toggle" straight to the bot's
//    webhook - Scriptable briefly opens to run the script (unavoidable for
//    a "Run Script" widget), but no other app is involved.
// ────────────────────────────────────────────────────────────────────────

// If a loader script (TrayceWidgetHorizontal-Loader.js) already defined
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

function formatHmPadded(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
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

// 24 rounded bars, one per hour, each brightness-ramped left-to-right -
// mirrors src/components/home/TodaysRhythm.tsx's segment coloring exactly.
// Draws the bars AND the "00:00 / 12:00 / 23:59" axis labels into ONE
// bitmap so they're pixel-locked together regardless of the widget's true
// rendered width.
function drawRhythmBars(width, barsHeight, segments, labelFontSize) {
  const fontSize = labelFontSize || 10;
  const labelGap = Math.max(2, fontSize * 0.36);
  const labelHeight = fontSize + 3;
  const ctx = new DrawContext();
  ctx.size = new Size(width, barsHeight + labelGap + labelHeight);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  const barCount = segments.length || 24;
  const gap = width < 220 ? 2 : 3;
  const barWidth = (width - gap * (barCount - 1)) / barCount;
  const cornerRadius = Math.min(3, barWidth / 2);
  const stateHex = { worn: HEX.brandTeal, out: HEX.accentSand, future: HEX.stateInactive };

  segments.forEach((state, i) => {
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
  ctx.setFont(Font.systemFont(fontSize));
  ctx.setTextColor(COLORS.textSecondary);
  const labelBoxWidth = Math.min(70, width / 3);

  ctx.setTextAlignedLeft();
  ctx.drawTextInRect("00:00", new Rect(0, labelY, labelBoxWidth, labelHeight));

  ctx.setTextAlignedCenter();
  ctx.drawTextInRect("12:00", new Rect(width / 2 - labelBoxWidth / 2, labelY, labelBoxWidth, labelHeight));

  ctx.setTextAlignedRight();
  ctx.drawTextInRect("23:59", new Rect(width - labelBoxWidth, labelY, labelBoxWidth, labelHeight));

  return ctx.getImage();
}

// Capsule GRADIENT ONLY (no badge, no text) - those are added as real
// WidgetStack/WidgetText elements on top in buildWidget(), since
// DrawContext has no text-measurement API to reliably center a baked-in
// icon+label group (confirmed the hard way on the vertical widget).
function drawPillBackground(width, height, isOut) {
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

  return ctx.getImage();
}

// Diagonal teal-glow-to-near-black background, matching the reference card.
function buildBackgroundGradient() {
  const gradient = new LinearGradient();
  gradient.locations = [0, 0.45, 1];
  gradient.colors = [new Color("#1d6e67"), new Color("#0a2530"), new Color("#050c12")];
  gradient.startPoint = new Point(1, 0);
  gradient.endPoint = new Point(0, 1);
  return gradient;
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

// Adds a pill with an icon badge + centered label on top of a
// drawPillBackground() image - flexible spacers on both sides of the
// (badge + gap + label) group let Scriptable's own layout engine measure
// and center the real text, rather than estimating its width.
function addPillWithIcon(parent, width, height, isOut) {
  const pillBgImage = drawPillBackground(width, height, isOut);
  const pillContainer = parent.addStack();
  pillContainer.backgroundImage = pillBgImage;
  pillContainer.size = new Size(width, height);
  pillContainer.centerAlignContent();

  pillContainer.addSpacer();

  const badgeSize = height * 0.62;
  const badgeStack = pillContainer.addStack();
  badgeStack.size = new Size(badgeSize, badgeSize);
  badgeStack.backgroundColor = new Color("#ffffff", 0.28);
  badgeStack.cornerRadius = badgeSize / 2;
  badgeStack.centerAlignContent();
  const iconText = badgeStack.addText(isOut ? "+" : "↗");
  iconText.font = Font.boldSystemFont(badgeSize * 0.56);
  iconText.textColor = new Color("#092337");

  pillContainer.addSpacer(8);

  const pillLabel = pillContainer.addText(isOut ? "PUT ALIGNERS IN" : "TAKE ALIGNERS OUT");
  pillLabel.font = Font.boldSystemFont(height * 0.3);
  pillLabel.textColor = new Color("#092337");

  pillContainer.addSpacer();

  return pillContainer;
}

// Scriptable has no API to read the widget's actual rendered frame, so this
// maps the device's screen width to Apple's published Medium-widget frame
// size (width tier shared with Large, height tier shared with Small).
function getMediumFrameSize() {
  const screenWidth = Math.min(Device.screenSize().width, Device.screenSize().height);
  if (screenWidth >= 430) return { width: 364, height: 170 }; // Plus/Pro Max-class
  if (screenWidth >= 390) return { width: 329, height: 158 }; // standard/Pro-class
  return { width: 291, height: 141 }; // SE-class
}

function buildWidget(status) {
  const widget = new ListWidget();
  widget.backgroundGradient = buildBackgroundGradient();
  const paddingH = 16;
  const paddingV = 13;
  widget.setPadding(paddingV, paddingH, paddingV, paddingH);

  const frame = getMediumFrameSize();
  const contentWidth = frame.width - paddingH * 2;
  const contentHeight = frame.height - paddingV * 2;
  const columnGap = 14;
  const leftWidth = Math.round(contentWidth * 0.36);
  const rightWidth = contentWidth - leftWidth - columnGap;

  const row = widget.addStack();
  row.size = new Size(contentWidth, contentHeight);

  const isOut = status.wearStatus === "out" && !!status.startTime;
  const stateColor = isOut ? COLORS.accentSand : COLORS.brandTeal;

  // ── Left column: wordmark, big number, status, daily total ──
  const left = row.addStack();
  left.layoutVertically();
  left.size = new Size(leftWidth, contentHeight);

  const wordmarkRow = left.addStack();
  wordmarkRow.topAlignContent();
  const wordmark = wordmarkRow.addText("trayce");
  wordmark.font = Font.systemFont(14);
  wordmark.textColor = COLORS.textPrimary;
  wordmarkRow.addSpacer(3);
  const accentImg = wordmarkRow.addImage(drawAccentRing(16));
  accentImg.imageSize = new Size(7, 7);
  wordmarkRow.addSpacer();

  left.addSpacer(6);

  const bigNumber = left.addText(formatHm(status.wornSeconds));
  bigNumber.font = Font.heavySystemFont(28);
  bigNumber.textColor = COLORS.textPrimary;

  const wornLabel = left.addText("WORN TODAY");
  wornLabel.font = Font.boldSystemFont(8);
  wornLabel.textColor = COLORS.textSecondary;

  left.addSpacer();

  const statusRow = left.addStack();
  statusRow.centerAlignContent();
  const dot = statusRow.addText("●");
  dot.font = Font.systemFont(9);
  dot.textColor = stateColor;
  statusRow.addSpacer(4);
  const statusLabel = statusRow.addText(isOut ? "Aligners out" : "Aligners in");
  statusLabel.font = Font.boldSystemFont(10.5);
  statusLabel.textColor = stateColor;
  if (status.sinceIso) {
    statusRow.addSpacer(3);
    const sinceText = statusRow.addText(`· since ${formatClockTime(status.sinceIso)}`);
    sinceText.font = Font.systemFont(10.5);
    sinceText.textColor = COLORS.textSecondary;
  }

  left.addSpacer(3);

  const totalRow = left.addStack();
  totalRow.centerAlignContent();
  const totalLabel = totalRow.addText("Total out today");
  totalLabel.font = Font.systemFont(9.5);
  totalLabel.textColor = COLORS.textSecondary;
  totalRow.addSpacer(3);
  const totalValue = totalRow.addText(`· ${formatHmPadded(status.outMinutesToday || 0)}`);
  totalValue.font = Font.boldSystemFont(9.5);
  totalValue.textColor = COLORS.accentSand;

  row.addSpacer(columnGap);

  // ── Right column: rhythm chart + toggle pill ──
  const right = row.addStack();
  right.layoutVertically();
  right.size = new Size(rightWidth, contentHeight);

  const rhythmLabel = right.addText("TODAY'S RHYTHM");
  rhythmLabel.font = Font.boldSystemFont(9.5);
  rhythmLabel.textColor = COLORS.textSecondary;

  right.addSpacer(8);

  const barsHeight = Math.max(30, contentHeight - 78);
  const barsImage = drawRhythmBars(rightWidth, barsHeight, status.segments || [], 9);
  const barsElement = right.addImage(barsImage);
  barsElement.imageSize = new Size(rightWidth, barsImage.size.height);

  right.addSpacer();

  const pillHeight = 34;
  addPillWithIcon(right, rightWidth, pillHeight, isOut);

  widget.refreshAfterDate = new Date(Date.now() + (isOut ? 5 : 20) * 60 * 1000);

  return widget;
}

function buildErrorWidget(message) {
  const widget = new ListWidget();
  widget.backgroundColor = COLORS.surfaceCard;
  widget.setPadding(14, 14, 14, 14);
  const title = widget.addText("trayce");
  title.font = Font.boldSystemFont(16);
  title.textColor = COLORS.brandTeal;
  widget.addSpacer(8);
  const body = widget.addText(`Widget error: ${message}`);
  body.font = Font.systemFont(11);
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
