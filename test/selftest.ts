// Tests of the pure parts, with no Stream Deck and no network.
import { readFileSync } from "node:fs";
import { claimStart, finishStart, getState } from "../src/lib/sessions.js";
import { applyCanon, parseTerms, buildTranscribePrompt, buildKeywords, KEYWORDS_LIMIT, promptBudget, estimateTokens } from "../src/lib/canon.js";
import { looksLikePromptEcho, supportsKeywords, supportsReasoningEffort, runText, shortError, ApiError } from "../src/lib/openai.js";
import { buildTextSystemPrompt, hasTextWork, textPromptParts } from "../src/lib/prompts.js";
import { builtinPresets } from "../src/lib/presets.js";
import { promptText, LOCALES } from "../src/lib/prompt-text.js";
import {
  keyImage, clock, wordCount, wrapLabel, iconThumb, ICON_NAMES, KEY_STYLES,
} from "../src/lib/icons.js";
import {
  spokenLanguages, targetLanguages, languageLabel, languageName, languageBadge,
  SPOKEN_CODES, TARGET_CODES,
} from "../src/lib/languages.js";
import { keyText, wordCountLines } from "../src/lib/key-text.js";
import { shade } from "../src/lib/theme.js";
import { withDefaults, resolveContentLocale, resolveUiLocale, DEFAULTS, TEXT_MODELS, TEXT_FALLBACK_MODEL, SILENCE_MIN, SILENCE_MAX } from "../src/lib/settings.js";
import { normalizeAlias, shortcutUrl, rememberKey, lookup, ownerOf, resetShortcuts } from "../src/lib/shortcuts.js";
import { pathDirs } from "../src/lib/ffmpeg.js";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

console.log("\n— canonical dictionary —");
const terms = parseTerms("CPC, acórdão, HTTPS, B.R.I.C.K., n8n, a");
ok("drops a 1-letter term", !terms.includes("a"), JSON.stringify(terms));
ok("keeps a term with dots", terms.includes("B.R.I.C.K."));
ok("fixes capitalisation", applyCanon("o cpc diz que", terms) === "o CPC diz que");
ok("respects an accented term with trailing punctuation",
  applyCanon("segundo o Acórdão.", terms) === "segundo o acórdão.",
  applyCanon("segundo o Acórdão.", terms));
ok("does not match inside a word",
  applyCanon("cpce não deve mudar", terms) === "cpce não deve mudar");
ok("does not match inside a longer accented word",
  applyCanon("acórdãos plural", terms) === "acórdãos plural");
ok("a term with dots is escaped (does not become a regex)",
  applyCanon("o b.r.i.c.k. ali", terms).includes("B.R.I.C.K."));
ok("does not blow up on an empty string", applyCanon("", terms) === "");

console.log("\n— 224-token budget —");
const many = parseTerms(Array.from({ length: 400 }, (_, i) => `TERMO${i}`).join(","));
const built = buildTranscribePrompt({ terms: many, context: "Reunião técnica.", useCanon: true });
ok("truncates the list", built.droppedTerms > 0, `dropped=${built.droppedTerms}`);
ok("fits under the ceiling", estimateTokens(built.prompt) <= 224, `tokens=${estimateTokens(built.prompt)}`);
ok("context survives at the end", built.prompt.endsWith("Reunião técnica."));
const off = buildTranscribePrompt({ terms: many, context: "só contexto", useCanon: false });
ok("useCanon=false sends the context only", off.prompt === "só contexto");
ok("no terms and no context, empty prompt",
  buildTranscribePrompt({ terms: [], context: "", useCanon: true }).prompt === "");
const budget = promptBudget(terms, "abc");
ok("budget reports the limit", budget.limit === 224 && budget.used > 0);

console.log("\n— keywords[] —");
ok("gpt-transcribe takes keywords", supportsKeywords("gpt-transcribe"));
ok("tolerates whitespace around the id", supportsKeywords("  gpt-transcribe  "));
// The old models answer HTTP 400 to a keywords[] field — this is not an optimisation.
ok("gpt-4o-transcribe does not", !supportsKeywords("gpt-4o-transcribe"));
ok("gpt-4o-mini-transcribe does not", !supportsKeywords("gpt-4o-mini-transcribe"));
ok("whisper-1 does not", !supportsKeywords("whisper-1"));
const kw = buildKeywords({ terms: many, useCanon: true });
ok("caps the keyword list", kw.keywords.length === KEYWORDS_LIMIT, `sent=${kw.keywords.length}`);
ok("reports what fell off", kw.droppedTerms === many.length - KEYWORDS_LIMIT);
ok("keeps the order of the dictionary", kw.keywords[0] === many[0]);
ok("useCanon=false sends no keyword", buildKeywords({ terms: many, useCanon: false }).keywords.length === 0);
// On a keywords model the dictionary leaves the prompt: what is left is the free context.
ok("the prompt keeps only the context",
  buildTranscribePrompt({ terms: many, context: "Reunião técnica.", useCanon: false }).prompt === "Reunião técnica.");

