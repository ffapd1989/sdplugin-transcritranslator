// Teste das partes puras, sem Stream Deck e sem rede.
import { applyCanon, parseTerms, buildTranscribePrompt, promptBudget, estimateTokens } from "../src/lib/canon.js";
import { looksLikePromptEcho, shortError, ApiError } from "../src/lib/openai.js";
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
import { withDefaults, resolveContentLocale, resolveUiLocale, DEFAULTS, SILENCE_MIN, SILENCE_MAX } from "../src/lib/settings.js";
import { normalizeAlias, shortcutUrl, rememberKey, lookup, ownerOf, resetShortcuts } from "../src/lib/shortcuts.js";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

console.log("\n— dicionário canônico —");
const terms = parseTerms("CPC, acórdão, SRVDRU, B.R.I.C.K., n8n, a");
ok("descarta termo de 1 letra", !terms.includes("a"), JSON.stringify(terms));
ok("mantém termo com pontos", terms.includes("B.R.I.C.K."));
ok("corrige capitalização", applyCanon("o cpc diz que", terms) === "o CPC diz que");
ok("respeita acentuada com pontuação final",
  applyCanon("segundo o Acórdão.", terms) === "segundo o acórdão.",
  applyCanon("segundo o Acórdão.", terms));
ok("não casa dentro de palavra",
  applyCanon("cpce não deve mudar", terms) === "cpce não deve mudar");
ok("não casa em palavra acentuada maior",
  applyCanon("acórdãos plural", terms) === "acórdãos plural");
ok("termo com pontos é escapado (não vira regex)",
  applyCanon("o b.r.i.c.k. ali", terms).includes("B.R.I.C.K."));
ok("não explode com string vazia", applyCanon("", terms) === "");

console.log("\n— orçamento de 224 tokens —");
const many = parseTerms(Array.from({ length: 400 }, (_, i) => `TERMO${i}`).join(","));
const built = buildTranscribePrompt({ terms: many, context: "Reunião técnica.", useCanon: true });
ok("trunca a lista", built.droppedTerms > 0, `dropped=${built.droppedTerms}`);
ok("cabe no teto", estimateTokens(built.prompt) <= 224, `tokens=${estimateTokens(built.prompt)}`);
ok("contexto sobrevive no fim", built.prompt.endsWith("Reunião técnica."));
const off = buildTranscribePrompt({ terms: many, context: "só contexto", useCanon: false });
ok("useCanon=false manda só o contexto", off.prompt === "só contexto");
ok("sem termos e sem contexto, prompt vazio",
  buildTranscribePrompt({ terms: [], context: "", useCanon: true }).prompt === "");
const budget = promptBudget(terms, "abc");
ok("budget reporta limite", budget.limit === 224 && budget.used > 0);

console.log("\n— anti-eco —");
const promptList = "CPC, acórdão, SRVDRU, WireGuard, Grafana";
ok("detecta lista devolvida", looksLikePromptEcho("CPC, acórdão, SRVDRU, WireGuard, Grafana", promptList));
ok("detecta lista reordenada", looksLikePromptEcho("Grafana, SRVDRU, CPC, acórdão, WireGuard", promptList));
ok("não acusa fala real",
  !looksLikePromptEcho("bom dia, preciso marcar a reunião de amanhã com o time todo", promptList));
ok("não acusa fala que cita um termo",
  !looksLikePromptEcho("configurei o WireGuard no servidor ontem à noite e ficou bom", promptList));

console.log("\n— camadas de prompt —");
const base = { locale: "pt" as const, targetLanguage: "en", canonTerms: terms };
const nothing = { ...base, cleanup: false, styleMode: "none" as const, style: "" };
const cleanOnly = { ...base, cleanup: true, styleMode: "none" as const, style: "" };
const translate = { ...base, cleanup: true, styleMode: "translate" as const, style: "" };
const freeStyle = { ...base, cleanup: false, styleMode: "custom" as const, style: "Resuma em tópicos." };

