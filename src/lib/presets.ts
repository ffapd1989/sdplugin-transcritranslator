// Presets: moulds for a key's configuration.
//
// A preset is NOT shared configuration — applying a preset COPIES the values into that
// key, which goes its own way from then on. It is just a way of not filling in 20 fields
// by hand every time you create a key similar to another one.
//
// The built-in presets are NEUTRAL on purpose: the plugin is for general dictation, not a
// tool for any particular domain. Whatever belongs to your work comes in through your
// canonical dictionary and through the presets you save.
//
// Name and instruction come from preset-text.ts and are resolved in the CONTENT language
// — which is independent of the panel's language. You can have the interface in English
// and the presets in Portuguese, which is exactly the case for someone running the Stream
// Deck in English.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { ActionSettings } from "./settings.js";
import type { Locale } from "./prompt-text.js";
import { presetText, type PresetTextKey } from "./preset-text.js";
import { languageName } from "./languages.js";

export type Preset = {
  id: string;
  name: string;
  builtin?: boolean;
  /**
   * Key of the short text explaining the preset, translated in ui/i18n.js.
   * Only the built-in presets have one: yours are described by the summary the panel
   * generates from the settings themselves — that way it never goes stale.
   */
  descKey?: string;
  settings: Partial<ActionSettings>;
};

/** A built-in mould before being translated. */
type BuiltinPreset = {
  id: string;
  textKey: PresetTextKey;
  descKey: string;
  /** The key's label. When absent, the preset's translated name is used. */
  keyLabel?: string;
  settings: Partial<ActionSettings>;
};

const PRESETS_FILE = join(process.env.LOCALAPPDATA ?? "", "transcritranslator", "presets.json");

const BUILTINS: BuiltinPreset[] = [
  {
    id: "raw",
    textKey: "raw",
    descKey: "presetDesc_raw",
    settings: {
      transcribeOn: true, textOn: false, cleanup: false, styleMode: "none",
      icon: "mic", colorIdle: "#404650",
    },
  },
  {
    id: "clean",
    textKey: "clean",
    descKey: "presetDesc_clean",
    settings: {
      transcribeOn: true, textOn: true, cleanup: true, styleMode: "none",
      icon: "mic", colorIdle: "#3B6FD4",
    },
  },
  {
    id: "en",
    textKey: "translate",
    descKey: "presetDesc_en",
    keyLabel: "EN",
    settings: {
      transcribeOn: true, textOn: true, cleanup: true,
      styleMode: "translate", targetLanguage: "en",
      icon: "globe", colorIdle: "#2E7D74",
    },
  },
  {
    id: "es",
    textKey: "translate",
    descKey: "presetDesc_es",
    keyLabel: "ES",
    settings: {
      transcribeOn: true, textOn: true, cleanup: true,
      styleMode: "translate", targetLanguage: "es",
      icon: "globe", colorIdle: "#B8791F",
    },
  },
  {
    id: "pt",
    textKey: "translate",
    descKey: "presetDesc_pt",
    keyLabel: "PT",
    settings: {
      transcribeOn: true, textOn: true, cleanup: true,
      styleMode: "translate", targetLanguage: "pt",
      icon: "globe", colorIdle: "#3B6FD4",
    },
  },
  {
    id: "email",
    textKey: "email",
    descKey: "presetDesc_email",
    settings: {
      transcribeOn: true, textOn: true, cleanup: true, styleMode: "custom",
      icon: "bubble", colorIdle: "#5A4FCF",
    },
  },
  {
    id: "topics",
    textKey: "topics",
    descKey: "presetDesc_topics",
    settings: {
      transcribeOn: true, textOn: true, cleanup: true, styleMode: "custom",
      icon: "pen", colorIdle: "#B8791F",
    },
  },
  {
    id: "rewrite",
    textKey: "proofread",
    descKey: "presetDesc_rewrite",
    settings: {
      transcribeOn: false, textOn: true,
      // Already-written text does not go through DICTATION clean-up: there is no
      // hesitation and no spoken punctuation command to handle.
      cleanup: false, styleMode: "custom",
      icon: "pen", colorIdle: "#7A4FA8",
    },
  },
];


function builtinToPreset(b: BuiltinPreset, locale: Locale): Preset {
  const text = presetText(locale, b.textKey);
  const target = b.settings.targetLanguage;

  // "Translate" + target language, in the content language.
  const name = target ? `${text.name} → ${languageName(locale, target)}` : text.name;

  return {
    id: b.id,
    name,
    builtin: true,
    descKey: b.descKey,
    settings: {
      ...b.settings,
      label: b.keyLabel ?? text.name,
      ...(text.style ? { style: text.style } : {}),
    },
  };
}

export function builtinPresets(locale: Locale): Preset[] {
  return BUILTINS.map((b) => builtinToPreset(b, locale));
}

async function readUserPresets(): Promise<Preset[]> {
  try {
    const raw = await readFile(PRESETS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function listPresets(locale: Locale): Promise<Preset[]> {
  return [...builtinPresets(locale), ...(await readUserPresets())];
}

export async function getPreset(id: string, locale: Locale): Promise<Preset | undefined> {
  return (await listPresets(locale)).find((p) => p.id === id);
}

/**
 * Saves (or replaces) a user preset. Built-in presets are immutable.
 *
 * NOTE: the messages thrown here are echoed verbatim in the property inspector, so they
 * are user-facing text that does NOT go through i18n. English by decision — see vault.ts.
 */
export async function savePreset(
  name: string,
  settings: Partial<ActionSettings>,
  locale: Locale,
): Promise<Preset> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("empty name");
  if (builtinPresets(locale).some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error("that name belongs to a built-in preset");
  }

  const users = await readUserPresets();
  const id = `user-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const preset: Preset = { id, name: trimmed, settings };

  const idx = users.findIndex((p) => p.id === id);
  if (idx >= 0) users[idx] = preset;
  else users.push(preset);

  await mkdir(dirname(PRESETS_FILE), { recursive: true });
  await writeFile(PRESETS_FILE, JSON.stringify(users, null, 2), "utf8");
  return preset;
}

export async function deletePreset(id: string): Promise<void> {
  const users = (await readUserPresets()).filter((p) => p.id !== id);
  await mkdir(dirname(PRESETS_FILE), { recursive: true });
  await writeFile(PRESETS_FILE, JSON.stringify(users, null, 2), "utf8");
}

/** Fields a preset carries. Outside this list (microphone, fine colours) belongs to the key. */
export const PRESET_FIELDS: Array<keyof ActionSettings> = [
  "label",
  "mode",
  "transcribeOn",
  "transcribeModel",
  "language",
  "transcribeContext",
  "useCanonPrompt",
  "textOn",
  "textModel",
  "cleanup",
  "styleMode",
  "targetLanguage",
  "style",
  "autoPaste",
  "icon",
  "colorIdle",
];
