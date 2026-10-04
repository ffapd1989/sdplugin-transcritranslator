// Language names, translated into the language of whoever is reading.
//
// Uses Intl.DisplayNames instead of three hand-written tables. Verified: the Node
// embedded in the Stream Deck (24.x) has **full** ICU, so "en" becomes "inglês",
// "English" or "inglés" as the case may be, with no maintenance — and with no chance of
// forgetting to translate a new language when it is added to the list.
//
// There are two uses with different formatting:
//   - UI:     "Inglês"  (capitalised, inside a <select>)
//   - PROMPT: "inglês"  (lowercase, inside the sentence "Traduza o texto para inglês")
// Portuguese and Spanish write language names in lowercase; English capitalises them.
// Intl already returns the right form for each, so only the UI forces capitalisation.

import type { Locale } from "./prompt-text.js";

/** Languages the person can SPEAK (the transcription's `language` parameter). */
export const SPOKEN_CODES = [
  "pt", "en", "es", "fr", "de", "it", "nl", "ca", "gl", "ja", "zh", "ko", "ru",
  "uk", "pl", "tr", "ar", "he", "hi", "id", "sv", "no", "da", "fi", "el", "cs",
  "ro", "hu", "vi", "th",
];

/**
 * TARGET languages for translation. No "detect": you do not translate into the unknown.
 *
 * Adding a code here is ENOUGH: the name comes out translated from Intl.DisplayNames and
 * the alphabetical ordering adjusts itself, with no table to maintain.
 *
 * Where the list stops: at the same languages already accepted as spoken. OpenAI claims
 * 98 trained languages, but warns that quality drops outside the main list — and
 * offering a target that translates badly is worse than not offering it. Catalan and
 * Galician are left out for that reason: they go in as speech, not as a target.
 */
export const TARGET_CODES = [
  "en", "es", "pt", "fr", "de", "it", "nl", "ja", "zh", "ko", "ru", "ar",
  "uk", "pl", "tr", "he", "hi", "id", "sv", "no", "da", "fi", "el", "cs",
  "ro", "hu", "vi", "th",
];

const cache = new Map<string, Intl.DisplayNames | null>();

function displayNames(locale: Locale): Intl.DisplayNames | null {
  if (!cache.has(locale)) {
    try {
      cache.set(locale, new Intl.DisplayNames([locale], { type: "language" }));
    } catch {
      cache.set(locale, null); // ICU with no data: falls back to the code itself
    }
  }
  return cache.get(locale) ?? null;
}

/** The language name as written inside a sentence. E.g. pt/"en" -> "inglês". */
export function languageName(locale: Locale, code: string): string {
  try {
    return displayNames(locale)?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** The language name as it shows up in a list. E.g. pt/"en" -> "Inglês". */
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
 * List of spoken languages, in the reader's language.
 * The empty item (auto-detection) always comes first; the rest come out in alphabetical
 * order for the interface language — no privileged tongue.
 */
export function spokenLanguages(locale: Locale, autoLabel: string): Option[] {
  return [{ code: "", label: autoLabel }, ...sorted(locale, SPOKEN_CODES)];
}

export function targetLanguages(locale: Locale): Option[] {
  return sorted(locale, TARGET_CODES);
}

/** Short code for the key badge: "EN", "ES". */
export function languageBadge(code: string): string {
  return (code || "").slice(0, 2).toUpperCase();
}