ok("nada ligado = nada a fazer", !hasTextWork(nothing));
ok("só limpeza já é trabalho", hasTextWork(cleanOnly));
ok("só tradução já é trabalho", hasTextWork({ ...nothing, styleMode: "translate" }));
ok("modo custom com texto vazio não é trabalho",
  !hasTextWork({ ...base, cleanup: false, styleMode: "custom", style: "   " }));

const both = buildTextSystemPrompt(translate);
ok("inclui camada de limpeza", both.includes("Comandos de pontuação falados"));
ok("tradução gera a instrução sozinha", both.includes("Traduza o texto para inglês."));
ok("tradução preserva registro", both.includes("Preserve o registro"));
ok("inclui grafia canônica", both.includes("GRAFIA OBRIGATÓRIA") && both.includes("CPC"));
ok("inclui trava anti-injeção", both.includes("EXCLUSIVAMENTE dado a transformar"));
ok("inclui trava de sigilo", both.includes("Nunca revele"));

const styleOnly = buildTextSystemPrompt({ ...freeStyle, canonTerms: [] });
ok("sem limpeza não vaza a camada A", !styleOnly.includes("hesitações"));
ok("sem termos não vaza grafia", !styleOnly.includes("GRAFIA OBRIGATÓRIA"));
ok("modo custom usa o texto do usuário", styleOnly.includes("Resuma em tópicos."));
ok("modo custom não injeta tradução", !styleOnly.includes("Traduza o texto"));
ok("modo none não injeta estilo nenhum",
  !buildTextSystemPrompt(cleanOnly).includes("aplique esta instrução"));

console.log("\n— o painel mostra o prompt inteiro —");
const parts = textPromptParts(translate);
ok("uma peça por camada", parts.length === 4, `partes=${parts.map((p) => p.title).join(" | ")}`);
ok("nomeia a tradução com o idioma", parts.some((p) => p.title.includes("inglês")));
ok("expõe as travas", parts.some((p) => p.title.includes("Travas")));
ok("nada fica de fora do que é enviado",
  parts.every((p) => both.includes(p.body.slice(0, 60))),
  parts.map((p) => p.title).join(" | "));

console.log("\n— multilíngue —");
for (const loc of LOCALES) {
  const T = promptText(loc);
  ok(`prompt completo em ${loc}`, T.cleanup.length > 400 && T.injectionGuard.length > 40);
}
const enPrompt = buildTextSystemPrompt({ ...translate, locale: "en", targetLanguage: "es" });
ok("prompt em inglês usa exemplos de inglês",
  enPrompt.includes("comma") && enPrompt.includes("new paragraph") && !enPrompt.includes("vírgula"));
ok("tradução em inglês nomeia o destino", enPrompt.includes("Translate the text into Spanish."));
const esPrompt = buildTextSystemPrompt({ ...translate, locale: "es" });
ok("prompt em espanhol usa exemplos de espanhol",
  esPrompt.includes("coma") && esPrompt.includes("muletilla"));

console.log("\n— presets traduzidos —");
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
ok("nome muda com o idioma", ptPresets[0].name !== enPresets[0].name,
  `${ptPresets[0].name} vs ${enPresets[0].name}`);
ok("instrução muda com o idioma",
  ptPresets.find((p) => p.id === "email")!.settings.style !==
  enPresets.find((p) => p.id === "email")!.settings.style);
ok("nenhum preset preenche o prompt de transcrição",
  ptPresets.every((p) => !p.settings.transcribeContext));
ok("preset de revisão não grava áudio",
  ptPresets.find((p) => p.id === "rewrite")!.settings.transcribeOn === false);

console.log("\n— cascata de idiomas —");
ok("conteúdo explícito vence tudo",
  resolveContentLocale({ contentLang: "es", spokenLanguage: "pt", uiLang: "en" }) === "es");
ok("sem explícito, segue a fala",
  resolveContentLocale({ contentLang: "auto", spokenLanguage: "en", uiLang: "pt" }) === "en");
ok("fala em auto cai para o painel",
  resolveContentLocale({ contentLang: "auto", spokenLanguage: "", uiLang: "pt" }) === "pt");