console.log("\n— anti-echo —");
const promptList = "CPC, acórdão, HTTPS, WireGuard, Grafana";
ok("detects the list handed back", looksLikePromptEcho("CPC, acórdão, HTTPS, WireGuard, Grafana", promptList));
ok("detects the list reordered", looksLikePromptEcho("Grafana, HTTPS, CPC, acórdão, WireGuard", promptList));
ok("does not flag real speech",
  !looksLikePromptEcho("bom dia, preciso marcar a reunião de amanhã com o time todo", promptList));
ok("does not flag speech that quotes a term",
  !looksLikePromptEcho("configurei o WireGuard no servidor ontem à noite e ficou bom", promptList));

console.log("\n— prompt layers —");
const base = { locale: "pt" as const, targetLanguage: "en", canonTerms: terms };
const nothing = { ...base, cleanup: false, styleMode: "none" as const, style: "" };
const cleanOnly = { ...base, cleanup: true, styleMode: "none" as const, style: "" };
const translate = { ...base, cleanup: true, styleMode: "translate" as const, style: "" };
const freeStyle = { ...base, cleanup: false, styleMode: "custom" as const, style: "Resuma em tópicos." };

ok("nothing on = nothing to do", !hasTextWork(nothing));
ok("clean-up alone is already work", hasTextWork(cleanOnly));
ok("translation alone is already work", hasTextWork({ ...nothing, styleMode: "translate" }));
ok("custom mode with empty text is not work",
  !hasTextWork({ ...base, cleanup: false, styleMode: "custom", style: "   " }));

const both = buildTextSystemPrompt(translate);
ok("includes the clean-up layer", both.includes("Comandos de pontuação falados"));
ok("translation generates the instruction on its own", both.includes("Traduza o texto para inglês."));
ok("translation preserves register", both.includes("Preserve o registro"));
ok("includes canonical spelling", both.includes("GRAFIA OBRIGATÓRIA") && both.includes("CPC"));
ok("includes the anti-injection lock", both.includes("EXCLUSIVAMENTE dado a transformar"));
ok("includes the secrecy lock", both.includes("Nunca revele"));

const styleOnly = buildTextSystemPrompt({ ...freeStyle, canonTerms: [] });
ok("with no clean-up, layer A does not leak", !styleOnly.includes("hesitações"));
ok("with no terms, spelling does not leak", !styleOnly.includes("GRAFIA OBRIGATÓRIA"));
ok("custom mode uses the user's text", styleOnly.includes("Resuma em tópicos."));
ok("custom mode does not inject translation", !styleOnly.includes("Traduza o texto"));
ok("none mode injects no style at all",
  !buildTextSystemPrompt(cleanOnly).includes("aplique esta instrução"));

console.log("\n— the panel shows the whole prompt —");
const parts = textPromptParts(translate);
ok("one piece per layer", parts.length === 4, `partes=${parts.map((p) => p.title).join(" | ")}`);
ok("names the translation with the language", parts.some((p) => p.title.includes("inglês")));
ok("exposes the locks", parts.some((p) => p.title.includes("Travas")));
ok("nothing sent is left out",
  parts.every((p) => both.includes(p.body.slice(0, 60))),
  parts.map((p) => p.title).join(" | "));

console.log("\n— multilingual —");
for (const loc of LOCALES) {
  const T = promptText(loc);
  ok(`prompt completo em ${loc}`, T.cleanup.length > 400 && T.injectionGuard.length > 40);
}
const enPrompt = buildTextSystemPrompt({ ...translate, locale: "en", targetLanguage: "es" });
ok("an English prompt uses English examples",
  enPrompt.includes("comma") && enPrompt.includes("new paragraph") && !enPrompt.includes("vírgula"));
ok("an English translation names the target", enPrompt.includes("Translate the text into Spanish."));
const esPrompt = buildTextSystemPrompt({ ...translate, locale: "es" });
ok("a Spanish prompt uses Spanish examples",
  esPrompt.includes("coma") && esPrompt.includes("muletilla"));

