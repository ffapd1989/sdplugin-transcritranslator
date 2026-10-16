// Generates the README screenshots — docs/img/*.png.
//
// It is NOT a mockup. The key strip comes out of `keyImage()`, the same function the
// physical key uses, and the panel shots are the real `ui/dictation.html` fed with the
// same payloads the plugin sends over `sendToPropertyInspector`. If the interface
// changes, `npm run shots` reprints the truth; a hand-made screenshot would start lying
// the next day.
//
//   npm run shots          English, into docs/img/ and docs/marketplace/
//   npm run shots -- pt    the same in Portuguese (or es), into docs/img/pt/ and docs/marketplace/pt/
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
import type { Locale } from "../src/lib/prompt-text.js";

const LOCALE = (process.argv[2] ?? "en") as Locale;
if (!["pt", "en", "es"].includes(LOCALE)) {
  console.error(`Unknown language "${LOCALE}" — use pt, en or es`);
  process.exit(1);
}

const ROOT = process.cwd();
const UI = join(ROOT, "com.felipe.transcritranslator.sdPlugin", "ui");
const SUBFOLDER = LOCALE === "en" ? "" : LOCALE;
const OUT = join(ROOT, "docs", "img", SUBFOLDER);
const MARKET = join(ROOT, "docs", "marketplace", SUBFOLDER);
const WORK = join(ROOT, "node_modules", ".cache", "shots");

/** What the window reads in the panel's own language, from the panel's own table. */
const I18N: { TT_I18N?: Record<Locale, Record<string, string>> } = {};
new Function("window", await readFile(join(UI, "i18n.js"), "utf8"))(I18N);
const UI_TEXT = I18N.TT_I18N![LOCALE];

/**
 * The words these pictures need that the plugin itself never says: the slide copy, the
 * captions under the keys and the fake hardware names. The key labels are the ones a
 * person would type on that key in that language.
 */
