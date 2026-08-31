// Generates the README screenshots — docs/img/*.png.
//
// It is NOT a mockup. The key strip comes out of `keyImage()`, the same function the
// physical key uses, and the panel shots are the real `ui/dictation.html` fed with the
// same payloads the plugin sends over `sendToPropertyInspector`. If the interface
// changes, `npm run shots` reprints the truth; a hand-made screenshot would start lying
// the next day.
//
//   npm run shots
//
// Needs Chrome installed (headless). Everything else comes from the project itself.

import { execFile } from "node:child_process";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { keyImage, iconThumb, wrapLabel, ICON_NAMES, KEY_STYLES } from "../src/lib/icons.js";
import { builtinPresets } from "../src/lib/presets.js";
import { spokenLanguages, targetLanguages } from "../src/lib/languages.js";
import { SWATCHES } from "../src/lib/theme.js";
import { TRANSCRIBE_MODELS, TEXT_MODELS, withDefaults, type ActionSettings } from "../src/lib/settings.js";
import { textPromptParts } from "../src/lib/prompts.js";
import { buildTranscribePrompt, buildKeywords, parseTerms } from "../src/lib/canon.js";
import { supportsKeywords } from "../src/lib/openai.js";
import { keyText } from "../src/lib/key-text.js";

const ROOT = process.cwd();
const UI = join(ROOT, "com.felipe.transcritranslator.sdPlugin", "ui");
const OUT = join(ROOT, "docs", "img");
const WORK = join(ROOT, "node_modules", ".cache", "shots");

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((p) => existsSync(p));

const VERSION = JSON.parse(await readFile(join(ROOT, "version.json"), "utf8")) as {
  version: string;
  date: string;
};

/** The panel is 340 px wide in the Stream Deck; 2x so the PNG is not mushy. */
const PANEL_WIDTH = 340;
/** The key strip is ours to size — wide enough for four keys plus breathing room. */
const STRIP_WIDTH = 400;
const SCALE = 2;

function chrome(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      CHROME!,
      ["--headless", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=3000", ...args],
      { windowsHide: true, timeout: 60_000, maxBuffer: 1 << 26 },
      (err, stdout) => (err ? reject(err) : resolve(stdout)),
    );
  });
}

const url = (file: string) => `file:///${file.replace(/\\/g, "/")}`;

/**
 * How tall the page really is, at the width it will be photographed in.
 *
 * Headless Chrome refuses to make the window narrower than ~500 px: asking for 340 lays
 * the page out at 500 and then crops the photo to 340, which slices the interface in half.
 * So the width is pinned in the document itself (see `widthFix`), and the height is read
 * back from the page instead of guessed — a guessed height either cuts the bottom off or
 * leaves a band of background under it.
 */
async function measure(file: string): Promise<number> {
  const dom = await chrome(["--window-size=900,900", "--dump-dom", url(file)]);
  const m = /<title>(\d+)<\/title>/.exec(dom);
  return m ? parseInt(m[1], 10) : 900;
}

function shot(file: string, width: number, height: number, out: string): Promise<string> {
  return chrome([
    `--force-device-scale-factor=${SCALE}`,
    `--window-size=${width},${height}`,
    `--screenshot=${out}`,
    url(file),
  ]);
}

/**
 * Pins the layout width and reports the resulting height through the title.
 *
 * The modal is `position: fixed`, so it sizes itself to the VIEWPORT — which headless
 * keeps at 500 px however narrow the window is asked to be — and would hang off the
 * right edge of the shot. Hence the override: fixed elements get the same 340 px.
 *
 * A page can set `window.__shotHeight` to frame itself (a modal wants its own height,
 * not the whole scroll).
 */
function widthFix(width: number): string {
  return (
    `<style>html,body{width:${width}px!important;overflow-x:hidden!important}` +
    `.modal{width:${width}px!important;right:auto!important}</style>` +
    `<script>window.addEventListener("load", () => {` +
    // body, not documentElement: the latter is never shorter than the measuring window,
    // which would leave a band of empty background under a short page.
    `document.title = String(window.__shotHeight || document.body.scrollHeight);` +
    `});</script>`
  );
}

