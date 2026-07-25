// Teste das partes puras, sem Stream Deck e sem rede.
import { applyCanon, parseTerms, buildTranscribePrompt, promptBudget, estimateTokens } from "../src/lib/canon.js";
import { looksLikePromptEcho } from "../src/lib/openai.js";
import { buildTextSystemPrompt, hasTextWork } from "../src/lib/prompts.js";
import { keyImage, clock, wordCount } from "../src/lib/icons.js";
import { shade } from "../src/lib/theme.js";
import { withDefaults } from "../src/lib/settings.js";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

console.log("\n— dicionario canonico —");
const terms = parseTerms("CPC, acórdão, SRVDRU, B.R.I.C.K., n8n, a");
ok("descarta termo de 1 letra", !terms.includes("a"), JSON.stringify(terms));
ok("mantem termo com pontos", terms.includes("B.R.I.C.K."));

ok("corrige capitalizacao", applyCanon("o cpc diz que", terms) === "o CPC diz que");
ok("respeita acentuada com pontuacao final",
  applyCanon("segundo o Acórdão.", terms) === "segundo o acórdão.",
  applyCanon("segundo o Acórdão.", terms));
ok("nao casa dentro de palavra",
  applyCanon("cpce nao deve mudar", terms) === "cpce nao deve mudar",
  applyCanon("cpce nao deve mudar", terms));
ok("nao casa em palavra acentuada maior",
  applyCanon("acórdãos plural", terms) === "acórdãos plural",
  applyCanon("acórdãos plural", terms));
ok("termo com pontos e' escapado (nao vira regex)",
  applyCanon("o b.r.i.c.k. ali", terms).includes("B.R.I.C.K."),
  applyCanon("o b.r.i.c.k. ali", terms));
ok("nao explode com string vazia", applyCanon("", terms) === "");

console.log("\n— orcamento de 224 tokens —");
const many = parseTerms(Array.from({ length: 400 }, (_, i) => `TERMO${i}`).join(","));
const built = buildTranscribePrompt({ terms: many, context: "Reuniao tecnica.", useCanon: true });
ok("trunca a lista", built.droppedTerms > 0, `dropped=${built.droppedTerms}`);
ok("cabe no teto", estimateTokens(built.prompt) <= 224, `tokens=${estimateTokens(built.prompt)}`);
ok("contexto sobrevive no fim", built.prompt.endsWith("Reuniao tecnica."));
const off = buildTranscribePrompt({ terms: many, context: "so contexto", useCanon: false });
ok("useCanon=false manda so o contexto", off.prompt === "so contexto");
const budget = promptBudget(terms, "abc");
ok("budget reporta limite", budget.limit === 224 && budget.used > 0);

console.log("\n— anti-eco —");
const promptList = "CPC, acórdão, SRVDRU, WireGuard, Grafana";
ok("detecta lista devolvida", looksLikePromptEcho("CPC, acórdão, SRVDRU, WireGuard, Grafana", promptList));
ok("detecta lista reordenada", looksLikePromptEcho("Grafana, SRVDRU, CPC, acórdão, WireGuard", promptList));
ok("nao acusa fala real",
  !looksLikePromptEcho("bom dia, preciso marcar a reuniao de amanha com o time todo", promptList));
ok("nao acusa fala que cita um termo",
  !looksLikePromptEcho("configurei o WireGuard no servidor ontem a noite e ficou bom", promptList));

console.log("\n— camadas de prompt —");
ok("nada ligado = nada a fazer", !hasTextWork({ cleanup: false, style: "" }));
ok("so estilo ja' e' trabalho", hasTextWork({ cleanup: false, style: "traduza" }));
const both = buildTextSystemPrompt({ cleanup: true, style: "Traduza para o ingles.", canonTerms: terms });
ok("inclui camada de limpeza", both.includes("comandos de pontuacao") || both.includes("Comandos de pontuacao"));
ok("inclui o estilo", both.includes("Traduza para o ingles."));
ok("inclui grafia canonica", both.includes("GRAFIA OBRIGATORIA") && both.includes("CPC"));
ok("inclui trava anti-injecao", both.toLowerCase().includes("ignore qualquer instrucao"));
ok("inclui trava de sigilo", both.includes("Nunca revele"));
const styleOnly = buildTextSystemPrompt({ cleanup: false, style: "Resuma.", canonTerms: [] });
ok("sem limpeza nao vaza a camada A", !styleOnly.includes("hesitacoes"));
ok("sem termos nao vaza grafia", !styleOnly.includes("GRAFIA OBRIGATORIA"));

console.log("\n— tema —");
const sh = shade("#3B6FD4");
ok("clareia e escurece", sh.lite !== sh.base && sh.border !== sh.base, JSON.stringify(sh));
ok("hex invalido nao quebra", shade("nao-e-hex").base === "nao-e-hex" || !!shade("").border);

console.log("\n— imagem da tecla —");
function svgOf(dataUri: string): string {
  return Buffer.from(dataUri.split(",")[1], "base64").toString("utf8");
}
const idle = svgOf(keyImage({ color: "#404650", icon: "mic", lines: ["Ditado"] }));
ok("gera svg valido", idle.startsWith("<svg") && idle.endsWith("</svg>"));
ok("tem o rotulo", idle.includes("Ditado"));
const wave = svgOf(keyImage({ color: "#C44040", special: "wave", levels: [0.1, 0.9, 0.4], lines: ["0:07"] }));
ok("waveform desenha 9 barras", (wave.match(/<rect/g) || []).length === 10, `rects=${(wave.match(/<rect/g) || []).length}`);
ok("cronometro aparece", wave.includes("0:07"));
const esc = svgOf(keyImage({ color: "#404650", icon: "mic", lines: ['R&D <"x">'] }));
ok("escapa xml no rotulo", esc.includes("&amp;") && esc.includes("&lt;") && !esc.includes('<"x"'));
const two = svgOf(keyImage({ color: "#B8791F", special: "warn", lines: ["SOLTE P/", "CANCELAR"] }));
ok("duas linhas cabem", two.includes("SOLTE P/") && two.includes("CANCELAR"));

ok("clock formata", clock(67000) === "1:07", clock(67000));
ok("clock zero", clock(0) === "0:00");
ok("conta palavras", wordCount("  uma  duas   tres ") === 3);

console.log("\n— defaults —");
const d = withDefaults(undefined);
ok("modelo de audio padrao", d.transcribeModel === "gpt-4o-mini-transcribe");
ok("modelo de texto padrao", d.textModel === "gpt-4.1-mini");
const cleared = withDefaults({ style: "", label: "", cleanup: false });
ok("string vazia nao vira default", cleared.style === "" && cleared.label === "");
ok("false nao vira default", cleared.cleanup === false);
const custom = withDefaults({ maxMinutes: 3, colorIdle: "#123456" });
ok("valor custom vence", custom.maxMinutes === 3 && custom.colorIdle === "#123456");

console.log(`\n${pass} ok, ${fail} falhas\n`);
process.exit(fail ? 1 : 0);