const COPY: Record<Locale, {
  target: string;
  alias: string;
  devices: [string, string];
  labels: { dictate: string; translate: string; email: string; topics: string; proofread: string };
  cycle: [string, string, string, string];
  flavours: [string, string, string, string];
  warnings: [string, string, string, string];
  rows: [string, string, string];
  thumbnail: { tagline: string; chips: [string, string, string]; small: string };
  slides: Record<"dictate" | "jobs" | "setup" | "prompts" | "look", { kicker: string; title: string; body: string }>;
}> = {
  en: {
    target: "es",
    alias: "translate",
    devices: ["Microphone (USB Audio Device)", "Headset Microphone"],
    labels: { dictate: "Dictate", translate: "Translate", email: "Formal email", topics: "Bullet points", proofread: "Proofread selection" },
    cycle: ["idle", "recording", "sending", "pasted"],
    flavours: ["translate → es · aurora", "formal email · ring", "bullet points · neon", "proofread · aurora"],
    warnings: ["hold to cancel", "focus moved", "nothing heard", "policy refusal"],
    rows: ["one dictation, start to finish", "the same key, other jobs", "when something needs saying"],
    thumbnail: {
      tagline: "Voice dictation on a Stream Deck key.",
      chips: ["Transcribe", "Translate", "Rewrite"],
      small: "Uses your own OpenAI API key · Windows",
    },
    slides: {
      dictate: {
        kicker: "Dictate anywhere",
        title: "Press, speak, press again.",
        body: `<p>The text lands in the field you were typing in — and only there: switch windows and it is
          copied instead of pasted.</p>`,
      },
      jobs: {
        kicker: "One key, three jobs",
        title: "Transcribe, translate, rewrite.",
        body: `<ul><li>Clean-up: punctuation, no fillers</li><li>28 target languages, from a list</li>
          <li>Your own instruction per key</li><li>A dictionary for your spelling</li></ul>`,
      },
      setup: {
        kicker: "No terminal needed",
        title: "Set up from the panel.",
        body: `<ul><li>ffmpeg found, or installed in one click</li><li>OpenAI key stored with Windows DPAPI</li>
          <li>Panel in English, Portuguese and Spanish</li></ul>`,
      },
      prompts: {
        kicker: "No hidden prompts",
        title: "See exactly what is sent.",
        body: `<p>Every block of text that goes to OpenAI, in both steps, readable before you dictate.</p>`,
      },
      look: {
        kicker: "Make the key yours",
        title: "Three styles, eighteen icons.",
        body: `<p>Colours per state, a live preview, and the label you want.</p>`,
      },
    },
  },
  pt: {
    target: "en",
    alias: "traduzir",
    devices: ["Microfone (USB Audio Device)", "Microfone do headset"],
    labels: { dictate: "Ditar", translate: "Traduzir", email: "E-mail formal", topics: "Tópicos", proofread: "Revisar seleção" },
    cycle: ["em espera", "gravando", "enviando", "colado"],
    flavours: ["traduzir → en · aurora", "e-mail formal · ring", "tópicos · neon", "revisar · aurora"],
    warnings: ["segure para cancelar", "janela trocada", "nada ouvido", "recusa da política"],
    rows: ["um ditado, do começo ao fim", "a mesma tecla, outros trabalhos", "quando algo precisa ser dito"],
    thumbnail: {
      tagline: "Ditado por voz numa tecla do Stream Deck.",
      chips: ["Transcrever", "Traduzir", "Reescrever"],
      small: "Usa a sua própria chave da API da OpenAI · Windows",
    },
    slides: {
      dictate: {
        kicker: "Dite em qualquer lugar",
        title: "Aperte, fale, aperte de novo.",
        body: `<p>O texto aparece no campo em que você estava digitando — e só nele: se trocar de janela,
          ele é copiado em vez de colado.</p>`,
      },
      jobs: {
        kicker: "Uma tecla, três trabalhos",
        title: "Transcrever, traduzir, reescrever.",
        body: `<ul><li>Limpeza: pontuação, sem hesitações</li><li>28 idiomas de destino, numa lista</li>
          <li>Uma instrução sua em cada tecla</li><li>Um dicionário para a sua grafia</li></ul>`,
      },
      setup: {
        kicker: "Sem terminal",
        title: "Configure pelo painel.",
        body: `<ul><li>ffmpeg encontrado, ou instalado com um clique</li><li>Chave da OpenAI guardada com o DPAPI do Windows</li>
          <li>Painel em português, inglês e espanhol</li></ul>`,
      },
      prompts: {
        kicker: "Nenhum prompt escondido",
        title: "Veja exatamente o que é enviado.",
        body: `<p>Cada bloco de texto que vai para a OpenAI, nas duas etapas, legível antes de você ditar.</p>`,
      },
      look: {
        kicker: "A tecla do seu jeito",
        title: "Três estilos, dezoito ícones.",
        body: `<p>Cores por estado, prévia ao vivo e o rótulo que você quiser.</p>`,
      },
    },
  },
  es: {
    target: "en",
    alias: "traducir",
    devices: ["Micrófono (USB Audio Device)", "Micrófono del auricular"],
    labels: { dictate: "Dictar", translate: "Traducir", email: "Correo formal", topics: "Viñetas", proofread: "Revisar selección" },
    cycle: ["en reposo", "grabando", "enviando", "pegado"],
    flavours: ["traducir → en · aurora", "correo formal · ring", "viñetas · neon", "revisar · aurora"],
    warnings: ["mantén para cancelar", "ventana cambiada", "nada oído", "rechazo de política"],
    rows: ["un dictado, de principio a fin", "la misma tecla, otros trabajos", "cuando hay algo que decir"],
    thumbnail: {
      tagline: "Dictado por voz en una tecla del Stream Deck.",
      chips: ["Transcribir", "Traducir", "Reescribir"],
      small: "Usa tu propia clave de API de OpenAI · Windows",
    },
    slides: {
      dictate: {
        kicker: "Dicta en cualquier sitio",
        title: "Pulsa, habla, pulsa otra vez.",
        body: `<p>El texto aparece en el campo donde estabas escribiendo — y solo ahí: si cambias de ventana,
          se copia en lugar de pegarse.</p>`,
      },
      jobs: {
        kicker: "Una tecla, tres trabajos",
        title: "Transcribir, traducir, reescribir.",
        body: `<ul><li>Limpieza: puntuación, sin muletillas</li><li>28 idiomas de destino, en una lista</li>
          <li>Tu propia instrucción en cada tecla</li><li>Un diccionario para tu ortografía</li></ul>`,
      },
      setup: {
        kicker: "Sin terminal",
        title: "Configura desde el panel.",
        body: `<ul><li>ffmpeg encontrado, o instalado con un clic</li><li>Clave de OpenAI guardada con DPAPI de Windows</li>
          <li>Panel en español, inglés y portugués</li></ul>`,
      },
      prompts: {
        kicker: "Ningún prompt oculto",
        title: "Mira exactamente qué se envía.",
        body: `<p>Cada bloque de texto que va a OpenAI, en los dos pasos, legible antes de dictar.</p>`,
      },
      look: {
        kicker: "La tecla a tu manera",
        title: "Tres estilos, dieciocho iconos.",
        body: `<p>Colores por estado, vista previa en vivo y la etiqueta que quieras.</p>`,
      },
    },
  },
};
const WORDS = COPY[LOCALE];
const BADGE = WORDS.target.toUpperCase();

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