// ---------------------------------------------------------------------------
// 1. The key strip — every state, drawn by the real thing
// ---------------------------------------------------------------------------

const T = keyText("en");

/** A rolling waveform that looks like speech rather than a random sawtooth. */
const SPEECH = [0.18, 0.42, 0.71, 0.55, 0.88, 0.63, 0.35, 0.52, 0.28];

type Cell = { svg: string; caption: string };

function cell(caption: string, svg: string): Cell {
  return { caption, svg };
}

const CYCLE: Cell[] = [
  cell("idle", keyImage({
    color: "#3B6FD4", style: "neon", icon: "mic",
    lines: wrapLabel("Dictate", 14), fontSize: 14,
  })),
  cell("recording", keyImage({
    color: "#C44040", style: "neon", special: "wave",
    levels: SPEECH, lines: ["0:07"], fontSize: 14,
  })),
  cell("sending", keyImage({
    color: "#B8791F", style: "neon", special: "dots",
    phase: 1, lines: [T.sending], fontSize: 12,
  })),
  cell("pasted", keyImage({
    color: "#2E8C3C", style: "neon", special: "check",
    lines: ["142", T.words], fontSizes: [22, 10], lineGap: 1,
  })),
];

const FLAVOURS: Cell[] = [
  cell("translate → es · aurora", keyImage({
    color: "#2E7D74", style: "aurora", icon: "globe",
    lines: wrapLabel("Translate", 13), fontSize: 13, badge: "ES",
  })),
  cell("formal email · ring", keyImage({
    color: "#5A4FCF", style: "ring", icon: "mail",
    lines: wrapLabel("Formal email", 13), fontSize: 13,
  })),
  cell("bullet points · neon", keyImage({
    color: "#B8791F", style: "neon", icon: "list",
    lines: wrapLabel("Bullet points", 13), fontSize: 13,
  })),
  cell("proofread · aurora", keyImage({
    color: "#7A4FA8", style: "aurora", icon: "pen",
    lines: wrapLabel("Proofread selection", 12), fontSize: 12,
  })),
];

const WARNINGS: Cell[] = [
  cell("hold to cancel", keyImage({
    color: "#C44040", style: "neon", special: "warn",
    lines: [...T.releaseCancel], fontSize: 10, lineGap: 1,
  })),
  cell("focus moved", keyImage({
    color: "#B8791F", style: "neon", special: "warn",
    lines: [...T.copied], fontSize: 11, lineGap: 1,
  })),
  cell("nothing heard", keyImage({
    color: "#B8791F", style: "neon", special: "warn",
    lines: [T.noSpeech], fontSize: 12,
  })),
  cell("policy refusal", keyImage({
    color: "#B8791F", style: "neon", special: "warn",
    lines: [...T.rawBlocked], fontSize: 11, lineGap: 1,
  })),
];

function strip(rows: Array<{ title: string; cells: Cell[] }>): string {
  const row = (r: { title: string; cells: Cell[] }) =>
    `<div class="rowtitle">${r.title}</div><div class="row">` +
    r.cells
      .map((c) => `<figure><img src="${c.svg}" width="72" height="72" alt=""><figcaption>${c.caption}</figcaption></figure>`)
      .join("") +
    `</div>`;
  return `<!doctype html><meta charset="utf-8"><style>
    body { margin:0; padding:18px 20px; background:#141418;
           font:12px "Segoe UI",Arial,sans-serif; color:#c8c8cc; }
    .rowtitle { font-size:10.5px; letter-spacing:.09em; text-transform:uppercase;
                color:#6f6f78; margin:14px 0 7px; }
    .rowtitle:first-child { margin-top:0; }
    .row { display:flex; gap:14px; }
    figure { margin:0; text-align:center; }
    img { display:block; border-radius:13px; background:#000; }
    figcaption { margin-top:5px; font-size:9.5px; color:#75757c; }
  </style>${rows.map(row).join("")}${widthFix(STRIP_WIDTH)}`;
}