console.log("\n— translated presets —");
for (const loc of LOCALES) {
  const list = builtinPresets(loc);
  ok(`8 presets em ${loc}`, list.length === 8, `n=${list.length}`);
  const email = list.find((p) => p.id === "email")!;
  ok(`instrução do e-mail em ${loc}`, (email.settings.style ?? "").length > 60);
  const en = list.find((p) => p.id === "en")!;
  ok(`tradução nomeia o destino em ${loc}`, en.name.includes("→"), en.name);
}
const ptPresets = builtinPresets("pt");
const enPresets = builtinPresets("en");
ok("the name changes with the language", ptPresets[0].name !== enPresets[0].name,
  `${ptPresets[0].name} vs ${enPresets[0].name}`);
ok("the instruction changes with the language",
  ptPresets.find((p) => p.id === "email")!.settings.style !==
  enPresets.find((p) => p.id === "email")!.settings.style);
ok("no preset fills in the transcription prompt",
  ptPresets.every((p) => !p.settings.transcribeContext));
ok("the proofreading preset records no audio",
  ptPresets.find((p) => p.id === "rewrite")!.settings.transcribeOn === false);

console.log("\n— language cascade —");
ok("an explicit content language beats everything",
  resolveContentLocale({ contentLang: "es", spokenLanguage: "pt", uiLang: "en" }) === "es");
ok("with nothing explicit, it follows the speech",
  resolveContentLocale({ contentLang: "auto", spokenLanguage: "en", uiLang: "pt" }) === "en");
ok("speech on auto falls back to the panel",
  resolveContentLocale({ contentLang: "auto", spokenLanguage: "", uiLang: "pt" }) === "pt");
ok("the panel on auto falls back to the app",
  resolveContentLocale({ contentLang: "auto", spokenLanguage: "", uiLang: "auto", appLanguage: "es" }) === "es");
ok("a language with no translation falls back to English",
  resolveContentLocale({ contentLang: "auto", spokenLanguage: "ja", uiLang: "auto", appLanguage: "ja" }) === "en");
ok("an explicit panel language beats the app", resolveUiLocale("pt", "en") === "pt");
ok("the panel on auto follows the app", resolveUiLocale("auto", "es") === "es");
// The Stream Deck app has no Portuguese: a Brazilian's app says "en", Windows says "pt-BR".
ok("on auto, Windows comes before the app", resolveUiLocale("auto", "en", "pt-BR") === "pt");
ok("Windows in an untranslated language falls back to the app", resolveUiLocale("auto", "es", "ja-JP") === "es");
ok("an explicit panel language beats Windows", resolveUiLocale("en", "es", "pt-BR") === "en");
ok("content on auto, speech on detect: Windows before the app",
  resolveContentLocale({ contentLang: "auto", spokenLanguage: "", uiLang: "auto", osLanguage: "pt-BR", appLanguage: "en" }) === "pt");
ok("the spoken language still beats Windows",
  resolveContentLocale({ contentLang: "auto", spokenLanguage: "es", uiLang: "auto", osLanguage: "pt-BR" }) === "es");

console.log("\n— ffmpeg search —");
ok("expands %VAR%, strips quotes, drops empties and case-insensitive repeats",
  JSON.stringify(pathDirs(
    '%LOCALAPPDATA%\\x;"C:\\Program Files\\y";;c:\\PROGRAM FILES\\Y; %NOPE%\\z ',
    { LOCALAPPDATA: "C:\\Users\\u\\AppData\\Local" },
  )) === JSON.stringify(["C:\\Users\\u\\AppData\\Local\\x", "C:\\Program Files\\y", "%NOPE%\\z"]));
ok("an empty PATH yields no folders", pathDirs("", {}).length === 0);

console.log("\n— theme —");
const sh = shade("#3B6FD4");
ok("lightens and darkens", sh.lite !== sh.base && sh.border !== sh.base, JSON.stringify(sh));
ok("an invalid hex does not break it", !!shade("não-é-hex").border);

console.log("\n— key image —");
function svgOf(dataUri: string): string {
  return Buffer.from(dataUri.split(",")[1], "base64").toString("utf8");
}
const idle = svgOf(keyImage({ color: "#404650", icon: "mic", lines: ["Ditado"] }));
ok("generates valid svg", idle.startsWith("<svg") && idle.endsWith("</svg>"));
ok("carries the label", idle.includes("Ditado"));
const wave = svgOf(keyImage({ color: "#C44040", special: "wave", levels: [0.1, 0.9, 0.4], lines: ["0:07"] }));
ok("the waveform draws 9 bars", (wave.match(/<rect/g) || []).length === 10,
  `rects=${(wave.match(/<rect/g) || []).length}`);