const T = keyText(LOCALE);

/** A rolling waveform that looks like speech rather than a random sawtooth. */
const SPEECH = [0.18, 0.42, 0.71, 0.55, 0.88, 0.63, 0.35, 0.52, 0.28];

type Cell = { svg: string; caption: string };

function cell(caption: string, svg: string): Cell {
  return { caption, svg };
}

const CYCLE: Cell[] = [
  cell(WORDS.cycle[0], keyImage({
    color: "#3B6FD4", style: "neon", icon: "mic",
    lines: wrapLabel(WORDS.labels.dictate, 14), fontSize: 14,
  })),
  cell(WORDS.cycle[1], keyImage({
    color: "#C44040", style: "neon", special: "wave",
    levels: SPEECH, lines: ["0:07"], fontSize: 14,
  })),
  cell(WORDS.cycle[2], keyImage({
    color: "#B8791F", style: "neon", special: "dots",
    phase: 1, lines: [T.sending], fontSize: 12,
  })),
  cell(WORDS.cycle[3], keyImage({
    color: "#2E8C3C", style: "neon", special: "check",
    lines: ["142", T.words], fontSizes: [22, 10], lineGap: 1,
  })),
];

const FLAVOURS: Cell[] = [
  cell(WORDS.flavours[0], keyImage({
    color: "#2E7D74", style: "aurora", icon: "globe",
    lines: wrapLabel(WORDS.labels.translate, 13), fontSize: 13, badge: BADGE,
  })),
  cell(WORDS.flavours[1], keyImage({
    color: "#5A4FCF", style: "ring", icon: "mail",
    lines: wrapLabel(WORDS.labels.email, 13), fontSize: 13,
  })),
  cell(WORDS.flavours[2], keyImage({
    color: "#B8791F", style: "neon", icon: "list",
    lines: wrapLabel(WORDS.labels.topics, 13), fontSize: 13,
  })),
  cell(WORDS.flavours[3], keyImage({
    color: "#7A4FA8", style: "aurora", icon: "pen",
    lines: wrapLabel(WORDS.labels.proofread, 12), fontSize: 12,
  })),
];