// ---------------------------------------------------------------------------
// 2. The panel — the real HTML, fed the real payloads
// ---------------------------------------------------------------------------

const PRESETS = builtinPresets("en").map((p) => ({
  id: p.id,
  name: p.name,
  builtin: !!p.builtin,
  descKey: p.descKey ?? null,
  settings: p.settings,
}));

const DICTIONARY = "GitHub, JavaScript, PostgreSQL, Kubernetes, WireGuard, Grafana, PDF, API";

const INIT = {
  event: "init",
  devices: ["FIFINE Microphone (USB PnP Audio)", "Headset (CORSAIR HS80 RGB)"],
  presets: PRESETS,
  hasKey: true,
  canonTerms: DICTIONARY,
  ffmpegPath: "",
  uiLang: "en",
  contentLang: "auto",
  appLanguage: "en",
  uiLocale: "en",
  version: VERSION.version,
  versionDate: VERSION.date,
  swatches: SWATCHES,
  transcribeModels: TRANSCRIBE_MODELS,
  textModels: TEXT_MODELS,
  languages: spokenLanguages("en", "Detect (or I mix languages)"),
  targetLanguages: targetLanguages("en"),
};

/** A key that shows off the interesting half: transcription + clean-up + translation. */
const SETTINGS: ActionSettings = {
  presetId: "es",
  label: "Translate",
  micDevice: "FIFINE Microphone (USB PnP Audio)",
  shortcutAlias: "translate",
  mode: "toggle",
  // English, because the prompts follow the SPOKEN language (see prompt-text.ts) and
  // these shots have to be readable for whoever reads the README.
  language: "en",
  transcribeOn: true,
  transcribeContext: "",
  textOn: true,
  cleanup: true,
  styleMode: "translate",
  targetLanguage: "es",
  icon: "globe",
  keyStyle: "aurora",
  colorIdle: "#2E7D74",
};

const FULL = withDefaults(SETTINGS);
const TERMS = parseTerms(DICTIONARY);

const KEY_PREVIEW = {
  event: "keyPreview",
  image: keyImage({
    color: FULL.colorIdle, style: FULL.keyStyle, icon: FULL.icon,
    lines: wrapLabel(FULL.label, FULL.labelSize), fontSize: FULL.labelSize,
    lineGap: FULL.labelGap, badge: "ES",
  }),
  icons: ICON_NAMES.map((n) => ({ name: n, image: iconThumb(n, FULL.keyStyle, FULL.colorIdle) })),
  styles: KEY_STYLES.map((st) => ({ name: st, image: iconThumb(FULL.icon, st, FULL.colorIdle) })),
};

const TEXT_OPTS = {
  cleanup: FULL.cleanup,
  styleMode: FULL.styleMode,
  targetLanguage: FULL.targetLanguage,
  style: FULL.style,
  canonTerms: TERMS,
  locale: "en" as const,
};

// The same branch the plugin takes, so the screenshot cannot show a prompt the default
// model no longer receives.
const AS_KEYWORDS = supportsKeywords(FULL.transcribeModel);

const PREVIEW = {
  event: "preview",
  transcribe: {
    enabled: true,
    model: FULL.transcribeModel,
    language: FULL.language,
    prompt: buildTranscribePrompt({ terms: TERMS, context: "", useCanon: !AS_KEYWORDS }).prompt,
    dropped: 0,
    keywords: AS_KEYWORDS ? buildKeywords({ terms: TERMS, useCanon: true }).keywords : undefined,
  },
  text: {
    enabled: true,
    model: FULL.textModel,
    parts: textPromptParts(TEXT_OPTS),
  },
};

const SHORTCUT = {
  event: "shortcutState",
  alias: "translate",
  url: "streamdeck://plugins/message/com.felipe.transcritranslator/dictate?key=translate&streamdeck=hidden",
  conflictWith: null,
};

