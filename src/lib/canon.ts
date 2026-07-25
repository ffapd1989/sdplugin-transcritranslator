// Dicionario de palavras canonicas — as siglas e termos proprios de quem usa.
//
// DUAS FRENTES, e a segunda e' a que realmente garante o resultado:
//
//   1. PROMPT de transcricao: ajuda o modelo a OUVIR certo ("cê-pê-cê" -> "CPC").
//      So' isso alcanca erro fonetico. Mas tem teto de 224 tokens e um risco real
//      (o modelo pode despejar a lista quando o audio e' curto/silencioso — ver
//      openai.ts, que blinda contra isso).
//
//   2. POS-PROCESSAMENTO por regex: forca a grafia canonica no texto ja transcrito.
//      Determinstico, sem limite de tamanho, sem custo e sem alucinacao possivel.
//      Roda SEMPRE, depois de cada etapa. Estrategia herdada do FALA TU, que chegou
//      a ela depois de apanhar do metodo 1 em producao.
//
// Pegadinha do JS que custou tempo la' e nao vai custar aqui: `\b` NAO reconhece
// letras acentuadas. "acordao" nao casaria em "no acordao." com \b. Por isso o
// limite de palavra e' feito com lookaround Unicode explicito.

/** Teto documentado do parametro `prompt` de /v1/audio/transcriptions. */
export const PROMPT_TOKEN_LIMIT = 224;

/** Estimativa conservadora: siglas curtas gastam ~1 token cada 3 caracteres. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

export function parseTerms(raw: string | undefined): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(/[,\n;]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2),
    ),
  ];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Forca a grafia canonica de cada termo no texto.
 * Case-insensitive na busca, canonico na escrita: "cpc" e "Cpc" viram "CPC".
 */
export function applyCanon(text: string, terms: string[]): string {
  let out = text;
  for (const term of terms) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(term)}(?![\\p{L}\\p{N}])`, "giu");
    out = out.replace(re, term);
  }
  return out;
}

/**
 * Instrucao de grafia para o prompt da etapa de texto (sem teto de tokens).
 *
 * O aviso do meio nao e' decorativo: sem ele o modelo tende a "usar" os termos da
 * lista mesmo quando nao foram ditos, entupindo o texto de siglas aleatorias.
 */
export function canonTextInstruction(terms: string[]): string {
  if (terms.length === 0) return "";
  return (
    `\n\nGRAFIA OBRIGATORIA: se — e somente se — algum dos termos abaixo aparecer no texto, ` +
    `use exatamente a grafia listada. Esta lista e' referencia ortografica, NAO conteudo a ` +
    `inserir: nao acrescente nenhum destes termos ao resultado se ele nao estiver no texto ` +
    `original. Termos em maiusculas sao siglas e devem ser mantidos assim; termos em ` +
    `minusculas seguem a capitalizacao da posicao na frase.\n${terms.join(", ")}`
  );
}

/**
 * Monta o prompt da etapa de transcricao respeitando o teto de 224 tokens.
 *
 * A ORDEM importa: a documentacao diz que o modelo considera os ULTIMOS 224 tokens
 * e descarta o comeco silenciosamente. Por isso o contexto da tecla (mais especifico
 * e mais valioso) vai por ULTIMO, e o dicionario — que tem a rede de seguranca da
 * regex no pos-processamento — e' o que se corta primeiro.
 */
export function buildTranscribePrompt(opts: {
  terms: string[];
  context: string;
  useCanon: boolean;
}): { prompt: string; droppedTerms: number } {
  const context = opts.context.trim();
  const contextTokens = estimateTokens(context);
  let budget = PROMPT_TOKEN_LIMIT - contextTokens - 4; // folga para os separadores

  if (!opts.useCanon || opts.terms.length === 0 || budget <= 0) {
    return { prompt: context, droppedTerms: opts.useCanon ? opts.terms.length : 0 };
  }

  const kept: string[] = [];
  for (const term of opts.terms) {
    const cost = estimateTokens(term) + 1; // +1 pela virgula
    if (cost > budget) break;
    budget -= cost;
    kept.push(term);
  }

  const parts = [kept.join(", "), context].filter(Boolean);
  return { prompt: parts.join("\n"), droppedTerms: opts.terms.length - kept.length };
}

/** Quanto do orcamento de 224 tokens a configuracao atual consome (para o painel). */
export function promptBudget(terms: string[], context: string): { used: number; limit: number } {
  const list = terms.join(", ");
  return {
    used: estimateTokens(list) + estimateTokens(context.trim()) + (list && context ? 1 : 0),
    limit: PROMPT_TOKEN_LIMIT,
  };
}
