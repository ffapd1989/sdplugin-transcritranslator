// Teste das partes puras, sem Stream Deck e sem rede.
import { applyCanon, parseTerms, buildTranscribePrompt, promptBudget, estimateTokens } from "../src/lib/canon.js";
import { looksLikePromptEcho } from "../src/lib/openai.js";
import { buildTextSystemPrompt, hasTextWork, textPromptParts } from "../src/lib/prompts.js";
import { keyImage, clock, wordCount } from "../src/lib/icons.js";
import { shade } from "../src/lib/theme.js";
import { withDefaults } from "../src/lib/settings.js";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

console.log("\n— dicionario canônico —");
const terms = parseTerms("CPC, acórdão, SRVDRU, B.R.I.C.K., n8n, a");
ok("descarta termo de 1 letra", !terms.includes("a"), JSON.stringify(terms));
ok("mantem termo com pontos", terms.includes("B.R.I.C.K."));

ok("corrige capitalização", applyCanon("o cpc diz que", terms) === "o CPC diz que");
ok("respeita acentuada com pontuação final",
  applyCanon("segundo o Acórdão.", terms) === "segundo o acórdão.",
  applyCanon("segundo o Acórdão.", terms));
ok("não casa dentro de palavra",
  applyCanon("cpce não deve mudar", terms) === "cpce não deve mudar",
  applyCanon("cpce não deve mudar", terms));
ok("não casa em palavra acentuada maior",
  applyCanon("acórdãos plural", terms) === "acórdãos plural",
  applyCanon("acórdãos plural", terms));
ok("termo com pontos é escapado (não vira regex)",
  applyCanon("o b.r.i.c.k. ali", terms).includes("B.R.I.C.K."),
  applyCanon("o b.r.i.c.k. ali", terms));
ok("não explode com string vazia", applyCanon("", terms) === "");

console.log("\n— orcamento de 224 tokens —");
const many = parseTerms(Array.from({ length: 400 }, (_, i) => `TERMO${i}`).join(","));
const built = buildTranscribePrompt({ terms: many, context: "Reunião técnica.", useCanon: true });
ok("trunca a lista", built.droppedTerms > 0, `dropped=${built.droppedTerms}`);
ok("cabe no teto", estimateTokens(built.prompt) <= 224, `tokens=${estimateTokens(built.prompt)}`);
ok("contexto sobrevive no fim", built.prompt.endsWith("Reunião técnica."));
const off = buildTranscribePrompt({ terms: many, context: "só contexto", useCanon: false });
ok("useCanon=false manda só o contexto", off.prompt === "só contexto");
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
const base = { targetLanguageName: "Inglês", canonTerms: terms };
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
ok("tradução gera a instrução sozinha", both.includes("Traduza o texto para Inglês."));
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
ok("nomeia a tradução com o idioma", parts.some((p) => p.title.includes("Inglês")));
ok("expõe as travas", parts.some((p) => p.title.includes("Travas")));
ok("nada fica de fora do que é enviado",
  parts.every((p) => both.includes(p.body.slice(0, 60))),
  parts.map((p) => p.title).join(" | "));

console.log("\n— tema —");
const sh = shade("#3B6FD4");
ok("clareia e escurece", sh.lite !== sh.base && sh.border !== sh.base, JSON.stringify(sh));
ok("hex inválido não quebra", shade("não-e-hex").base === "não-e-hex" || !!shade("").border);

console.log("\n— imagem da tecla —");
function svgOf(dataUri: string): string {
  return Buffer.from(dataUri.split(",")[1], "base64").toString("utf8");
}
const idle = svgOf(keyImage({ color: "#404650", icon: "mic", lines: ["Ditado"] }));
ok("gera svg válido", idle.startsWith("<svg") && idle.endsWith("</svg>"));
ok("tem o rótulo", idle.includes("Ditado"));
const wave = svgOf(keyImage({ color: "#C44040", special: "wave", levels: [0.1, 0.9, 0.4], lines: ["0:07"] }));
ok("waveform desenha 9 barras", (wave.match(/<rect/g) || []).length === 10, `rects=${(wave.match(/<rect/g) || []).length}`);
ok("cronômetro aparece", wave.includes("0:07"));
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

console.log(`\n${pass} ok, ${fail} falhas\n`);
process.exit(fail ? 1 : 0);
