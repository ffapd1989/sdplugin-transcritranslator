// Nomes de idioma, traduzidos para o idioma de quem está lendo.
//
// Usa Intl.DisplayNames em vez de três tabelas escritas à mão. Verificado: o Node
// embarcado do Stream Deck (20.x) tem ICU **completo**, então "en" vira "inglês",
// "English" ou "inglés" conforme o caso, sem manutenção — e sem esquecer de traduzir
// um idioma novo quando ele for acrescentado à lista.
//
// Há dois usos com formatações diferentes:
//   - UI:     "Inglês"  (capitalizado, dentro de um <select>)
//   - PROMPT: "inglês"  (minúsculo, dentro da frase "Traduza o texto para inglês")
// Português e espanhol escrevem idioma em minúscula; inglês, em maiúscula. O Intl já
// devolve a forma certa de cada um, então só a UI recebe capitalização forçada.

import type { Locale } from "./prompt-text.js";

/** Idiomas que a pessoa pode FALAR (parâmetro `language` da transcrição). */
export const SPOKEN_CODES = [
  "pt", "en", "es", "fr", "de", "it", "nl", "ca", "gl", "ja", "zh", "ko", "ru",
  "uk", "pl", "tr", "ar", "he", "hi", "id", "sv", "no", "da", "fi", "el", "cs",
  "ro", "hu", "vi", "th",
];

/** Idiomas de DESTINO da tradução. Sem "detectar": não se traduz para o desconhecido. */
export const TARGET_CODES = [
  "en", "es", "pt", "fr", "de", "it", "nl", "ja", "zh", "ko", "ru", "ar",
];

const cache = new Map<string, Intl.DisplayNames | null>();

function displayNames(locale: Locale): Intl.DisplayNames | null {
  if (!cache.has(locale)) {
    try {
      cache.set(locale, new Intl.DisplayNames([locale], { type: "language" }));
    } catch {
      cache.set(locale, null); // ICU sem dados: cai para o próprio código
    }
  }
  return cache.get(locale) ?? null;
}

/** Nome do idioma como ele se escreve dentro de uma frase. Ex.: pt/"en" → "inglês". */
export function languageName(locale: Locale, code: string): string {
  try {
    return displayNames(locale)?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Nome do idioma para aparecer numa lista. Ex.: pt/"en" → "Inglês". */
export function languageLabel(locale: Locale, code: string): string {
  const name = languageName(locale, code);
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
}

type Option = { code: string; label: string };

function sorted(locale: Locale, codes: string[]): Option[] {
  return codes
    .map((code) => ({ code, label: languageLabel(locale, code) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}

/**
 * Lista de idiomas falados, no idioma de quem lê.
 * O item vazio (detecção automática) vem sempre primeiro; o resto sai em ordem
 * alfabética do idioma da interface — nenhuma língua privilegiada.
 */
export function spokenLanguages(locale: Locale, autoLabel: string): Option[] {
  return [{ code: "", label: autoLabel }, ...sorted(locale, SPOKEN_CODES)];
}

export function targetLanguages(locale: Locale): Option[] {
  return sorted(locale, TARGET_CODES);
}

/** Sigla curta para o badge da tecla: "EN", "ES". */
export function languageBadge(code: string): string {
  return (code || "").slice(0, 2).toUpperCase();
}
