// Variables used by Scriptable.
// icon-color: teal; icon-glyph: cloud-download-alt;
//
// ── Setup (do this ONCE) ────────────────────────────────────────────────
// 1. Create a new script in Scriptable, name it "TrayceWidgetV2", and
//    paste this whole file in - it REPLACES pasting TrayceWidgetV2.js
//    directly.
// 2. Fill in MY_CONFIG below with your real chatId and widgetSecret. This
//    file is where those live from now on - it stays ONLY on your device
//    (never pushed to git), unlike the actual widget script on GitHub,
//    which only ever has placeholder values since that repo is public.
// 3. Add it to your Home Screen as any size (Small/Medium/Large).
// 4. From now on, pushes to the repo just show up - no more copy/paste.
//    If you ever want the latest version immediately instead of waiting
//    for the cache to expire, lower CACHE_MAX_AGE_MS below to 0.
// ───────────────────────────────────────────────────────────────────────

const MY_CONFIG = {
  apiBase: "https://align-track-rho.vercel.app",
  chatId: "REPLACE_WITH_YOUR_TELEGRAM_CHAT_ID",
  widgetSecret: "REPLACE_WITH_YOUR_SHORTCUTS_SECRET", // same value as your /out, /in, /toggle Shortcuts
};

// Points at the feature branch this project currently lives on. Update
// this if that work ever merges to main (or ask me to update it for you).
const RAW_URL =
  "https://raw.githubusercontent.com/nebunici-cloud/Align-track/claude/aligners-app-analysis-roadmap-agy1pn/scriptable/TrayceWidgetV2.js";

// Short while this widget is still being actively tweaked - safe to raise
// once the design settles, to avoid a network fetch on every tap/refresh.
const CACHE_MAX_AGE_MS = 5 * 60 * 1000;

async function getScriptCode() {
  const fm = FileManager.local();
  const codePath = fm.joinPath(fm.cacheDirectory(), "trayce-widget-v2-remote.js");
  const metaPath = fm.joinPath(fm.cacheDirectory(), "trayce-widget-v2-remote.meta");

  let cachedCode = null;
  let cachedAt = 0;
  if (fm.fileExists(codePath) && fm.fileExists(metaPath)) {
    cachedCode = fm.readString(codePath);
    cachedAt = Number(fm.readString(metaPath)) || 0;
  }

  if (cachedCode && Date.now() - cachedAt < CACHE_MAX_AGE_MS) {
    return cachedCode;
  }

  try {
    const req = new Request(RAW_URL);
    req.timeoutInterval = 8;
    const freshCode = await req.loadString();
    if (!freshCode || freshCode.length < 200) {
      throw new Error("Fetched script looked empty or truncated");
    }
    fm.writeString(codePath, freshCode);
    fm.writeString(metaPath, String(Date.now()));
    return freshCode;
  } catch (err) {
    // Network hiccup or GitHub unreachable - fall back to whatever we
    // last cached rather than showing an error for a purely transient issue.
    if (cachedCode) return cachedCode;
    throw err;
  }
}

function buildLoaderErrorWidget(message) {
  const widget = new ListWidget();
  widget.backgroundColor = new Color("#102a41");
  widget.setPadding(16, 16, 16, 16);
  const title = widget.addText("trayce");
  title.font = Font.boldSystemFont(16);
  title.textColor = new Color("#18bcae");
  widget.addSpacer(8);
  const body = widget.addText(`Loader error: ${message}`);
  body.font = Font.systemFont(12);
  body.textColor = new Color("#91a8ba");
  widget.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);
  return widget;
}

try {
  // Read by the fetched script's own `const CONFIG = (typeof TRAYCE_CONFIG
  // !== "undefined" && TRAYCE_CONFIG) || {...placeholders}` fallback line -
  // same JS context as this loader, so the global is visible to it.
  globalThis.TRAYCE_CONFIG = MY_CONFIG;

  const code = await getScriptCode();
  // Wrapped in an async IIFE so the fetched script's own top-level
  // `await run();` is valid inside eval().
  await eval(`(async () => {\n${code}\n})()`);
} catch (err) {
  Script.setWidget(buildLoaderErrorWidget(err.message || String(err)));
  Script.complete();
}