ok("painel em auto cai para o app",
  resolveContentLocale({ contentLang: "auto", spokenLanguage: "", uiLang: "auto", appLanguage: "es" }) === "es");
ok("idioma sem tradução cai para inglês",
  resolveContentLocale({ contentLang: "auto", spokenLanguage: "ja", uiLang: "auto", appLanguage: "ja" }) === "en");
ok("painel explícito vence o app", resolveUiLocale("pt", "en") === "pt");
ok("painel em auto segue o app", resolveUiLocale("auto", "es") === "es");

console.log("\n— tema —");
const sh = shade("#3B6FD4");
ok("clareia e escurece", sh.lite !== sh.base && sh.border !== sh.base, JSON.stringify(sh));
ok("hex inválido não quebra", !!shade("não-é-hex").border);

console.log("\n— imagem da tecla —");
function svgOf(dataUri: string): string {
  return Buffer.from(dataUri.split(",")[1], "base64").toString("utf8");
}
const idle = svgOf(keyImage({ color: "#404650", icon: "mic", lines: ["Ditado"] }));
ok("gera svg válido", idle.startsWith("<svg") && idle.endsWith("</svg>"));
ok("tem o rótulo", idle.includes("Ditado"));
const wave = svgOf(keyImage({ color: "#C44040", special: "wave", levels: [0.1, 0.9, 0.4], lines: ["0:07"] }));
ok("waveform desenha 9 barras", (wave.match(/<rect/g) || []).length === 10,
  `rects=${(wave.match(/<rect/g) || []).length}`);
ok("cronômetro aparece", wave.includes("0:07"));
const badged = svgOf(keyImage({ color: "#2E7D74", icon: "globe", lines: ["EN"], badge: "en" }));
ok("badge de idioma em maiúsculas", badged.includes(">EN<"));
const esc = svgOf(keyImage({ color: "#404650", icon: "mic", lines: ['R&D <"x">'] }));
ok("escapa xml no rótulo", esc.includes("&amp;") && esc.includes("&lt;") && !esc.includes('<"x"'));
const two = svgOf(keyImage({ color: "#B8791F", special: "warn", lines: ["SOLTE P/", "CANCELAR"] }));
ok("duas linhas cabem", two.includes("SOLTE P/") && two.includes("CANCELAR"));

ok("clock formata", clock(67000) === "1:07", clock(67000));
ok("clock zero", clock(0) === "0:00");
ok("conta palavras", wordCount("  uma  duas   três ") === 3);

console.log("\n— defaults —");
const d = withDefaults(undefined);
ok("modelo de áudio padrão", d.transcribeModel === "gpt-4o-mini-transcribe");
ok("modelo de texto padrão", d.textModel === "gpt-4.1-mini");
const cleared = withDefaults({ style: "", label: "", cleanup: false });
ok("string vazia não vira default", cleared.style === "" && cleared.label === "");
ok("false não vira default", cleared.cleanup === false);
const custom = withDefaults({ maxMinutes: 3, colorIdle: "#123456" });
ok("valor custom vence", custom.maxMinutes === 3 && custom.colorIdle === "#123456");
console.log("\n— rótulo da tecla —");
ok("respeita quebra digitada",
  JSON.stringify(wrapLabel("Petição\ninicial", 14)) === '["Petição","inicial"]',
  JSON.stringify(wrapLabel("Petição\ninicial", 14)));
ok("quebra sozinho quando não cabe",
  wrapLabel("Relato de atendimento", 14).length > 1,
  JSON.stringify(wrapLabel("Relato de atendimento", 14)));
ok("texto curto fica numa linha", wrapLabel("Ditado", 14).length === 1);
ok("vazio não vira linha", wrapLabel("", 14).length === 0);
ok("no máximo 3 linhas", wrapLabel("um dois três quatro cinco seis sete oito nove", 14).length <= 3);
ok("fonte menor cabe mais por linha",
  wrapLabel("Relato de atendimento", 9).length <= wrapLabel("Relato de atendimento", 18).length);