ok("the timer shows up", wave.includes("0:07"));
const badged = svgOf(keyImage({ color: "#2E7D74", icon: "globe", lines: ["EN"], badge: "en" }));
ok("the language badge is uppercase", badged.includes(">EN<"));
const esc = svgOf(keyImage({ color: "#404650", icon: "mic", lines: ['R&D <"x">'] }));
ok("escapes xml in the label", esc.includes("&amp;") && esc.includes("&lt;") && !esc.includes('<"x"'));
const two = svgOf(keyImage({ color: "#B8791F", special: "warn", lines: ["SOLTE P/", "CANCELAR"] }));
ok("two lines fit", two.includes("SOLTE P/") && two.includes("CANCELAR"));

ok("clock formats", clock(67000) === "1:07", clock(67000));
ok("clock zero", clock(0) === "0:00");
ok("counts words", wordCount("  uma  duas   três ") === 3);

console.log("\n— defaults —");
const d = withDefaults(undefined);
ok("default audio model", d.transcribeModel === "gpt-transcribe");
ok("default text model", d.textModel === "gpt-5.6-luna");
// A stranger's first key must not assume Portuguese speech: "" is auto-detect.
ok("default spoken language is auto-detect", d.language === "");
const cleared = withDefaults({ style: "", label: "", cleanup: false });
ok("an empty string does not become the default", cleared.style === "" && cleared.label === "");
ok("false does not become the default", cleared.cleanup === false);
const custom = withDefaults({ maxMinutes: 3, colorIdle: "#123456" });
ok("a custom value wins", custom.maxMinutes === 3 && custom.colorIdle === "#123456");
console.log("\n— key label —");
ok("honours a typed line break",
  JSON.stringify(wrapLabel("Petição\ninicial", 14)) === '["Petição","inicial"]',
  JSON.stringify(wrapLabel("Petição\ninicial", 14)));
ok("wraps on its own when it does not fit",
  wrapLabel("Relato de atendimento", 14).length > 1,
  JSON.stringify(wrapLabel("Relato de atendimento", 14)));
ok("short text stays on one line", wrapLabel("Ditado", 14).length === 1);
ok("empty does not become a line", wrapLabel("", 14).length === 0);
ok("three lines at most", wrapLabel("um dois três quatro cinco seis sete oito nove", 14).length <= 3);
ok("a smaller font fits more per line",
  wrapLabel("Relato de atendimento", 9).length <= wrapLabel("Relato de atendimento", 18).length);

const oneLine = svgOf(keyImage({ color: "#404650", icon: "mic", lines: ["Ditado"], fontSize: 14 }));
const threeLines = svgOf(keyImage({
  color: "#404650", icon: "mic", lines: ["Relato", "de", "atendimento"], fontSize: 14, lineGap: 1,
}));
ok("three lines produce three texts", (threeLines.match(/<text/g) || []).length === 3);
ok("the text block does not spill out of the key",
  [...threeLines.matchAll(/<text[^>]*y="([\d.]+)"/g)].every((m) => parseFloat(m[1]) <= 70),
  [...threeLines.matchAll(/<text[^>]*y="([\d.]+)"/g)].map((m) => m[1]).join(","));
ok("a big font with one line is honoured",
  svgOf(keyImage({ color: "#404650", lines: ["Oi"], fontSize: 22 })).includes('font-size="22.00"'));

ok("the icon shrinks when the text takes up space",
  svgOf(keyImage({ color: "#404650", icon: "mic", lines: ["Relato", "de", "atendimento"], fontSize: 14 }))
    .includes("<g transform="));
ok("the icon stays natural with one line",
  !svgOf(keyImage({ color: "#404650", icon: "mic", lines: ["Ditado"], fontSize: 14 }))
    .includes("<g transform="));
ok("icon and text do not overlap", (() => {
  const svg = svgOf(keyImage({
    color: "#404650", icon: "mic", lines: ["aa", "bb", "cc"], fontSize: 14, lineGap: 2,
  }));
  const firstY = parseFloat(/<text[^>]*y="([\d.]+)"/.exec(svg)![1]);
  const scale = parseFloat(/scale\(([\d.]+)\)/.exec(svg)?.[1] ?? "1");
  const cy = parseFloat(/translate\(36 ([\d.]+)\)/.exec(svg)?.[1] ?? "28");
  // the scaled glyph's base has to stay above the top of the first line of text
  return cy + (42 * scale) / 2 <= firstY - 14 + 1;
})());

