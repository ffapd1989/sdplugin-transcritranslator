// Dicionário de palavras canônicas — as siglas e termos próprios de quem usa.
//
// DUAS FRENTES, e a segunda é a que realmente garante o resultado:
//
//   1. PROMPT de transcrição: ajuda o modelo a OUVIR certo ("cê-pê-cê" → "CPC").
//      Só isso alcança erro fonético. Mas tem teto de 224 tokens e um risco real
//      (o modelo pode despejar a lista quando o áudio é curto ou silencioso — ver
//      openai.ts, que blinda contra isso).
//
//   2. PÓS-PROCESSAMENTO por regex: força a grafia canônica no texto já transcrito.
//      Determinístico, sem limite de tamanho, sem custo e sem alucinação possível.
//      Roda SEMPRE, depois de cada etapa. Estratégia herdada do FALA TU, que chegou
//      a ela depois de apanhar do método 1 em produção.
//
// Pegadinha do JS que custou tempo lá e não vai custar aqui: `\b` NÃO reconhece
// letras acentuadas. "acórdão" não casaria em "no acórdão." com \b. Por isso o
// limite de palavra é feito com lookaround Unicode explícito.

/** Teto documentado do parâmetro `prompt` de /v1/áudio/transcriptions. */
export const PROMPT_TOKEN_LIMIT = 224;

/** Estimativa conservadora: siglas curtas gastam ~1 token a cada 3 caracteres. */
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
 * Força a grafia canônica de cada termo no texto.
 * Case-insensitive na busca, canônico na escrita: "cpc" e "Cpc" viram "CPC".
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
 * Instrução de grafia para o prompt da etapa de texto (sem teto de tokens).
 *
 * O aviso do meio não é decorativo: sem ele o modelo tende a "usar" os termos da
 * lista mesmo quando não foram ditos, entupindo o texto de siglas aleatórias.
 */
export function canonTextInstruction(terms: string[]): string {
  if (terms.length === 0) return "";
  return (
    `\n\nGRAFIA OBRIGATÓRIA: se — e somente se — algum dos termos abaixo aparecer no texto, ` +
    `use exatamente a grafia listada. Esta lista é referência ortográfica, NÃO conteúdo a ` +
    `inserir: não acrescente nenhum destes termos ao resultado se ele não estiver no texto ` +
    `original. Termos em maiúsculas são siglas e devem ser mantidos assim; termos em ` +
    `minúsculas seguem a capitalização da posição na frase.\n${terms.join(", ")}`
  );
}

/**
 * Monta o prompt da etapa de transcrição respeitando o teto de 224 tokens.
 *
 * A ORDEM importa: a documentação diz que o modelo considera os ÚLTIMOS 224 tokens
 * e descarta o começo silenciosamente. Por isso o contexto da tecla (mais específico
 * e mais valioso) vai por ÚLTIMO, e o dicionário — que tem a rede de segurança da
 * regex no pós-processamento — é o que se corta primeiro.
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
    const cost = estimateTokens(term) + 1; // +1 pela vírgula
    if (cost > budget) break;
    budget -= cost;
    kept.push(term);
  }

  const parts = [kept.join(", "), context].filter(Boolean);
  return { prompt: parts.join("\n"), droppedTerms: opts.terms.length - kept.length };
}

/** Quanto do orçamento de 224 tokens a configuração atual consome (para o painel). */
export function promptBudget(terms: string[], context: string): { used: number; limit: number } {
  const list = terms.join(", ");
  return {
    used: estimateTokens(list) + estimateTokens(context.trim()) + (list && context ? 1 : 0),
    limit: PROMPT_TOKEN_LIMIT,
  };
}
