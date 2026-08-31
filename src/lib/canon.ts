// Canonical word dictionary — the user's own acronyms and proper terms.
//
// TWO FRONTS, and the second is the one that actually guarantees the result:
//
//   1. Transcription PROMPT: helps the model HEAR correctly ("see-pee-see" -> "CPC").
//      Only this one reaches phonetic error. But it has a 224-token ceiling and a real
//      risk (the model may dump the whole list when the audio is short or silent — see
//      openai.ts, which shields against that).
//
//   2. Regex POST-PROCESSING: forces the canonical spelling on the already-transcribed
//      text. Deterministic, no size limit, no cost and no hallucination possible.
//      Runs ALWAYS, after each step. A strategy inherited from FALA TU, which arrived at
//      it after getting burned by method 1 in production.
//
// A JS gotcha that cost time over there and will not cost any here: `\b` does NOT
// recognise accented letters. "acórdão" would not match inside "no acórdão." with \b.
// That is why the word boundary is built with explicit Unicode lookaround.

/** Documented ceiling of the `prompt` parameter of /v1/audio/transcriptions. */
export const PROMPT_TOKEN_LIMIT = 224;

/** Conservative estimate: short acronyms cost ~1 token per 3 characters. */
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
 * Forces the canonical spelling of every term in the text.
 * Case-insensitive when searching, canonical when writing: "cpc" and "Cpc" become "CPC".
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
 * Builds the transcription step's prompt while respecting the 224-token ceiling.
 *
 * ORDER matters: the documentation says the model considers the LAST 224 tokens and
 * silently drops the beginning. That is why the key's context (more specific and more
 * valuable) goes LAST, and the dictionary — which has the safety net of the regex in
 * post-processing — is the first thing to be cut.
 */
export function buildTranscribePrompt(opts: {
  terms: string[];
  context: string;
  useCanon: boolean;
}): { prompt: string; droppedTerms: number } {
  const context = opts.context.trim();
  const contextTokens = estimateTokens(context);
  let budget = PROMPT_TOKEN_LIMIT - contextTokens - 4; // slack for the separators

  if (!opts.useCanon || opts.terms.length === 0 || budget <= 0) {
    return { prompt: context, droppedTerms: opts.useCanon ? opts.terms.length : 0 };
  }

  const kept: string[] = [];
  for (const term of opts.terms) {
    const cost = estimateTokens(term) + 1; // +1 for the comma
    if (cost > budget) break;
    budget -= cost;
    kept.push(term);
  }

  const parts = [kept.join(", "), context].filter(Boolean);
  return { prompt: parts.join("\n"), droppedTerms: opts.terms.length - kept.length };
}

/**
 * How many terms go into `keywords[]`.
 *
 * There is no documented ceiling, but the field is not free: measured with 66 keywords
 * (60 decoys plus the 6 real ones) the model dropped from 6/6 to 4/6 on the same clip.
 * The cut is by count, and the terms that fall off still have the regex in
 * post-processing behind them — the same safety net as the prompt path.
 */
export const KEYWORDS_LIMIT = 32;

export function buildKeywords(opts: {
  terms: string[];
  useCanon: boolean;
}): { keywords: string[]; droppedTerms: number } {
  if (!opts.useCanon) return { keywords: [], droppedTerms: opts.terms.length };
  return {
    keywords: opts.terms.slice(0, KEYWORDS_LIMIT),
    droppedTerms: Math.max(0, opts.terms.length - KEYWORDS_LIMIT),
  };
}

/** How much of the 224-token budget the current configuration consumes (for the panel). */
export function promptBudget(terms: string[], context: string): { used: number; limit: number } {
  const list = terms.join(", ");
  return {
    used: estimateTokens(list) + estimateTokens(context.trim()) + (list && context ? 1 : 0),
    limit: PROMPT_TOKEN_LIMIT,
  };
}