console.log("\n— the three visual directions —");
for (const st of KEY_STYLES) {
  const svg = svgOf(keyImage({ color: "#3B6FD4", style: st, icon: "mic" }));
  ok(`${st} gera svg válido`, svg.startsWith("<svg") && svg.endsWith("</svg>"));
  ok(`${st} usa o fundo escuro`, svg.includes("#0C0C10"), st);
  ok(`${st} não usa <filter>`, !svg.includes("<filter"), st);
  // One gradient id per SVG; two would be a silent collision inside the same key.
  ok(`${st} declara no máximo um gradiente`, (svg.match(/id="h"/g) || []).length <= 1);
}
ok("the three directions produce different drawings", (() => {
  const seen = KEY_STYLES.map((st) => svgOf(keyImage({ color: "#3B6FD4", style: st, icon: "mic" })));
  return new Set(seen).size === KEY_STYLES.length;
})());
ok("with no style declared it falls back to neon",
  keyImage({ color: "#3B6FD4", icon: "mic" }) === keyImage({ color: "#3B6FD4", style: "neon", icon: "mic" }));
// The direction applies to the states too: a neon key does not turn aurora while recording.
for (const st of KEY_STYLES) {
  for (const special of ["check", "cross", "warn"] as const) {
    ok(`${st} desenha o estado ${special}`,
      svgOf(keyImage({ color: "#2E8C3C", style: st, special })).length > 200);
  }
}

console.log("\n— the icon set —");
ok("18 icons plus the empty one", ICON_NAMES.length === 19, `n=${ICON_NAMES.length}`);
ok("no repeated name", new Set(ICON_NAMES).size === ICON_NAMES.length);
ok("the old icons survived the expansion",
  ["mic", "globe", "bubble", "pen", "none"].every((n) => ICON_NAMES.includes(n as never)),
  "settings gravadas nas teclas de hoje apontam para estes");
for (const icon of ICON_NAMES) {
  if (icon === "none") continue;
  for (const st of KEY_STYLES) {
    const svg = svgOf(keyImage({ color: "#3B6FD4", style: st, icon }));
    ok(`${icon} desenha em ${st}`, svg.length > 300 && !svg.includes("NaN"), `${svg.length} bytes`);
  }
}
ok("icon 'none' leaves the key with the label only", (() => {
  const svg = svgOf(keyImage({ color: "#3B6FD4", icon: "none", lines: ["Ditado"] }));
  return svg.includes("Ditado") && !svg.includes("<path") && !svg.includes("<circle");
})());
ok("no glyph escapes the 32x32 grid", (() => {
  // Every icon is drawn in the SAME box around (36,28). One that escapes ruins the
  // alignment of the whole set — which is what happened with the first pencil, which
  // spilled out of the drawing. Here we look at COORDINATES only: no radius, thickness,
  // opacity or gradient numbers.
  const bad: string[] = [];
  for (const icon of ICON_NAMES) {
    if (icon === "none") continue;
    const svg = svgOf(keyImage({ color: "#3B6FD4", style: "aurora", icon }))
      .replace(/<defs>[\s\S]*?<\/defs>/, "")
      .replace(/<rect[^>]*rx="1[34](\.\d+)?"[^>]*\/>/g, ""); // casca e atmosfera da tecla

    const coords: number[] = [];
    for (const m of svg.matchAll(/\s(?:x|y|cx|cy|x1|y1|x2|y2)="([-\d.]+)"/g)) coords.push(parseFloat(m[1]));
    for (const m of svg.matchAll(/\sd="([^"]+)"/g)) {
      // "A rx ry rot arc sweep x y" — only the last two are coordinates; the radii and
      // the flags (0/1) are not, and without removing them every arc would false-alarm.
      const d = m[1].replace(/A\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[01]\s+[01]\s+/g, "");
      for (const n of d.matchAll(/[-\d.]+/g)) coords.push(parseFloat(n[0]));
    }
    const out = coords.filter((v) => v < 10 || v > 56);
    if (out.length) bad.push(`${icon}: ${out.slice(0, 4).join(",")}`);
  }
  return bad.length === 0;
})(), "algum ícone saiu da grade");

console.log("\n— panel thumbnails —");
for (const st of KEY_STYLES) {
  ok(`miniatura em ${st}`, iconThumb("mic", st, "#3B6FD4").startsWith("data:image/svg+xml;base64,"));
}
ok("every option in the grid has a thumbnail",
  ICON_NAMES.every((n) => iconThumb(n, "neon", "#3B6FD4").length > 120));
ok("the thumbnail comes from the same drawing as the key", (() => {
  const thumb = svgOf(iconThumb("bolt", "aurora", "#3B6FD4"));
  const key = svgOf(keyImage({ color: "#3B6FD4", style: "aurora", icon: "bolt" }));
  // the bolt's path is literally the same in both
  const d = /d="(M 39 12[^"]*)"/.exec(key)?.[1];
  return !!d && thumb.includes(d);
})());