const oneLine = svgOf(keyImage({ color: "#404650", icon: "mic", lines: ["Ditado"], fontSize: 14 }));
const threeLines = svgOf(keyImage({
  color: "#404650", icon: "mic", lines: ["Relato", "de", "atendimento"], fontSize: 14, lineGap: 1,
}));
ok("três linhas geram três textos", (threeLines.match(/<text/g) || []).length === 3);
ok("bloco de texto não vaza da tecla",
  [...threeLines.matchAll(/<text[^>]*y="([\d.]+)"/g)].every((m) => parseFloat(m[1]) <= 70),
  [...threeLines.matchAll(/<text[^>]*y="([\d.]+)"/g)].map((m) => m[1]).join(","));
ok("fonte grande com uma linha é respeitada",
  svgOf(keyImage({ color: "#404650", lines: ["Oi"], fontSize: 22 })).includes('font-size="22.00"'));

ok("ícone encolhe quando o texto ocupa espaço",
  svgOf(keyImage({ color: "#404650", icon: "mic", lines: ["Relato", "de", "atendimento"], fontSize: 14 }))
    .includes("<g transform="));
ok("ícone fica natural com uma linha",
  !svgOf(keyImage({ color: "#404650", icon: "mic", lines: ["Ditado"], fontSize: 14 }))
    .includes("<g transform="));
ok("ícone e texto não se sobrepõem", (() => {
  const svg = svgOf(keyImage({
    color: "#404650", icon: "mic", lines: ["aa", "bb", "cc"], fontSize: 14, lineGap: 2,
  }));
  const firstY = parseFloat(/<text[^>]*y="([\d.]+)"/.exec(svg)![1]);
  const scale = parseFloat(/scale\(([\d.]+)\)/.exec(svg)?.[1] ?? "1");
  const cy = parseFloat(/translate\(36 ([\d.]+)\)/.exec(svg)?.[1] ?? "28");
  // base do glifo escalado tem de ficar acima do topo da primeira linha de texto
  return cy + (42 * scale) / 2 <= firstY - 14 + 1;
})());

console.log("\n— as três direções visuais —");
for (const st of KEY_STYLES) {
  const svg = svgOf(keyImage({ color: "#3B6FD4", style: st, icon: "mic" }));
  ok(`${st} gera svg válido`, svg.startsWith("<svg") && svg.endsWith("</svg>"));
  ok(`${st} usa o fundo escuro`, svg.includes("#0C0C10"), st);
  ok(`${st} não usa <filter>`, !svg.includes("<filter"), st);
  // Um id de gradiente por SVG; dois seriam colisão silenciosa dentro da mesma tecla.
  ok(`${st} declara no máximo um gradiente`, (svg.match(/id="h"/g) || []).length <= 1);
}
ok("as três direções produzem desenhos diferentes", (() => {
  const seen = KEY_STYLES.map((st) => svgOf(keyImage({ color: "#3B6FD4", style: st, icon: "mic" })));
  return new Set(seen).size === KEY_STYLES.length;
})());
ok("sem estilo declarado cai em neon",
  keyImage({ color: "#3B6FD4", icon: "mic" }) === keyImage({ color: "#3B6FD4", style: "neon", icon: "mic" }));
// A direção vale para os estados também: uma tecla neon não vira aurora ao gravar.
for (const st of KEY_STYLES) {
  for (const special of ["check", "cross", "warn"] as const) {
    ok(`${st} desenha o estado ${special}`,
      svgOf(keyImage({ color: "#2E8C3C", style: st, special })).length > 200);
  }
}

console.log("\n— o conjunto de ícones —");
ok("18 ícones mais o vazio", ICON_NAMES.length === 19, `n=${ICON_NAMES.length}`);
ok("nenhum nome repetido", new Set(ICON_NAMES).size === ICON_NAMES.length);
ok("os ícones antigos sobreviveram à ampliação",
  ["mic", "globe", "bubble", "pen", "none"].every((n) => ICON_NAMES.includes(n as never)),
  "settings gravadas nas teclas de hoje apontam para estes");
