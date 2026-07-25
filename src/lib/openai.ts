// Cliente da OpenAI: transcrição (etapa 1) e texto (etapa 2).
//
// Tres defesas que não são opcionais aqui:
//
//   ANTI-ECO — os modelos GPT-4o devolvem o próprio `prompt` como se fosse a
//   transcrição quando o áudio é curto ou silencioso. E' um comportamento
//   documentado por quem apanhou dele em producao (FALA TU). Como mandamos o
//   dicionario no prompt, sem isto você apertaria a tecla sem querer e colaria a
//   sua lista de siglas dentro do documento.
//
//   RECUSA — o modelo pode recusar em três formatos diferentes: erro HTTP com
//   código de content filter, HTTP 200 com finish_reason=content_filter, e HTTP 200
//   com um texto educado de recusa. Os três precisam ser reconhecidos, senão a
//   frase "Desculpe, mas não posso ajudar com isso" seria colada no documento como
//   se fosse o resultado.
//
//   RETRY — só em erro transitorio. Repetir um 401 é desperdicio de tempo.

import { readFile } from "node:fs/promises";
import { basename } from "node:path";

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

/** Recusas que chegam como HTTP 200, em pt e en. */
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
  if (text.length > 500) return false; // recusa é curta; texto longo é resultado
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
 * A saída é só o prompt de volta?
 *
 * Compara por conjunto de palavras em vez de igualdade literal, porque o modelo
 * costuma devolver a lista reordenada ou com pontuação diferente.
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
      // max_completion_tokens (não max_tokens) e sem temperature: compatível com
      // toda a familia GPT-4x/5x.
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
      throw new ApiError("conteudo bloqueado pelas políticas do modelo", "filter", 200);
    }

    const out = String(data?.choices?.[0]?.message?.content ?? "").trim();
    if (isRefusalText(out)) {
      throw new ApiError("o modelo recusou processar este conteudo", "filter", 200);
    }
    if (!out) throw new ApiError("resposta vazia do modelo", "fatal", 200);
    return out;
  });
}

/** Mensagem curta o bastante para caber na tecla. */
export function shortError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.kind) {
      case "auth": return "chave invalida";
      case "filter": return "bloqueado";
      case "transient": return `erro ${err.status ?? ""}`.trim();
      default: return err.status ? `erro ${err.status}` : "erro";
    }
  }
  if (err instanceof Error && err.name === "TimeoutError") return "timeout";
  return "erro";
}