console.log("\n— translated languages —");
for (const loc of LOCALES) {
  const spoken = spokenLanguages(loc, "auto");
  ok(`lista de falados em ${loc}`, spoken.length === 31 && spoken[0].code === "",
    `n=${spoken.length}`);
  ok(`ordem alfabética em ${loc}`,
    spoken.slice(1).every((v, i, arr) => i === 0 || arr[i - 1].label.localeCompare(v.label, loc) <= 0));
}
ok("the language name changes with the locale",
  languageLabel("pt", "en") === "Inglês" && languageLabel("en", "en") === "English" &&
  languageLabel("es", "en") === "Inglés",
  `${languageLabel("pt", "en")} / ${languageLabel("en", "en")} / ${languageLabel("es", "en")}`);
ok("the prompt uses the lowercase name",
  languageName("pt", "es") === "espanhol", languageName("pt", "es"));
ok("the badge is always uppercase", languageBadge("pt") === "PT" && languageBadge("") === "");
ok("an unknown code does not break it", !!languageLabel("pt", "xx"));

console.log("\n— target languages —");
for (const loc of LOCALES) {
  const targets = targetLanguages(loc);
  ok(`lista de destinos em ${loc}`, targets.length === TARGET_CODES.length && targets.length >= 28,
    `n=${targets.length}`);
  ok(`destinos em ordem alfabética em ${loc}`,
    targets.every((v, i, arr) => i === 0 || arr[i - 1].label.localeCompare(v.label, loc) <= 0));
  ok(`todo destino tem nome em ${loc}`, targets.every((x) => !!x.label && x.label !== x.code));
}
// Translating into a language the plugin will not even listen to would be half a path.
ok("every target is also a spoken language",
  TARGET_CODES.every((c) => SPOKEN_CODES.includes(c)),
  TARGET_CODES.filter((c) => !SPOKEN_CODES.includes(c)).join(","));
ok("no repeated target", new Set(TARGET_CODES).size === TARGET_CODES.length);

console.log("\n— key text —");
for (const loc of LOCALES) {
  const K = keyText(loc) as unknown as Record<string, string | string[]>;
  const empty = Object.keys(keyText("pt")).filter((k) => {
    const v = K[k];
    return Array.isArray(v) ? v.length !== 2 || v.some((x) => !x) : !v;
  });
  ok(`texto da tecla completo em ${loc}`, empty.length === 0, empty.join(","));
}
ok("the right plural in the count",
  wordCountLines(1, "pt")[1] === "palavra" && wordCountLines(2, "pt")[1] === "palavras");
ok("the count changes language",
  wordCountLines(3, "en")[1] === "words" && wordCountLines(3, "es")[1] === "palabras");
ok("the number comes on the first line", wordCountLines(142, "pt")[0] === "142");
ok("an API error comes out in the panel's language",
  shortError(new ApiError("x", "auth"), "en") === "bad key" &&
  shortError(new ApiError("x", "auth"), "pt") === "chave inválida",
  `${shortError(new ApiError("x", "auth"), "en")} / ${shortError(new ApiError("x", "auth"), "pt")}`);
ok("an error with a status still shows the number",
  shortError(new ApiError("x", "transient", 429), "en") === "error 429");

console.log("\n— two-line confirmation —");
const done = svgOf(keyImage({
  color: "#2E8C3C", special: "check", lines: ["142", "palavras"], fontSizes: [22, 10],
}));
ok("number and word on separate lines", (done.match(/<text/g) || []).length === 2);
ok("the number comes out much bigger than the word", (() => {
  const sizes = [...done.matchAll(/font-size="([\d.]+)"/g)].map((m) => parseFloat(m[1]));
  return sizes.length === 2 && sizes[0] >= sizes[1] * 2;
})(), [...done.matchAll(/font-size="([\d.]+)"/g)].map((m) => m[1]).join(" / "));
ok("the check does not touch the number", (() => {
  const firstY = parseFloat(/<text[^>]*y="([\d.]+)"/.exec(done)![1]);
  const scale = parseFloat(/scale\(([\d.]+)\)/.exec(done)?.[1] ?? "1");
  const cy = parseFloat(/translate\(36 ([\d.]+)\)/.exec(done)?.[1] ?? "28");
  return cy + (42 * scale) / 2 <= firstY - 22 + 1;
})());
ok("the confirmation does not spill out of the key",
  [...done.matchAll(/<text[^>]*y="([\d.]+)"/g)].every((m) => parseFloat(m[1]) <= 70),
  [...done.matchAll(/<text[^>]*y="([\d.]+)"/g)].map((m) => m[1]).join(","));
// "words" in Spanish and English have different widths; neither may be squeezed.
for (const loc of LOCALES) {
  const svg = svgOf(keyImage({
    color: "#2E8C3C", special: "check", lines: wordCountLines(9999, loc), fontSizes: [22, 10],
  }));
  const small = [...svg.matchAll(/font-size="([\d.]+)"/g)].map((m) => parseFloat(m[1]))[1];
  ok(`a palavra cabe sem encolher em ${loc}`, small === 10, `corpo=${small}`);
}