for (const icon of ICON_NAMES) {
  if (icon === "none") continue;
  for (const st of KEY_STYLES) {
    const svg = svgOf(keyImage({ color: "#3B6FD4", style: st, icon }));
    ok(`${icon} desenha em ${st}`, svg.length > 300 && !svg.includes("NaN"), `${svg.length} bytes`);
  }
}
ok("ícone 'none' deixa a tecla só com o rótulo", (() => {
  const svg = svgOf(keyImage({ color: "#3B6FD4", icon: "none", lines: ["Ditado"] }));
  return svg.includes("Ditado") && !svg.includes("<path") && !svg.includes("<circle");
})());
ok("nenhum glifo escapa da grade de 32x32", (() => {
  // Todo ícone é desenhado na MESMA caixa em volta de (36,28). Um que escape estraga
  // o alinhamento do conjunto inteiro — e foi o que aconteceu com o primeiro lápis,
  // que vazava para fora do desenho. Aqui olhamos só COORDENADAS: nada de raio,
  // espessura, opacidade ou os números do gradiente.
  const bad: string[] = [];
  for (const icon of ICON_NAMES) {
    if (icon === "none") continue;
    const svg = svgOf(keyImage({ color: "#3B6FD4", style: "aurora", icon }))
      .replace(/<defs>[\s\S]*?<\/defs>/, "")
      .replace(/<rect[^>]*rx="1[34](\.\d+)?"[^>]*\/>/g, ""); // casca e atmosfera da tecla

    const coords: number[] = [];
    for (const m of svg.matchAll(/\s(?:x|y|cx|cy|x1|y1|x2|y2)="([-\d.]+)"/g)) coords.push(parseFloat(m[1]));
    for (const m of svg.matchAll(/\sd="([^"]+)"/g)) {
      // "A rx ry rot arco varredura x y" — só os dois últimos são coordenadas; os
      // raios e os flags (0/1) não são, e sem tirá-los todo arco daria falso alarme.
      const d = m[1].replace(/A\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[01]\s+[01]\s+/g, "");
      for (const n of d.matchAll(/[-\d.]+/g)) coords.push(parseFloat(n[0]));
    }
    const out = coords.filter((v) => v < 10 || v > 56);
    if (out.length) bad.push(`${icon}: ${out.slice(0, 4).join(",")}`);
  }
  return bad.length === 0;
})(), "algum ícone saiu da grade");

console.log("\n— miniaturas do painel —");
for (const st of KEY_STYLES) {
  ok(`miniatura em ${st}`, iconThumb("mic", st, "#3B6FD4").startsWith("data:image/svg+xml;base64,"));
}
ok("toda opção da grade tem miniatura",
  ICON_NAMES.every((n) => iconThumb(n, "neon", "#3B6FD4").length > 120));
ok("a miniatura sai do mesmo desenho da tecla", (() => {
  const thumb = svgOf(iconThumb("bolt", "aurora", "#3B6FD4"));
  const key = svgOf(keyImage({ color: "#3B6FD4", style: "aurora", icon: "bolt" }));
  // o caminho do raio é literalmente o mesmo nos dois
  const d = /d="(M 39 12[^"]*)"/.exec(key)?.[1];
  return !!d && thumb.includes(d);
})());

console.log("\n— idiomas traduzidos —");
for (const loc of LOCALES) {
  const spoken = spokenLanguages(loc, "auto");
  ok(`lista de falados em ${loc}`, spoken.length === 31 && spoken[0].code === "",
    `n=${spoken.length}`);
  ok(`ordem alfabética em ${loc}`,
    spoken.slice(1).every((v, i, arr) => i === 0 || arr[i - 1].label.localeCompare(v.label, loc) <= 0));
}
ok("nome do idioma muda com o locale",
  languageLabel("pt", "en") === "Inglês" && languageLabel("en", "en") === "English" &&
  languageLabel("es", "en") === "Inglés",
  `${languageLabel("pt", "en")} / ${languageLabel("en", "en")} / ${languageLabel("es", "en")}`);
ok("prompt usa o nome em minúscula",
  languageName("pt", "es") === "espanhol", languageName("pt", "es"));
ok("badge sempre em maiúsculas", languageBadge("pt") === "PT" && languageBadge("") === "");
ok("código desconhecido não quebra", !!languageLabel("pt", "xx"));

