// The words that show up ON THE KEY, in the three languages.
//
// This is a third home for text, and it exists because there is a third reader:
// prompt-text.ts is what the AI reads, ui/i18n.js is what you read in the panel, and
// this is what you read on the physical key. The language in charge here is the PANEL's
// (`uiLang`) — whoever looks at the key is the same person who configures the plugin,
// not the model.
//
// Everything here is extremely short on purpose: the key is 72 px and the font size
// shrinks until it fits. Two words per state is the practical ceiling; hence the pairs.

import type { Locale } from "./prompt-text.js";

export type KeyText = {
  /** Factory label, for when the key has none written on it. */
  defaultLabel: string;

  // --- states of the recording cycle ---
  opening: string;
  sending: string;
  writing: string;
  /** Shows up BEFORE the action happens, while the key is being held. */
  releaseCancel: [string, string];
  wait: string;
  cancelled: string;
  tooShort: string;
  busy: [string, string];

  // --- warnings and errors ---
  noKey: string;
  noFfmpeg: string;
  noSpeech: string;
  nothingToDo: [string, string];
  noText: string;
  copied: [string, string];
  rawBlocked: [string, string];

  // --- final confirmation ---
  word: string;
  words: string;

  // --- API errors, boiled down to two words ---
  errBadKey: string;
  errBlocked: string;
  errTimeout: string;
  /** Prefix of "error 429". */
  errGeneric: string;
};

const TEXT: Record<Locale, KeyText> = {
  pt: {
    defaultLabel: "Ditado",
    opening: "abrindo",
    sending: "enviando",
    writing: "escrevendo",
    releaseCancel: ["SOLTE P/", "CANCELAR"],
    wait: "aguarde",
    cancelled: "cancelado",
    tooShort: "curto demais",
    busy: ["gravando em", "outra tecla"],
    noKey: "sem chave",
    noFfmpeg: "sem ffmpeg",
    noSpeech: "sem fala",
    nothingToDo: ["nada a", "fazer"],
    noText: "sem texto",
    copied: ["copiado", "Ctrl+V"],
    rawBlocked: ["cru —", "bloqueado"],
    word: "palavra",
    words: "palavras",
    errBadKey: "chave inválida",
    errBlocked: "bloqueado",
    errTimeout: "timeout",
    errGeneric: "erro",
  },

  en: {
    defaultLabel: "Dictate",
    opening: "opening",
    sending: "sending",
    writing: "writing",
    releaseCancel: ["RELEASE TO", "CANCEL"],
    wait: "wait",
    cancelled: "cancelled",
    tooShort: "too short",
    busy: ["recording on", "another key"],
    noKey: "no key",
    noFfmpeg: "no ffmpeg",
    noSpeech: "no speech",
    nothingToDo: ["nothing", "to do"],
    noText: "no text",
    copied: ["copied", "Ctrl+V"],
    rawBlocked: ["raw —", "blocked"],
    word: "word",
    words: "words",
    errBadKey: "bad key",
    errBlocked: "blocked",
    errTimeout: "timeout",
    errGeneric: "error",
  },

  es: {
    defaultLabel: "Dictado",
    opening: "abriendo",
    sending: "enviando",
    writing: "escribiendo",
    releaseCancel: ["SUELTA P/", "CANCELAR"],
    wait: "espera",
    cancelled: "cancelado",
    tooShort: "muy corto",
    busy: ["grabando en", "otra tecla"],
    noKey: "sin clave",
    noFfmpeg: "sin ffmpeg",
    noSpeech: "sin voz",
    nothingToDo: ["nada que", "hacer"],
    noText: "sin texto",
    copied: ["copiado", "Ctrl+V"],
    rawBlocked: ["crudo —", "bloqueado"],
    word: "palabra",
    words: "palabras",
    errBadKey: "clave inválida",
    errBlocked: "bloqueado",
    errTimeout: "timeout",
    errGeneric: "error",
  },
};

export function keyText(locale: Locale): KeyText {
  return TEXT[locale] ?? TEXT.en;
}

/** "142 words" broken into two lines, with the right singular. */
export function wordCountLines(n: number, locale: Locale): [string, string] {
  const T = keyText(locale);
  return [String(n), n === 1 ? T.word : T.words];
}
