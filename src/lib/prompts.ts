// Layered assembly of the text step's system prompt.
//
//   Layer A — DICTATION CLEAN-UP: generic rules for turning speech into text.
//             It does not change what you said; it tidies up how it came out written.
//   Layer B — STYLE: translating into a language, or the key's free instruction.
//   + canonical spelling  + safety locks.
//
// The layers are independent: A alone gives "clean dictation"; B alone applies only the
// style; A+B does both in a single API call.
//
// All the text comes from prompt-text.ts, in the language resolved for that key. Layer A
// is adapted from FALA TU, with nothing of its legal domain — the rules we took
// (spoken punctuation, self-correction, hesitations, numbers, dates) hold for any
// dictation, in any language.

import { promptText, type Locale } from "./prompt-text.js";
import { languageName } from "./languages.js";
import type { StyleMode } from "./settings.js";

export type TextPromptOptions = {
  locale: Locale;
  cleanup: boolean;
  styleMode: StyleMode;
  /** ISO code of the target language (e.g. "en"). */
  targetLanguage: string;
  style: string;
  canonTerms: string[];
};

type StyleInput = Pick<TextPromptOptions, "locale" | "styleMode" | "targetLanguage" | "style">;

/** Layer B's instruction, whatever the mode. Empty = there is no layer B. */
export function styleInstruction(o: StyleInput): string {
  const T = promptText(o.locale);
  if (o.styleMode === "translate") {
    return T.translate(languageName(o.locale, o.targetLanguage));
  }
  if (o.styleMode === "custom") return o.style.trim();
  return "";
}

/** true if there is anything for the text step to do. */
export function hasTextWork(o: StyleInput & { cleanup: boolean }): boolean {
  return o.cleanup || styleInstruction(o).length > 0;
}

function canonBlock(o: TextPromptOptions): string {
  if (o.canonTerms.length === 0) return "";
  return promptText(o.locale).canon(o.canonTerms.join(", "));
}

function guardsBlock(locale: Locale): string {
  const T = promptText(locale);
  return T.injectionGuard + T.outputRule + T.secrecy;
}

function styleBlock(o: TextPromptOptions): string {
  const style = styleInstruction(o);
  if (!style) return "";
  const T = promptText(o.locale);
  return `${o.cleanup ? T.alsoApply : T.justApply}\n${style}`;
}

/**
 * The pieces of the system prompt, named — this is exactly what the panel shows when you
 * ask to see what will be sent. No hidden text.
 */
export function textPromptParts(o: TextPromptOptions): Array<{ title: string; body: string }> {
  const T = promptText(o.locale);
  const parts: Array<{ title: string; body: string }> = [];

  if (o.cleanup) parts.push({ title: T.partCleanup, body: T.cleanup });

  const block = styleBlock(o);
  if (block) {
    parts.push({
      title:
        o.styleMode === "translate"
          ? T.partTranslate(languageName(o.locale, o.targetLanguage))
          : T.partCustom,
      body: block,
    });
  }

  if (parts.length === 0) parts.push({ title: T.partNone, body: T.passthrough });

  const canon = canonBlock(o);
  if (canon) parts.push({ title: T.partCanon, body: canon.trim() });

  parts.push({ title: T.partGuards, body: guardsBlock(o.locale).trim() });
  return parts;
}

export function buildTextSystemPrompt(o: TextPromptOptions): string {
  const T = promptText(o.locale);
  const layers: string[] = [];

  if (o.cleanup) layers.push(T.cleanup);

  const block = styleBlock(o);
  if (block) layers.push(block);

  // hasTextWork() blocks this earlier, but an empty system prompt would be worse.
  if (layers.length === 0) layers.push(T.passthrough);

  return layers.join("\n\n") + canonBlock(o) + guardsBlock(o.locale);
}
