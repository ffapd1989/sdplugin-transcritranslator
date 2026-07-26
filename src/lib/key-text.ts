// As palavras que aparecem NA TECLA, nos três idiomas.
//
// É um terceiro lugar de texto, e existe porque tem um terceiro leitor: prompt-text.ts
// é o que a IA lê, ui/i18n.js é o que se lê no painel, e isto é o que se lê na tecla
// física. O idioma que manda aqui é o do PAINEL (`uiLang`) — quem olha a tecla é a
// mesma pessoa que configura o plugin, não o modelo.
//
// Tudo aqui é curtíssimo de propósito: a tecla tem 72 px e o corpo da fonte encolhe
// até caber. Duas palavras por estado é o teto prático; por isso os pares.

import type { Locale } from "./prompt-text.js";

export type KeyText = {
  /** Rótulo de fábrica, quando a tecla não tem um escrito. */
  defaultLabel: string;

  // --- estados do ciclo de gravação ---
  opening: string;
  sending: string;
  writing: string;
  /** Aparece ANTES de a ação acontecer, enquanto a tecla está segurada. */
  releaseCancel: [string, string];
  wait: string;
  cancelled: string;
  tooShort: string;
  busy: [string, string];

  // --- avisos e erros ---
  noKey: string;
  noFfmpeg: string;
  noSpeech: string;
  nothingToDo: [string, string];
  noText: string;
  copied: [string, string];
  rawBlocked: [string, string];

  // --- confirmação final ---
  word: string;
  words: string;

  // --- erros de API, resumidos em duas palavras ---
  errBadKey: string;
  errBlocked: string;
  errTimeout: string;
  /** Prefixo de "erro 429". */
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

/** "142 palavras" quebrado em duas linhas, com o singular certo. */
export function wordCountLines(n: number, locale: Locale): [string, string] {
  const T = keyText(locale);
  return [String(n), n === 1 ? T.word : T.words];
}
