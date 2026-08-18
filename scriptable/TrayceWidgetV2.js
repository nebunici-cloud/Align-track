// Variables used by Scriptable.
// icon-color: teal; icon-glyph: chart-line;
//
// ── Setup ────────────────────────────────────────────────────────────────
// 1. Create a new script in Scriptable, name it "TrayceWidgetV2", and paste
//    this whole file in.
// 2. Fill in the two CONFIG values below (same values as your other Trayce
//    widget scripts, if you already set one up):
//      - chatId: your Telegram chat id (same one your /link CODE used).
//      - widgetSecret: the SAME secret you already put in your /out, /in,
//        or /toggle Shortcut's headers (TELEGRAM_WEBHOOK_SECRET in Vercel).
// 3. Long-press the Home Screen -> + -> Scriptable -> pick SMALL, MEDIUM,
//    or LARGE (this script renders a different, size-appropriate layout
//    for each via config.widgetFamily) -> add it -> long-press the widget
//    -> Edit Widget -> set "Script" to TrayceWidgetV2.
// 4. Tapping the widget posts a synthetic "/toggle" straight to the bot's
//    webhook - Scriptable briefly opens to run the script (unavoidable for
//    a "Run Script" widget) and closes itself immediately after (App.close()).
// ────────────────────────────────────────────────────────────────────────
//
// ── This is a from-spec rebuild, NOT the same design as TrayceWidgetRhythm ──
// Built against a formal widget spec (locked gradient, compliance-band
// model, continuous minute-accurate track, inverted button hierarchy,
// unified copy, notStarted/stale states, 7-day compliance row on Large).
// A few things the spec calls for are genuinely impossible in Scriptable -
// noted inline at the point they'd apply, not silently skipped:
//   - True per-second live-counting text (SwiftUI's Text(timerInterval:))
//     has no Scriptable equivalent. The "Out for Xm" hero updates on each
//     refresh/tap like everything else here, not continuously.
//   - .accented / .vibrant widgetRenderingMode detection isn't exposed to
//     Scriptable at all, so the solid-vs-notch form-based worn/out
//     encoding (spec §9.4) is applied ALWAYS rather than conditionally -
//     which is a reasonable default (CVD-safe, costs nothing in normal
//     rendering) even though it can't be limited to accented mode only.
//   - Dynamic Type / sizeCategory and native VoiceOver composed labels
//     aren't exposed either; there's no reduced-layout or accessibility
//     label logic here.
//   - Locale-aware 12h/24h axis labels aren't implemented; it's always
//     "12a · 12p · 12a".
//   - SF Symbols for the button's leading icon were skipped in favor of
//     plain arrow glyphs (↓/↑), to avoid an unverified assumption about
//     Scriptable's SFSymbol tinting API - text glyphs are proven reliable
//     in this codebase already.
// ────────────────────────────────────────────────────────────────────────

const CONFIG = (typeof TRAYCE_CONFIG !== "undefined" && TRAYCE_CONFIG) || {
  apiBase: "https://align-track-rho.vercel.app",
  chatId: "REPLACE_WITH_YOUR_TELEGRAM_CHAT_ID",
  widgetSecret: "REPLACE_WITH_YOUR_SHORTCUTS_SECRET", // same value as your /out, /in, /toggle Shortcuts
};

// ── §3 Design tokens ────────────────────────────────────────────────────
const COLORS = {
  gradStart: "#17403A",
  gradEnd: "#0C1A1E",
  worn: new Color("#52C5A9"),
  wornHex: "#52C5A9",
  out: new Color("#E3BE63"),
  outHex: "#E3BE63",
  alert: new Color("#E8734F"),
  trackFuture: new Color("#FFFFFF", 0.08),
  trackNow: new Color("#FFFFFF", 0.6),
  textPrimary: new Color("#FFFFFF"),
  textSecondary: new Color("#93A8A5"),
  textTertiary: new Color("#93A8A5", 0.7),
  textSection: new Color("#FFFFFF", 0.72),
  textOnFill: new Color("#12292B"),
};

