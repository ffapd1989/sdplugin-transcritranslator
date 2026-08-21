// OpenAI client: transcription (step 1) and text (step 2).
//
// Three defences that are not optional here:
//
//   ANTI-ECHO — the GPT-4o models return the `prompt` itself as if it were the
//   transcription when the audio is short or silent. It is behaviour documented by
//   people who got burned by it in production (FALA TU). Since we send the dictionary
//   in the prompt, without this you would tap the key by accident and paste your list
//   of acronyms into the document.
//
//   REFUSAL — the model can refuse in three different shapes: an HTTP error with a
//   content-filter code, HTTP 200 with finish_reason=content_filter, and HTTP 200 with
//   a polite refusal text. All three have to be recognised, otherwise the sentence
//   "I'm sorry, but I can't help with that" would be pasted into the document as if it
//   were the result.
//
//   RETRY — only on transient errors. Repeating a 401 is a waste of time.

import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import { keyText } from "./key-text.js";
import type { Locale } from "./prompt-text.js";

export type ApiErrorKind = "auth" | "transient" | "filter" | "fatal";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: ApiErrorKind,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const TIMEOUT_MS = 120_000;
const RETRIES = 2;

const FILTER_CODES = new Set(["content_filter", "content_policy_violation", "ResponsibleAIPolicyViolation"]);
const FILTER_PHRASES = [
  "content filter", "content_filter", "content policy", "responsible ai",
  "policy violation", "safety system", "violates our",
];

/** Refusals that arrive as HTTP 200, in pt and en. Detection patterns — do not translate. */
const REFUSAL_PREFIXES = [
  "desculpe, mas não posso", "desculpe, mas não posso",
  "lamento, mas não posso", "lamento, mas não posso",
  "não posso ajudar com", "não posso ajudar com",
  "não consigo ajudar com", "não consigo ajudar com",
  "não e possível ajudar", "não é possível ajudar",
  "como assistente de ia", "como uma ia",
  "i'm sorry, but i cannot", "i'm sorry, i cannot", "i cannot assist with",
  "i cannot help with", "i apologize, but i cannot", "i'm unable to", "as an ai",
];

function isFilterError(body: any): boolean {
  const code = body?.error?.code || body?.error?.innererror?.code || body?.code || "";
  if (FILTER_CODES.has(code)) return true;
  const msg = String(body?.error?.message || body?.message || "").toLowerCase();
  return FILTER_PHRASES.some((p) => msg.includes(p));
}

function isRefusalText(text: string): boolean {
  if (!text) return false;
  if (text.length > 500) return false; // a refusal is short; long text is a result
  const lower = text.toLowerCase();
  return REFUSAL_PREFIXES.some((p) => lower.startsWith(p));
}

function classify(status: number, body: any): ApiErrorKind {
  if (isFilterError(body)) return "filter";
  if (status === 401 || status === 403) return "auth";
  if (status === 429 || status >= 500) return "transient";
  return "fatal";
}

function normalizeForCompare(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/**
 * Is the output just the prompt handed back?
 *
 * Compares by word set rather than literal equality, because the model tends to return
 * the list reordered or with different punctuation.
 */
export function looksLikePromptEcho(text: string, prompt: string): boolean {
  const p = normalizeForCompare(prompt);
  const t = normalizeForCompare(text);
  if (!p || !t) return false;
  if (p.includes(t) || t.includes(p)) return true;

  const promptWords = new Set(p.split(" "));
  const textWords = t.split(" ");
  if (textWords.length === 0) return false;
  const shared = textWords.filter((w) => promptWords.has(w)).length;
  return shared / textWords.length >= 0.85;
}

async function withRetries<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const kind = err instanceof ApiError ? err.kind : "transient";
      if (kind !== "transient" || attempt === RETRIES) break;
      await new Promise((r) => setTimeout(r, 2000 * Math.pow(3, attempt)));
    }
  }
  throw lastErr;
}

async function parseError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => ({}));
  const kind = classify(res.status, body);
  const msg = body?.error?.message || res.statusText || `HTTP ${res.status}`;
  return new ApiError(msg, kind, res.status);
}

export type TranscribeResult = { text: string; echoed: boolean };

export async function transcribe(opts: {
  apiKey: string;
  audioPath: string;
  model: string;
  language: string;
  prompt: string;
}): Promise<TranscribeResult> {
  const buf = await readFile(opts.audioPath);

  return withRetries(async () => {
    const form = new FormData();
    form.append("file", new File([buf], basename(opts.audioPath), { type: "audio/mpeg" }));
    form.append("model", opts.model);
    form.append("response_format", "json");
    if (opts.language) form.append("language", opts.language);
    if (opts.prompt) form.append("prompt", opts.prompt);

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) throw await parseError(res);

    const data = (await res.json()) as { text?: string };
    const text = (data.text ?? "").trim();
    return { text, echoed: !!opts.prompt && looksLikePromptEcho(text, opts.prompt) };
  });
}

export async function runText(opts: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userText: string;
}): Promise<string> {
  return withRetries(async () => {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      // max_completion_tokens (not max_tokens) and no temperature: compatible with the
      // whole GPT-4x/5x family.
      body: JSON.stringify({
        model: opts.model,
        messages: [
          { role: "system", content: opts.systemPrompt },
          { role: "user", content: opts.userText },
        ],
        max_completion_tokens: 4096,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) throw await parseError(res);

    const data: any = await res.json();
    if (data?.choices?.[0]?.finish_reason === "content_filter") {
      throw new ApiError("content blocked by the model's policies", "filter", 200);
    }

    const out = String(data?.choices?.[0]?.message?.content ?? "").trim();
    if (isRefusalText(out)) {
      throw new ApiError("the model refused to process this content", "filter", 200);
    }
    if (!out) throw new ApiError("empty response from the model", "fatal", 200);
    return out;
  });
}

/** A message short enough to fit on the key, in the panel's language. */
export function shortError(err: unknown, locale: Locale = "pt"): string {
  const T = keyText(locale);
  if (err instanceof ApiError) {
    switch (err.kind) {
      case "auth": return T.errBadKey;
      case "filter": return T.errBlocked;
      case "transient": return `${T.errGeneric} ${err.status ?? ""}`.trim();
      default: return err.status ? `${T.errGeneric} ${err.status}` : T.errGeneric;
    }
  }
  if (err instanceof Error && err.name === "TimeoutError") return T.errTimeout;
  return T.errGeneric;
}