console.log("\n— keyboard shortcut nickname —");
resetShortcuts();
ok("accents leave the nickname", normalizeAlias("Inglês") === "ingles", normalizeAlias("Inglês"));
ok("a space becomes a hyphen", normalizeAlias("Relato de atendimento") === "relato-de-atendimento");
ok("cedilla and uppercase go away", normalizeAlias("Correção Rápida") === "correcao-rapida", normalizeAlias("Correção Rápida"));
ok("a leftover hyphen is trimmed", normalizeAlias("  --e-mail!!  ") === "e-mail", normalizeAlias("  --e-mail!!  "));
ok("empty stays empty", normalizeAlias(undefined) === "" && normalizeAlias("!!!") === "");
ok("a nickname does not go past 40 characters", normalizeAlias("a".repeat(80)).length === 40);
ok("the address comes out in deep-link format",
  shortcutUrl("ingles") ===
    "streamdeck://plugins/message/com.felipe.transcritranslator/dictate?key=ingles&streamdeck=hidden",
  shortcutUrl("ingles"));
ok("a passive address (does not bring the Stream Deck to the front)", shortcutUrl("x").includes("streamdeck=hidden"));

ok("a noted key is found by its nickname",
  rememberKey("ctx-1", { shortcutAlias: "Inglês", label: "→ EN" }).status === "ok" &&
    lookup("ingles")?.actionId === "ctx-1");
ok("the copy of the settings travels along", lookup("ingles")?.settings.label === "→ EN");
ok("a duplicate nickname does NOT steal the original key", (() => {
  const r = rememberKey("ctx-2", { shortcutAlias: "ingles", label: "cópia" });
  return r.status === "taken" && lookup("ingles")?.actionId === "ctx-1";
})());
ok("the panel knows whose taken nickname it is", ownerOf("ingles")?.label === "→ EN");
ok("erasing the nickname takes the key out of external reach", (() => {
  rememberKey("ctx-1", { shortcutAlias: "", label: "→ EN" });
  return lookup("ingles") === undefined;
})());
ok("changing the nickname does not leave the old one behind", (() => {
  rememberKey("ctx-3", { shortcutAlias: "email" });
  rememberKey("ctx-3", { shortcutAlias: "e-mail-formal" });
  return lookup("email") === undefined && lookup("e-mail-formal")?.actionId === "ctx-3";
})());
ok("the nickname starts out empty in the defaults", withDefaults(undefined).shortcutAlias === "");

console.log("\n— one recording per key —");
// The machine-wide lock answers "is ANOTHER key recording?" and says yes to the key that
// already owns it, on purpose. `claimStart` answers the other half — whether THIS key is
// already on its way — and it is what stops one abandoned dictation from becoming several.
ok("the first trigger claims the key", claimStart("k1"));
ok("a second trigger during the same start is refused", !claimStart("k1"));
ok("another key is unaffected", claimStart("k2"));
finishStart("k1");
ok("released, the key can start again", claimStart("k1"));
finishStart("k1");
// A live recorder keeps the guard shut on its own: the reservation ends when the recorder
// exists, and from there it is the recorder that says the key is busy.
getState("k1").recorder = {} as never;
ok("a key that is already recording is refused", !claimStart("k1"));
getState("k1").recorder = undefined;
ok("and free again once it stops", claimStart("k1"));
finishStart("k1");
finishStart("k2");
resetShortcuts();

// --- the pause that ends a recording ---
// The range is enforced in withDefaults because old settings accepted 0.5 s and the
// panel's <input type="number"> does not block a value typed by hand.
ok("the default pause is 10 s", withDefaults(undefined).silenceSeconds === 10, DEFAULTS.silenceSeconds);
ok("a saved value below the minimum rises to 2.5 s",
  withDefaults({ silenceSeconds: 0.5 }).silenceSeconds === SILENCE_MIN,
  withDefaults({ silenceSeconds: 0.5 }).silenceSeconds);
ok("a saved value above the maximum drops to 30 s",
  withDefaults({ silenceSeconds: 120 }).silenceSeconds === SILENCE_MAX);
ok("a value inside the range is honoured", withDefaults({ silenceSeconds: 7 }).silenceSeconds === 7);
ok("an invalid value falls back to the default, not to NaN",
  withDefaults({ silenceSeconds: NaN }).silenceSeconds === DEFAULTS.silenceSeconds);
ok("the default sits inside its own range",
  DEFAULTS.silenceSeconds >= SILENCE_MIN && DEFAULTS.silenceSeconds <= SILENCE_MAX);