// §3.1 - single locked gradient, identical in every size and every state
// (the spec's fix for the mockups' state-dependent, per-size-inconsistent
// gradients). Scriptable's LinearGradient takes normalized points, not a
// degree value, so "145°" is approximated with a fixed diagonal rather
// than computed from the angle.
function buildLockedGradient() {
  const gradient = new LinearGradient();
  gradient.locations = [0, 1];
  gradient.colors = [new Color(COLORS.gradStart), new Color(COLORS.gradEnd)];
  gradient.startPoint = new Point(0.1, 0);
  gradient.endPoint = new Point(0.75, 1);
  return gradient;
}

// ── Networking (same pattern as the other Trayce widget scripts) ───────
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

// ── §6.6 stale-state persistence ────────────────────────────────────────
// A real fallback, not just a label: caches the last successful payload so
// a failed background refresh can still render actual (dimmed) numbers
// with "Last synced HH:mm" instead of either a hard error or (worse) a
// confidently-wrong stale number with no indication it's stale. Only used
// on the background-refresh path - a failed TOGGLE still surfaces as a
// real error, since silently showing stale data there would hide that the
// tap didn't register.
function cachePaths() {
  const fm = FileManager.local();
  return {
    fm,
    dataPath: fm.joinPath(fm.cacheDirectory(), "trayce-v2-last-status.json"),
    metaPath: fm.joinPath(fm.cacheDirectory(), "trayce-v2-last-status.meta"),
  };
}

function saveStatusCache(status) {
  try {
    const { fm, dataPath, metaPath } = cachePaths();
    fm.writeString(dataPath, JSON.stringify(status));
    fm.writeString(metaPath, String(Date.now()));
  } catch (err) {
    // Non-fatal - worst case, the next failure has nothing to fall back to.
  }
}

function loadStatusCache() {
  try {
    const { fm, dataPath, metaPath } = cachePaths();
    if (!fm.fileExists(dataPath) || !fm.fileExists(metaPath)) return null;
    return { status: JSON.parse(fm.readString(dataPath)), at: Number(fm.readString(metaPath)) || 0 };
  } catch (err) {
    return null;
  }
}