console.log("\n— idiomas de destino —");
for (const loc of LOCALES) {
  const targets = targetLanguages(loc);
  ok(`lista de destinos em ${loc}`, targets.length === TARGET_CODES.length && targets.length >= 28,
    `n=${targets.length}`);
  ok(`destinos em ordem alfabética em ${loc}`,
    targets.every((v, i, arr) => i === 0 || arr[i - 1].label.localeCompare(v.label, loc) <= 0));
  ok(`todo destino tem nome em ${loc}`, targets.every((x) => !!x.label && x.label !== x.code));
}
// Traduzir para um idioma que o plugin nem aceita ouvir seria oferecer meio caminho.
ok("todo destino também é um idioma falado",
  TARGET_CODES.every((c) => SPOKEN_CODES.includes(c)),
  TARGET_CODES.filter((c) => !SPOKEN_CODES.includes(c)).join(","));
ok("nenhum destino repetido", new Set(TARGET_CODES).size === TARGET_CODES.length);

console.log("\n— texto da tecla —");
for (const loc of LOCALES) {
  const K = keyText(loc) as unknown as Record<string, string | string[]>;
  const empty = Object.keys(keyText("pt")).filter((k) => {
    const v = K[k];
    return Array.isArray(v) ? v.length !== 2 || v.some((x) => !x) : !v;
  });
  ok(`texto da tecla completo em ${loc}`, empty.length === 0, empty.join(","));
}
ok("plural certo na contagem",
  wordCountLines(1, "pt")[1] === "palavra" && wordCountLines(2, "pt")[1] === "palavras");
ok("contagem muda de idioma",
  wordCountLines(3, "en")[1] === "words" && wordCountLines(3, "es")[1] === "palabras");
ok("número vem na primeira linha", wordCountLines(142, "pt")[0] === "142");
ok("erro de API sai no idioma do painel",
  shortError(new ApiError("x", "auth"), "en") === "bad key" &&
  shortError(new ApiError("x", "auth"), "pt") === "chave inválida",
  `${shortError(new ApiError("x", "auth"), "en")} / ${shortError(new ApiError("x", "auth"), "pt")}`);
ok("erro com status ainda mostra o número",
  shortError(new ApiError("x", "transient", 429), "en") === "error 429");

console.log("\n— confirmação em duas linhas —");
const done = svgOf(keyImage({
  color: "#2E8C3C", special: "check", lines: ["142", "palavras"], fontSizes: [22, 10],
}));
ok("número e palavra em linhas separadas", (done.match(/<text/g) || []).length === 2);
ok("número sai bem maior que a palavra", (() => {
  const sizes = [...done.matchAll(/font-size="([\d.]+)"/g)].map((m) => parseFloat(m[1]));
  return sizes.length === 2 && sizes[0] >= sizes[1] * 2;
})(), [...done.matchAll(/font-size="([\d.]+)"/g)].map((m) => m[1]).join(" / "));
ok("check não encosta no número", (() => {
  const firstY = parseFloat(/<text[^>]*y="([\d.]+)"/.exec(done)![1]);
  const scale = parseFloat(/scale\(([\d.]+)\)/.exec(done)?.[1] ?? "1");
  const cy = parseFloat(/translate\(36 ([\d.]+)\)/.exec(done)?.[1] ?? "28");
  return cy + (42 * scale) / 2 <= firstY - 22 + 1;
})());
ok("confirmação não vaza da tecla",
  [...done.matchAll(/<text[^>]*y="([\d.]+)"/g)].every((m) => parseFloat(m[1]) <= 70),
  [...done.matchAll(/<text[^>]*y="([\d.]+)"/g)].map((m) => m[1]).join(","));
// "palavras" em espanhol e inglês tem largura diferente; nenhuma pode ser espremida.
for (const loc of LOCALES) {
  const svg = svgOf(keyImage({
    color: "#2E8C3C", special: "check", lines: wordCountLines(9999, loc), fontSizes: [22, 10],
  }));
  const small = [...svg.matchAll(/font-size="([\d.]+)"/g)].map((m) => parseFloat(m[1]))[1];
  ok(`a palavra cabe sem encolher em ${loc}`, small === 10, `corpo=${small}`);
}