const WARNINGS: Cell[] = [
  cell(WORDS.warnings[0], keyImage({
    color: "#C44040", style: "neon", special: "warn",
    lines: [...T.releaseCancel], fontSize: 10, lineGap: 1,
  })),
  cell(WORDS.warnings[1], keyImage({
    color: "#B8791F", style: "neon", special: "warn",
    lines: [...T.copied], fontSize: 11, lineGap: 1,
  })),
  cell(WORDS.warnings[2], keyImage({
    color: "#B8791F", style: "neon", special: "warn",
    lines: [T.noSpeech], fontSize: 12,
  })),
  cell(WORDS.warnings[3], keyImage({
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

const PRESETS = builtinPresets(LOCALE).map((p) => ({
  id: p.id,
  name: p.name,
  builtin: !!p.builtin,
  descKey: p.descKey ?? null,
  settings: p.settings,
}));

const DICTIONARY = "GitHub, JavaScript, PostgreSQL, Kubernetes, WireGuard, Grafana, PDF, API";

const INIT = {
  event: "init",
  devices: WORDS.devices,
  presets: PRESETS,
  hasKey: true,
  ffmpeg: { found: true, path: "ffmpeg", version: "9.0.1-essentials_build-www.gyan.dev", winget: true, installing: false },
  canonTerms: DICTIONARY,
  ffmpegPath: "",
  uiLang: LOCALE,
  contentLang: "auto",
  appLanguage: LOCALE,
  uiLocale: LOCALE,
  autoUiLocale: LOCALE,
  version: VERSION.version,
  versionDate: VERSION.date,
  swatches: SWATCHES,
  transcribeModels: TRANSCRIBE_MODELS,
  textModels: TEXT_MODELS,
  languages: spokenLanguages(LOCALE, UI_TEXT.langDetect),
  targetLanguages: targetLanguages(LOCALE),
};

/** A key that shows off the interesting half: transcription + clean-up + translation. */
const SETTINGS: ActionSettings = {
  presetId: WORDS.target,
  label: WORDS.labels.translate,
  micDevice: WORDS.devices[0],
  shortcutAlias: WORDS.alias,
  mode: "toggle",
  // The shots' own language, because the prompts follow the SPOKEN language (see
  // prompt-text.ts) and they have to be readable for whoever looks at them.
  language: LOCALE,
  transcribeOn: true,
  transcribeContext: "",
  textOn: true,
  cleanup: true,
  styleMode: "translate",
  targetLanguage: WORDS.target,
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
    lineGap: FULL.labelGap, badge: BADGE,
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
  locale: LOCALE,
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
  alias: WORDS.alias,
  url: `streamdeck://plugins/message/com.felipe.transcritranslator/dictate?key=${WORDS.alias}&streamdeck=hidden`,
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
  { title: WORDS.rows[0], cells: CYCLE },
  { title: WORDS.rows[1], cells: FLAVOURS },
  { title: WORDS.rows[2], cells: WARNINGS },
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

// A machine with no ffmpeg: the warning on top and the guide that installs it.
await panelPage("panel-ffmpeg", `
  handlePlugin({ event: "ffmpegState", found: false, path: "", version: "", winget: true, installing: false });
  document.querySelector(".ffHelp").click();
  const sheet = document.querySelector("#ffModal .sheet").getBoundingClientRect();
  window.__shotHeight = Math.ceil(sheet.bottom + 14);
`);

// The canonical dictionary, in its own window.
await panelPage("panel-dictionary", `
  document.getElementById("dictOpen").click();
  const sheet = document.querySelector("#dictModal .sheet").getBoundingClientRect();
  window.__shotHeight = Math.ceil(sheet.bottom + 14);
`);

// ---------------------------------------------------------------------------
// 3. The Marketplace listing — thumbnail, gallery and app icon
// ---------------------------------------------------------------------------
//
// Same rule as above: the keys are `keyImage()` and the panels are the PNGs just rendered
// from the real `dictation.html`. Elgato asks for 1920×960 PNGs with English text only, and a
// 288×288 app icon. Rendered at scale 1, because that size IS the deliverable.

await mkdir(MARKET, { recursive: true });

const SLIDE_CSS = `
  * { box-sizing: border-box; }
  body { margin:0; width:1920px; height:960px; overflow:hidden; background:
         radial-gradient(1200px 700px at 78% 40%, #1d2340 0%, #111116 60%, #0c0c10 100%);
         font-family:"Segoe UI",Arial,sans-serif; color:#eef0f5; }
  .wrap { display:flex; align-items:center; gap:90px; height:960px; padding:0 120px; }
  .text { flex:0 0 640px; }
  .kicker { font-size:26px; letter-spacing:.14em; text-transform:uppercase; color:#7f9be6; margin-bottom:22px; }
  h1 { font-size:84px; line-height:1.04; margin:0 0 28px; font-weight:700; letter-spacing:-.01em; }
  p { font-size:34px; line-height:1.4; color:#b9bfcc; margin:0 0 18px; }
  ul { margin:26px 0 0; padding:0; list-style:none; }
  li { font-size:31px; color:#d7dbe4; margin:0 0 16px; padding-left:42px; position:relative; }
  li::before { content:""; position:absolute; left:0; top:14px; width:18px; height:18px;
               border-radius:5px; background:#3b6fd4; }
  .art { flex:1; display:flex; align-items:center; justify-content:center; gap:34px; }
  .key { border-radius:34px; background:#000; box-shadow:0 18px 60px rgba(0,0,0,.55); display:block; }
  .cap { text-align:center; font-size:24px; color:#8d93a0; margin-top:14px; }
  .panel { border-radius:14px; box-shadow:0 22px 70px rgba(0,0,0,.6); border:1px solid #2c2f3a;
           overflow:hidden; background:#2d2d2d; }
  .panel img { display:block; }
  .chips { display:flex; gap:14px; margin-top:34px; }
  .chip { font-size:28px; padding:10px 24px; border-radius:40px; background:#1f2740; color:#cfdaf7;
          border:1px solid #33427a; }
  .small { font-size:24px; color:#7d8391; margin-top:40px; }`;

const keyTag = (svg: string, size: number, caption?: string) =>
  `<figure style="margin:0"><img class="key" src="${svg}" width="${size}" height="${size}" alt="">` +
  (caption ? `<div class="cap">${caption}</div>` : "") + `</figure>`;

/** A panel PNG (2x) shown at `width` CSS px, cropped to `height` from the top. */
const panelTag = (file: string, width: number, height: number) =>
  `<div class="panel" style="width:${width}px;height:${height}px">` +
  `<img src="${url(join(OUT, file))}" width="${width}" alt=""></div>`;

async function slide(name: string, text: string, art: string): Promise<void> {
  const file = join(WORK, `market-${name}.html`);
  await writeFile(file, `<!doctype html><meta charset="utf-8"><style>${SLIDE_CSS}</style>` +
    `<div class="wrap"><div class="text">${text}</div><div class="art">${art}</div></div>`, "utf8");
  await chrome(["--force-device-scale-factor=1", "--window-size=1920,960",
    `--screenshot=${join(MARKET, `${name}.png`)}`, url(file)]);
  console.log(`  marketplace/${name}.png`);
}

const STYLES = KEY_STYLES.map((st) => keyImage({
  color: "#3B6FD4", style: st, icon: "mic", lines: wrapLabel(WORDS.labels.dictate, 14), fontSize: 14,
}));

const slideText = (name: keyof typeof WORDS.slides) =>
  `<div class="kicker">${WORDS.slides[name].kicker}</div>` +
  `<h1>${WORDS.slides[name].title}</h1>${WORDS.slides[name].body}`;

await slide("thumbnail", `
  <h1>TranscriTranslator</h1>
  <p>${WORDS.thumbnail.tagline}</p>
  <div class="chips">${WORDS.thumbnail.chips.map((chip) => `<span class="chip">${chip}</span>`).join("")}</div>
  <div class="small">${WORDS.thumbnail.small}</div>`,
  `<div style="display:grid;grid-template-columns:repeat(2,250px);gap:34px">
    ${keyTag(CYCLE[0].svg, 250)}${keyTag(CYCLE[1].svg, 250)}${keyTag(FLAVOURS[0].svg, 250)}${keyTag(CYCLE[3].svg, 250)}
  </div>`);

await slide("gallery-1-dictate", slideText("dictate"),
  CYCLE.map((c) => keyTag(c.svg, 190, c.caption)).join(""));

await slide("gallery-2-jobs", slideText("jobs"),
  `<div style="display:grid;grid-template-columns:repeat(2,210px);gap:30px">
    ${FLAVOURS.map((c) => keyTag(c.svg, 210)).join("")}</div>
   ${panelTag("panel-simple.png", 400, 760)}`);

await slide("gallery-3-setup", slideText("setup"),
  panelTag("panel-ffmpeg.png", 470, 730));

await slide("gallery-4-prompts", slideText("prompts"),
  panelTag("panel-prompt.png", 470, 760));

await slide("gallery-5-look", slideText("look") +
  `<div style="display:flex;gap:26px;margin-top:34px">${STYLES.map((s) => keyTag(s, 150)).join("")}</div>`,
  panelTag("panel-appearance.png", 440, 760));

// The app icon: the key's own neon microphone, no label — a mark, not a screenshot.
const iconFile = join(WORK, "market-icon.html");
await writeFile(iconFile, `<!doctype html><style>body{margin:0;background:#0c0c10}</style>` +
  `<img src="${keyImage({ color: "#3B6FD4", style: "neon", icon: "mic", lines: [] })}" width="288" height="288" style="display:block">`, "utf8");
await chrome(["--force-device-scale-factor=1", "--window-size=288,288",
  `--screenshot=${join(MARKET, "app-icon.png")}`, url(iconFile)]);
console.log("  marketplace/app-icon.png");

console.log(`\ndone — ${OUT} and ${MARKET}\n`);