// --- every key the panel asks for exists ---
//
// The parity check in CLAUDE.md compares en/es AGAINST pt, so a key missing from all
// three slips through: `applyLang()` then keeps whatever is written in the HTML, and the
// panel shows Portuguese inside an English interface. That is exactly how the "Copiar"
// button survived until a screenshot caught it — and a screenshot is not a method.
{
  const html = readFileSync("com.felipe.transcritranslator.sdPlugin/ui/dictation.html", "utf8");
  const source = readFileSync("com.felipe.transcritranslator.sdPlugin/ui/i18n.js", "utf8");
  const win: Record<string, any> = {};
  new Function("window", source)(win);
  const TABLE = win.TT_I18N as Record<string, Record<string, string>>;

  const asked = new Set<string>();
  for (const attr of ["data-i18n", "data-i18n-ph", "data-i18n-title"]) {
    for (const m of html.matchAll(new RegExp(attr + '="([^"]+)"', "g"))) asked.add(m[1]);
  }

  ok("the panel asks for a plausible number of keys", asked.size > 50, String(asked.size));
  for (const locale of LOCALES) {
    const missing = [...asked].filter((k) => !TABLE[locale]?.[k]);
    ok("every data-i18n key exists in " + locale, missing.length === 0, missing.join(", "));
  }
}

console.log("\n— step 2: model and fallback —");
ok("the default and the fallback are different models", TEXT_FALLBACK_MODEL !== DEFAULTS.textModel);
ok("the default is offered in the panel", TEXT_MODELS.some((m) => m.id === DEFAULTS.textModel));
ok("the fallback is offered in the panel", TEXT_MODELS.some((m) => m.id === TEXT_FALLBACK_MODEL));

// reasoning_effort is an HTTP 400 on the 4.x models — the branch is not an optimisation.
ok("the 5.6 family takes reasoning_effort", supportsReasoningEffort("gpt-5.6-luna"));
ok("a dated snapshot takes it too", supportsReasoningEffort("gpt-5.6-luna-2026-07-09"));
ok("tolerates whitespace around the id", supportsReasoningEffort("  gpt-5.6-terra  "));
ok("the fallback model does not", !supportsReasoningEffort(TEXT_FALLBACK_MODEL));
ok("gpt-4o-mini does not", !supportsReasoningEffort("gpt-4o-mini"));
ok("a lookalike id does not", !supportsReasoningEffort("gpt-5.6-lunatic-mini"));

{
  const realFetch = globalThis.fetch;
  const sent: Array<{ model: string; effort?: string }> = [];
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  globalThis.fetch = (async (_url: unknown, init: any) => {
    const body = JSON.parse(String(init.body));
    sent.push({ model: body.model, effort: body.reasoning_effort });
    if (body.model === "gpt-5.6-luna") {
      return json(404, { error: { code: "model_not_found",
        message: "The model `gpt-5.6-luna` does not exist or you do not have access to it." } });
    }
    if (body.model === "wrong-key") {
      return json(401, { error: { message: "Incorrect API key provided" } });
    }
    return json(200, { choices: [{ message: { content: "o texto limpo" }, finish_reason: "stop" }] });
  }) as typeof fetch;

  const call = (model: string) =>
    runText({ apiKey: "k", model, fallbackModel: TEXT_FALLBACK_MODEL, systemPrompt: "s", userText: "u" });

  try {
    const fell = await call("gpt-5.6-luna");
    ok("a model this account cannot use falls back", fell.model === TEXT_FALLBACK_MODEL, fell.model);
    ok("and the text is the fallback's answer", fell.text === "o texto limpo", fell.text);
    // The history records what ANSWERED, not what was configured.
    ok("the reasoning model was told not to reason", sent[0]?.effort === "none", String(sent[0]?.effort));
    ok("the fallback was sent no reasoning_effort", sent[1]?.effort === undefined, String(sent[1]?.effort));

    sent.length = 0;
    const direct = await call(TEXT_FALLBACK_MODEL);
    ok("an available model answers on the first request",
      direct.model === TEXT_FALLBACK_MODEL && sent.length === 1, `requests=${sent.length}`);

    // A bad key must NOT be retried elsewhere: falling back would hide the real problem.
    sent.length = 0;
    let kind = "resolved";
    await call("wrong-key").catch((e) => { kind = e instanceof ApiError ? e.kind : "other"; });
    ok("a bad key does not fall back", kind === "auth" && sent.length === 1, `${kind}, requests=${sent.length}`);
  } finally {
    globalThis.fetch = realFetch;
  }
}

console.log(`\n${pass} ok, ${fail} failures\n`);
process.exit(fail ? 1 : 0);