console.log("\n— apelido do atalho de teclado —");
resetShortcuts();
ok("acento sai do apelido", normalizeAlias("Inglês") === "ingles", normalizeAlias("Inglês"));
ok("espaço vira hífen", normalizeAlias("Relato de atendimento") === "relato-de-atendimento");
ok("cedilha e maiúscula somem", normalizeAlias("Correção Rápida") === "correcao-rapida", normalizeAlias("Correção Rápida"));
ok("hífen sobrando é aparado", normalizeAlias("  --e-mail!!  ") === "e-mail", normalizeAlias("  --e-mail!!  "));
ok("vazio continua vazio", normalizeAlias(undefined) === "" && normalizeAlias("!!!") === "");
ok("apelido não passa de 40 caracteres", normalizeAlias("a".repeat(80)).length === 40);
ok("endereço sai no formato do deep link",
  shortcutUrl("ingles") ===
    "streamdeck://plugins/message/com.felipe.transcritranslator/dictate?key=ingles&streamdeck=hidden",
  shortcutUrl("ingles"));
ok("endereço passivo (não traz o Stream Deck para a frente)", shortcutUrl("x").includes("streamdeck=hidden"));

ok("tecla anotada é encontrada pelo apelido",
  rememberKey("ctx-1", { shortcutAlias: "Inglês", label: "→ EN" }).status === "ok" &&
    lookup("ingles")?.actionId === "ctx-1");
ok("a cópia das configurações vai junto", lookup("ingles")?.settings.label === "→ EN");
ok("apelido duplicado NÃO rouba a tecla original", (() => {
  const r = rememberKey("ctx-2", { shortcutAlias: "ingles", label: "cópia" });
  return r.status === "taken" && lookup("ingles")?.actionId === "ctx-1";
})());
ok("painel sabe de quem é o apelido tomado", ownerOf("ingles")?.label === "→ EN");
ok("apagar o apelido tira a tecla do alcance externo", (() => {
  rememberKey("ctx-1", { shortcutAlias: "", label: "→ EN" });
  return lookup("ingles") === undefined;
})());
ok("trocar o apelido não deixa o antigo para trás", (() => {
  rememberKey("ctx-3", { shortcutAlias: "email" });
  rememberKey("ctx-3", { shortcutAlias: "e-mail-formal" });
  return lookup("email") === undefined && lookup("e-mail-formal")?.actionId === "ctx-3";
})());
ok("apelido nasce vazio nos padrões", withDefaults(undefined).shortcutAlias === "");
resetShortcuts();

// --- pausa que encerra a gravação ---
// A faixa é imposta no withDefaults porque settings antigas aceitavam 0,5 s e o
// <input type="number"> do painel não barra valor digitado a mão.
ok("padrão da pausa é 10 s", withDefaults(undefined).silenceSeconds === 10, DEFAULTS.silenceSeconds);
ok("valor gravado abaixo do mínimo sobe para 2,5 s",
  withDefaults({ silenceSeconds: 0.5 }).silenceSeconds === SILENCE_MIN,
  withDefaults({ silenceSeconds: 0.5 }).silenceSeconds);
ok("valor gravado acima do máximo cai para 30 s",
  withDefaults({ silenceSeconds: 120 }).silenceSeconds === SILENCE_MAX);
ok("valor dentro da faixa é respeitado", withDefaults({ silenceSeconds: 7 }).silenceSeconds === 7);
ok("valor inválido cai no padrão, não em NaN",
  withDefaults({ silenceSeconds: NaN }).silenceSeconds === DEFAULTS.silenceSeconds);
ok("o padrão está dentro da própria faixa",
  DEFAULTS.silenceSeconds >= SILENCE_MIN && DEFAULTS.silenceSeconds <= SILENCE_MAX);

console.log(`\n${pass} ok, ${fail} falhas\n`);
process.exit(fail ? 1 : 0);