/** The panel, plus a script that plays the plugin's side of the conversation. */
async function panelPage(name: string, script: string): Promise<void> {
  const html = await readFile(join(UI, "dictation.html"), "utf8");
  // Inside DOMContentLoaded, and registered AFTER the panel's own listener, so the
  // buttons are already wired when the script clicks them. An inline script runs while
  // the document is still parsing — too early for any of this.
  const boot = `
<script>
document.addEventListener("DOMContentLoaded", () => {
  settings = ${JSON.stringify(SETTINGS)};
  handlePlugin(${JSON.stringify(INIT)});
  handlePlugin(${JSON.stringify(KEY_PREVIEW)});
  handlePlugin(${JSON.stringify(SHORTCUT)});
  ${script}
});
</script>`;
  const page = html.replace("</body>", boot + widthFix(PANEL_WIDTH) + "\n</body>");
  const file = join(WORK, `${name}.html`);
  await writeFile(file, page, "utf8");
  const height = await measure(file);
  await shot(file, PANEL_WIDTH, height, join(OUT, `${name}.png`));
  console.log(`  ${name}.png  (${PANEL_WIDTH}x${height})`);
}

// ---------------------------------------------------------------------------

if (!CHROME) {
  console.error("Chrome not found — install it or edit the CHROME list in tools/screenshots.ts");
  process.exit(1);
}

await rm(WORK, { recursive: true, force: true });
await mkdir(WORK, { recursive: true });
await mkdir(OUT, { recursive: true });
await writeFile(join(WORK, "i18n.js"), await readFile(join(UI, "i18n.js"), "utf8"), "utf8");

console.log("\nrendering:");

// The key strip.
const stripFile = join(WORK, "keys.html");
await writeFile(stripFile, strip([
  { title: "one dictation, start to finish", cells: CYCLE },
  { title: "the same key, other jobs", cells: FLAVOURS },
  { title: "when something needs saying", cells: WARNINGS },
]), "utf8");
await shot(stripFile, STRIP_WIDTH, await measure(stripFile), join(OUT, "keys.png"));
console.log("  keys.png");

// Simple mode: preset, label, live key preview, microphone, spoken language, two steps.
await panelPage("panel-simple", `
  document.body.classList.add("simple");
`);

// Capture: hold-to-talk, auto-stop, and the keyboard shortcut with its ready-made URL.
await panelPage("panel-capture", `
  document.getElementById("btnAdvanced").click();
  for (const d of document.querySelectorAll("details")) d.removeAttribute("open");
  document.getElementById("shortcutAlias").closest("details").setAttribute("open", "");
`);

// "See what will be sent" — the exact text going to OpenAI.
await panelPage("panel-prompt", `
  document.getElementById("btnAdvanced").click();
  for (const d of document.querySelectorAll("details")) d.removeAttribute("open");
  document.querySelector("#promptToggle").closest("details").setAttribute("open", "");
  document.getElementById("promptToggle").click();
  handlePlugin(${JSON.stringify(PREVIEW)});
  // The box sits far down a long section, and the screenshot always starts at the top of
  // the page — so the box becomes the page. It is the real element, untouched.
  const box = document.getElementById("promptBox");
  const keep = [...document.body.children].filter((el) => el.tagName === "STYLE" || el.tagName === "SCRIPT");
  document.body.replaceChildren(box, ...keep);
  window.__shotHeight = Math.ceil(box.getBoundingClientRect().height + 32);

`);

// Appearance: the thumbnail grids and the live key preview.
await panelPage("panel-appearance", `
  document.getElementById("btnAdvanced").click();
  for (const d of document.querySelectorAll("details")) d.removeAttribute("open");
  document.querySelector("#styleGrid").closest("details").setAttribute("open", "");
`);

// The canonical dictionary, in its own window.
await panelPage("panel-dictionary", `
  document.getElementById("dictOpen").click();
  const sheet = document.querySelector("#dictModal .sheet").getBoundingClientRect();
  window.__shotHeight = Math.ceil(sheet.bottom + 14);
`);

console.log("\ndone — docs/img/\n");