// ── Formatting ───────────────────────────────────────────────────────────
function formatHm(totalSeconds) {
  const totalMinutes = Math.max(0, Math.round(totalSeconds / 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatMinutes(totalMinutes) {
  return formatHm(Math.max(0, totalMinutes) * 60);
}

// Device-local clock time - Scriptable runs on-device, so Date's own
// local-time getters are already correct, unlike on the server.
function formatClockTime(isoOrMs) {
  const d = new Date(isoOrMs);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function nowMinutesLocal() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function localMinutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

// ── §4 Compliance model + widget state derivation ───────────────────────
// Centralizes the logic every layout draws from, so wording/thresholds
// can't drift between small/medium/large.
function deriveViewModel(status, staleInfo) {
  const isOut = status.wearStatus === "out" && !!status.startTime;
  const dailyTargetHours = status.goalSeconds / 3600;
  const allowedOutMinutes = status.allowedOutMinutes ?? (24 - dailyTargetHours) * 60;
  const outRemaining = allowedOutMinutes - (status.outMinutesToday || 0);
  const band = outRemaining > 30 ? "onTrack" : outRemaining > 0 ? "atRisk" : "missed";
  const bandColor = { onTrack: COLORS.textPrimary, atRisk: COLORS.out, missed: COLORS.alert };

  const hasLoggedToday = isOut || status.wornSeconds > 0 || (status.outMinutesToday || 0) > 0 || !!status.sinceIso;

  let widgetState;
  if (!hasLoggedToday && !isOut) {
    widgetState = "notStarted";
  } else if (isOut) {
    const elapsedMin = status.startTime ? Math.floor((Date.now() - new Date(status.startTime).getTime()) / 60000) : 0;
    widgetState = elapsedMin >= 30 ? "removedExtended" : "removed";
  } else {
    widgetState = "wearing";
  }

  let heroText, heroSubText, smallSub, heroColor, secondaryLine, buttonKind, buttonLabelLong, buttonLabelShort;

  if (widgetState === "notStarted") {
    heroText = "Ready when you are";
    heroSubText = `${dailyTargetHours}h goal today`;
    smallSub = heroSubText;
    heroColor = COLORS.textPrimary;
    buttonKind = "primary";
    buttonLabelLong = "Put aligners in";
    buttonLabelShort = "Put aligners in";
  } else if (widgetState === "removed" || widgetState === "removedExtended") {
    const elapsedMs = status.startTime ? Date.now() - new Date(status.startTime).getTime() : 0;
    heroText = `Out for ${formatHm(elapsedMs / 1000)}`;
    heroSubText = `${formatMinutes(Math.max(0, outRemaining))} out-time left today`;
    smallSub = heroSubText;
    heroColor = widgetState === "removedExtended" ? COLORS.alert : COLORS.out;
    secondaryLine = `${formatHm(status.wornSeconds)} worn today`;
    buttonKind = "primary";
    buttonLabelLong = "Put aligners in";
    buttonLabelShort = "Put aligners in";
  } else {
    heroText = formatHm(status.wornSeconds);
    heroSubText = `${formatMinutes(Math.max(0, outRemaining))} out-time left`;
    smallSub = `WORN · ${formatMinutes(Math.max(0, outRemaining))} left`;
    heroColor = bandColor[band];
    buttonKind = "secondary";
    buttonLabelLong = "Take aligners out";
    buttonLabelShort = "Take out";
  }

  const stateLineText = !isOut && status.sinceIso ? `In since ${formatClockTime(status.sinceIso)}` : null;

  const daysUntilNextTray = (status.trayDurationDays ?? 7) - (status.trayDayNumber ?? 1);
  const trayChangeDue = daysUntilNextTray <= 1;
  const trayContextText = trayChangeDue
    ? `Next tray in ${Math.max(0, daysUntilNextTray)} days`
    : `Tray ${status.currentTray} of ${status.totalTrays} · day ${status.trayDayNumber} of ${status.trayDurationDays}`;
  const trayContextColor = trayChangeDue ? COLORS.worn : COLORS.textSecondary;

  const dimmed = !!staleInfo;
  if (dimmed) {
    heroColor = new Color("#ffffff", 0.6);
  }
  const staleLine = dimmed ? `Last synced ${formatClockTime(staleInfo.at)} · open to refresh` : null;

  return {
    isOut,
    widgetState,
    band,
    outRemaining,
    heroText,
    heroSubText,
    smallSub,
    heroColor,
    secondaryLine,
    stateLineText,
    buttonKind,
    buttonLabelLong,
    buttonLabelShort,
    trayContextText,
    trayContextColor,
    dimmed,
    staleLine,
  };
}

// ── §5 Continuous minute-accurate track (replaces 24 hourly bars) ──────
// Builds contiguous [start,end,state] segments from raw out-intervals
// instead of bucketing into hours, so a removal is positioned - and can
// be as short as - a few minutes, not rounded to the nearest hour.
function computeTrackSegments(intervals, nowMinutes) {
  const points = new Set([0, nowMinutes, 1440]);
  const outRanges = (intervals || [])
    .map((iv) => {
      const startMin = localMinutesOfDay(new Date(iv.startIso));
      const endMin = iv.endIso ? localMinutesOfDay(new Date(iv.endIso)) : nowMinutes;
      return [Math.max(0, Math.min(startMin, nowMinutes)), Math.max(0, Math.min(endMin, nowMinutes))];
    })
    .filter(([s, e]) => e > s);
  outRanges.forEach(([s, e]) => {
    points.add(s);
    points.add(e);
  });

  const sorted = Array.from(points).sort((a, b) => a - b);
  const segments = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (end <= start) continue;
    let state;
    if (start >= nowMinutes) {
      state = "future";
    } else {
      state = outRanges.some(([s, e]) => start >= s && end <= e) ? "out" : "worn";
    }
    segments.push({ start, end, state });
  }
  return segments;
}

// §5.2 worn = solid full-height fill; out = a reduced-height "notch"
// vertically centered with a small inset gap. This is the spec's
// .accented-mode CVD-safe form-based encoding (§9.4) - applied always,
// since Scriptable can't detect rendering mode to gate it conditionally.
function drawContinuousTrack(width, height, intervals, nowMinutes, showAxis, axisFontSize) {
  const axisGap = showAxis ? 4 : 0;
  const axisHeight = showAxis ? axisFontSize + 3 : 0;
  const ctx = new DrawContext();
  ctx.size = new Size(width, height + axisGap + axisHeight);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  const radius = height / 2;
  const bodyStart = radius;
  const bodyEnd = width - radius;
  const bodyWidth = Math.max(0, bodyEnd - bodyStart);
  const xForMinute = (min) => bodyStart + (min / 1440) * bodyWidth;

  const segments = computeTrackSegments(intervals, nowMinutes);

  // §5.2 minimum rendered segment width 2pt, so a brief removal stays
  // visible instead of rounding away to nothing.
  let cursor = bodyStart;
  const rects = segments.map((seg) => {
    let x1 = Math.max(xForMinute(seg.start), cursor);
    let x2 = xForMinute(seg.end);
    if (x2 - x1 < 2) x2 = x1 + 2;
    cursor = x2;
    return { ...seg, x1, x2 };
  });

  const stateColor = { worn: COLORS.worn, out: COLORS.out, future: COLORS.trackFuture };
  const leftColor = stateColor[rects.length ? rects[0].state : "worn"];
  const rightColor = stateColor[rects.length ? rects[rects.length - 1].state : "future"];

  const leftCap = new Path();
  leftCap.addEllipse(new Rect(0, 0, height, height));
  ctx.addPath(leftCap);
  ctx.setFillColor(leftColor);
  ctx.fillPath();

  const rightCap = new Path();
  rightCap.addEllipse(new Rect(width - height, 0, height, height));
  ctx.addPath(rightCap);
  ctx.setFillColor(rightColor);
  ctx.fillPath();

  rects.forEach((r) => {
    const rx = Math.max(r.x1, bodyStart);
    const rectWidth = Math.max(0, Math.min(r.x2, bodyEnd) - rx);
    if (rectWidth <= 0) return;
    const path = new Path();
    if (r.state === "out") {
      const gap = Math.min(1, rectWidth * 0.15);
      const notchHeight = height * 0.55;
      path.addRect(new Rect(rx + gap, (height - notchHeight) / 2, Math.max(0, rectWidth - gap * 2), notchHeight));
      ctx.addPath(path);
      ctx.setFillColor(COLORS.out);
    } else {
      path.addRect(new Rect(rx, 0, rectWidth, height));
      ctx.addPath(path);
      ctx.setFillColor(stateColor[r.state]);
    }
    ctx.fillPath();
  });

  // §5.2 hairline ticks at 06:00/12:00/18:00.
  [360, 720, 1080].forEach((min) => {
    const x = xForMinute(min);
    const path = new Path();
    path.addRect(new Rect(x - 0.5, 0, 1, height));
    ctx.addPath(path);
    ctx.setFillColor(new Color("#ffffff", 0.06));
    ctx.fillPath();
  });

  // Current-time marker, omitted within 4pt of either end.
  const nowX = xForMinute(nowMinutes);
  if (nowX > 4 && nowX < width - 4) {
    const path = new Path();
    path.addRect(new Rect(nowX - 1, 0, 2, height));
    ctx.addPath(path);
    ctx.setFillColor(COLORS.trackNow);
    ctx.fillPath();
  }

  if (showAxis) {
    const labelY = height + axisGap;
    const labelBoxWidth = Math.min(60, width / 3);
    ctx.setFont(Font.systemFont(axisFontSize));
    ctx.setTextColor(COLORS.textTertiary);
    ctx.setTextAlignedLeft();
    ctx.drawTextInRect("12a", new Rect(0, labelY, labelBoxWidth, axisHeight));
    ctx.setTextAlignedCenter();
    ctx.drawTextInRect("12p", new Rect(width / 2 - labelBoxWidth / 2, labelY, labelBoxWidth, axisHeight));
    ctx.setTextAlignedRight();
    ctx.drawTextInRect("12a", new Rect(width - labelBoxWidth, labelY, labelBoxWidth, axisHeight));
  }

  return ctx.getImage();
}

// ── §6.3 seven-day compliance row (Large only) ──────────────────────────
function drawSevenDayRow(width, last7Days) {
  const height = 6;
  const gap = 4;
  const labelHeight = 12;
  const ctx = new DrawContext();
  ctx.size = new Size(width, height + 4 + labelHeight);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  const days = last7Days && last7Days.length ? last7Days : [];
  const n = days.length || 7;
  const capsuleWidth = (width - gap * (n - 1)) / n;
  const bandHex = { onTrack: COLORS.wornHex, atRisk: COLORS.outHex, missed: "#E8734F", none: "#FFFFFF" };
  const bandAlpha = { onTrack: 1, atRisk: 1, missed: 1, none: 0.12 };
  const dowLetters = ["S", "M", "T", "W", "T", "F", "S"];

  days.forEach((day, i) => {
    const x = i * (capsuleWidth + gap);
    const path = new Path();
    path.addRoundedRect(new Rect(x, 0, capsuleWidth, height), height / 2, height / 2);
    ctx.addPath(path);
    ctx.setFillColor(new Color(bandHex[day.band] || "#FFFFFF", bandAlpha[day.band] ?? 1));
    ctx.fillPath();

    if (i === days.length - 1) {
      const outline = new Path();
      outline.addRoundedRect(new Rect(x - 1, -1, capsuleWidth + 2, height + 2), (height + 2) / 2, (height + 2) / 2);
      ctx.addPath(outline);
      ctx.setStrokeColor(COLORS.textPrimary);
      ctx.setLineWidth(1);
      ctx.strokePath();
    }
  });

  ctx.setFont(Font.systemFont(9));
  ctx.setTextColor(COLORS.textTertiary);
  ctx.setTextAlignedCenter();
  days.forEach((day, i) => {
    const x = i * (capsuleWidth + gap);
    const dow = new Date(`${day.dateStr}T00:00:00`).getDay();
    ctx.drawTextInRect(dowLetters[dow], new Rect(x, height + 4, capsuleWidth, labelHeight));
  });

  return ctx.getImage();
}

// ── §7 Button — inverted hierarchy: secondary while wearing, primary
// otherwise. A real WidgetStack + a single text element (icon glyph and
// label combined into one string) rather than a hand-estimated multi-part
// layout - lets Scriptable measure and center the real text itself,
// avoiding the exact centering bug this codebase already hit once before.
function drawButtonBackground(width, height, kind) {
  const ctx = new DrawContext();
  ctx.size = new Size(width, height);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const path = new Path();
  path.addRoundedRect(new Rect(0.5, 0.5, width - 1, height - 1), height / 2, height / 2);
  ctx.addPath(path);
  if (kind === "primary") {
    ctx.setFillColor(COLORS.worn);
    ctx.fillPath();
  } else {
    ctx.setStrokeColor(new Color("#ffffff", 0.24));
    ctx.setLineWidth(1);
    ctx.strokePath();
  }
  return ctx.getImage();
}

function addButton(parent, width, height, kind, label) {
  const bg = drawButtonBackground(width, height, kind);
  const container = parent.addStack();
  container.backgroundImage = bg;
  container.size = new Size(width, height);
  container.centerAlignContent();
  container.addSpacer();
  const icon = kind === "primary" ? "↓" : "↑";
  const text = container.addText(`${icon}  ${label}`);
  text.font = Font.semiboldSystemFont(height * 0.33);
  text.textColor = kind === "primary" ? COLORS.textOnFill : new Color("#ffffff", 0.9);
  container.addSpacer();
  return container;
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
  ctx.setStrokeColor(COLORS.worn);
  ctx.setLineWidth(lineWidth);
  ctx.strokePath();
  return ctx.getImage();
}

// ── §2 Canvas sizes ──────────────────────────────────────────────────────
function getFrameSize(family) {
  const screenWidth = Math.min(Device.screenSize().width, Device.screenSize().height);
  let tier;
  if (screenWidth >= 430) {
    tier = { small: { w: 170, h: 170 }, medium: { w: 364, h: 170 }, large: { w: 364, h: 382 } };
  } else if (screenWidth >= 390) {
    tier = { small: { w: 158, h: 158 }, medium: { w: 338, h: 158 }, large: { w: 338, h: 354 } };
  } else {
    tier = { small: { w: 155, h: 155 }, medium: { w: 329, h: 155 }, large: { w: 329, h: 345 } };
  }
  const f = tier[family];
  return { width: f.w, height: f.h };
}

// ── §6.1 Small ───────────────────────────────────────────────────────────
function buildSmallWidget(status, vm) {
  const widget = new ListWidget();
  widget.backgroundGradient = buildLockedGradient();
  const padding = 12;
  widget.setPadding(padding, padding, padding, padding);
  const contentWidth = getFrameSize("small").width - padding * 2;

  const wordmarkRow = widget.addStack();
  wordmarkRow.topAlignContent();
  const wm = wordmarkRow.addText("trayce");
  wm.font = Font.systemFont(15);
  wm.textColor = COLORS.textPrimary;
  wordmarkRow.addSpacer(3);
  const ring = wordmarkRow.addImage(drawAccentRing(16));
  ring.imageSize = new Size(7, 7);
  wordmarkRow.addSpacer();

  widget.addSpacer(6);

  const hero = widget.addText(vm.heroText);
  hero.font = Font.boldSystemFont(30);
  hero.textColor = vm.heroColor;

  const sub = widget.addText(vm.smallSub);
  sub.font = Font.mediumSystemFont(11);
  sub.textColor = COLORS.textSecondary;

  widget.addSpacer(6);

  const trackImg = drawContinuousTrack(contentWidth, 8, status.intervals, nowMinutesLocal(), false, 0);
  const trackEl = widget.addImage(trackImg);
  trackEl.imageSize = new Size(contentWidth, trackImg.size.height);

  widget.addSpacer(6);

  if (vm.dimmed) {
    const stale = widget.addText(vm.staleLine);
    stale.font = Font.systemFont(11);
    stale.textColor = COLORS.textSecondary;
  } else if (vm.stateLineText) {
    const row = widget.addStack();
    row.centerAlignContent();
    const dot = row.addText("●");
    dot.font = Font.systemFont(10);
    dot.textColor = COLORS.worn;
    row.addSpacer(5);
    const t = row.addText(vm.stateLineText);
    t.font = Font.systemFont(13);
    t.textColor = COLORS.textPrimary;
  }

  widget.addSpacer(8);

  addButton(widget, contentWidth, 30, vm.buttonKind, vm.buttonLabelShort);

  widget.refreshAfterDate = new Date(Date.now() + (vm.isOut ? 5 : 20) * 60 * 1000);
  return widget;
}

// ── §6.2 Medium ──────────────────────────────────────────────────────────
function buildMediumWidget(status, vm) {
  const widget = new ListWidget();
  widget.backgroundGradient = buildLockedGradient();
  const padding = 16;
  widget.setPadding(padding, padding, padding, padding);

  const frame = getFrameSize("medium");
  const contentWidth = frame.width - padding * 2;
  const contentHeight = frame.height - padding * 2;
  const gutter = 16;
  const leftWidth = Math.round(contentWidth * 0.54) - gutter / 2;
  const rightWidth = contentWidth - leftWidth - gutter;

  const row = widget.addStack();
  row.size = new Size(contentWidth, contentHeight);

  // ── Left column ──
  const left = row.addStack();
  left.layoutVertically();
  left.size = new Size(leftWidth, contentHeight);

  const wordmarkRow = left.addStack();
  wordmarkRow.topAlignContent();
  const wm = wordmarkRow.addText("trayce");
  wm.font = Font.systemFont(15);
  wm.textColor = COLORS.textPrimary;
  wordmarkRow.addSpacer(3);
  const ring = wordmarkRow.addImage(drawAccentRing(17));
  ring.imageSize = new Size(7.5, 7.5);
  wordmarkRow.addSpacer();

  const trayLine = left.addText(vm.trayContextText);
  trayLine.font = Font.systemFont(12);
  trayLine.textColor = vm.trayContextColor;

  left.addSpacer();

  const hero = left.addText(vm.heroText);
  hero.font = Font.boldSystemFont(40);
  hero.textColor = vm.heroColor;

  const caption = left.addText("WORN TODAY");
  caption.font = Font.semiboldSystemFont(11);
  caption.textColor = COLORS.textSecondary;

  left.addSpacer();

  if (vm.dimmed) {
    const stale = left.addText(vm.staleLine);
    stale.font = Font.systemFont(12);
    stale.textColor = COLORS.textSecondary;
  } else if (vm.stateLineText) {
    const row2 = left.addStack();
    row2.centerAlignContent();
    const dot = row2.addText("●");
    dot.font = Font.systemFont(11);
    dot.textColor = COLORS.worn;
    row2.addSpacer(5);
    const t = row2.addText(vm.stateLineText);
    t.font = Font.systemFont(15);
    t.textColor = COLORS.textPrimary;
  }
  const sub2 = left.addText(vm.secondaryLine || vm.heroSubText);
  sub2.font = Font.mediumSystemFont(13);
  sub2.textColor = COLORS.textSecondary;

  row.addSpacer(gutter);

  // ── Right column ──
  const right = row.addStack();
  right.layoutVertically();
  right.size = new Size(rightWidth, contentHeight);

  const header = right.addText("TODAY'S RHYTHM");
  header.font = Font.semiboldSystemFont(11);
  header.textColor = COLORS.textSection;

  right.addSpacer(8);

  const barsHeight = 10;
  const trackImg = drawContinuousTrack(rightWidth, barsHeight, status.intervals, nowMinutesLocal(), true, 11);
  const trackEl = right.addImage(trackImg);
  trackEl.imageSize = new Size(rightWidth, trackImg.size.height);

  right.addSpacer();

  addButton(right, rightWidth, 36, vm.buttonKind, vm.buttonLabelLong);

  widget.refreshAfterDate = new Date(Date.now() + (vm.isOut ? 5 : 20) * 60 * 1000);
  return widget;
}

// ── §6.3 Large ───────────────────────────────────────────────────────────
function buildLargeWidget(status, vm) {
  const widget = new ListWidget();
  widget.backgroundGradient = buildLockedGradient();
  const padding = 20;
  widget.setPadding(padding, padding, padding, padding);
  const contentWidth = getFrameSize("large").width - padding * 2;

  const wordmarkRow = widget.addStack();
  wordmarkRow.topAlignContent();
  const wm = wordmarkRow.addText("trayce");
  wm.font = Font.systemFont(15);
  wm.textColor = COLORS.textPrimary;
  wordmarkRow.addSpacer(4);
  const ring = wordmarkRow.addImage(drawAccentRing(19));
  ring.imageSize = new Size(8.5, 8.5);
  wordmarkRow.addSpacer();

  const trayLine = widget.addText(vm.trayContextText);
  trayLine.font = Font.systemFont(14);
  trayLine.textColor = vm.trayContextColor;

  widget.addSpacer(10);

  const hero = widget.addText(vm.heroText);
  hero.font = Font.boldSystemFont(52);
  hero.textColor = vm.heroColor;

  const capRow = widget.addStack();
  const cap = capRow.addText("WORN TODAY");
  cap.font = Font.semiboldSystemFont(12);
  cap.textColor = COLORS.textSecondary;
  capRow.addSpacer(4);
  const capSub = capRow.addText(`· ${vm.heroSubText}`);
  capSub.font = Font.mediumSystemFont(12);
  capSub.textColor = COLORS.textSecondary;

  widget.addSpacer(10);

  const header = widget.addText("TODAY'S RHYTHM");
  header.font = Font.semiboldSystemFont(12);
  header.textColor = COLORS.textSection;

  widget.addSpacer(6);

  const trackImg = drawContinuousTrack(contentWidth, 12, status.intervals, nowMinutesLocal(), true, 12);
  const trackEl = widget.addImage(trackImg);
  trackEl.imageSize = new Size(contentWidth, trackImg.size.height);

  widget.addSpacer(8);

  if (vm.dimmed) {
    const stale = widget.addText(vm.staleLine);
    stale.font = Font.systemFont(13);
    stale.textColor = COLORS.textSecondary;
  } else if (vm.stateLineText) {
    const row = widget.addStack();
    row.centerAlignContent();
    const dot = row.addText("●");
    dot.font = Font.systemFont(12);
    dot.textColor = COLORS.worn;
    row.addSpacer(6);
    const t = row.addText(vm.stateLineText);
    t.font = Font.systemFont(17);
    t.textColor = COLORS.textPrimary;
  } else if (vm.secondaryLine) {
    const sec = widget.addText(vm.secondaryLine);
    sec.font = Font.systemFont(15);
    sec.textColor = COLORS.textSecondary;
  }

  widget.addSpacer(10);

  const sevenDayHeader = widget.addText("LAST 7 DAYS");
  sevenDayHeader.font = Font.semiboldSystemFont(11);
  sevenDayHeader.textColor = COLORS.textSection;

  widget.addSpacer(6);

  const sevenDayImg = drawSevenDayRow(contentWidth, status.last7Days || []);
  const sevenDayEl = widget.addImage(sevenDayImg);
  sevenDayEl.imageSize = new Size(contentWidth, sevenDayImg.size.height);

  widget.addSpacer(10);

  addButton(widget, contentWidth, 44, vm.buttonKind, vm.buttonLabelLong);

  widget.refreshAfterDate = new Date(Date.now() + (vm.isOut ? 5 : 20) * 60 * 1000);
  return widget;
}

function buildWidget(status, staleInfo) {
  const vm = deriveViewModel(status, staleInfo);
  if (config.widgetFamily === "small") return buildSmallWidget(status, vm);
  if (config.widgetFamily === "large") return buildLargeWidget(status, vm);
  return buildMediumWidget(status, vm);
}

function buildErrorWidget(message) {
  const widget = new ListWidget();
  widget.backgroundColor = new Color(COLORS.gradEnd);
  widget.setPadding(16, 16, 16, 16);
  const title = widget.addText("trayce");
  title.font = Font.systemFont(15);
  title.textColor = COLORS.worn;
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
    if (config.runsInWidget) {
      try {
        const status = await fetchStatus();
        saveStatusCache(status);
        widget = buildWidget(status, null);
      } catch (err) {
        const cached = loadStatusCache();
        if (cached) {
          widget = buildWidget(cached.status, { at: cached.at });
        } else {
          throw err;
        }
      }
    } else {
      const status = await performToggle();
      saveStatusCache(status);
      widget = buildWidget(status, null);
    }
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
