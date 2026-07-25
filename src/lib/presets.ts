// Presets: moldes de configuração de tecla.
//
// Um preset NÃO é configuração compartilhada — aplicar um preset COPIA os valores
// para aquela tecla, que segue independente dali em diante. É só um jeito de não
// preencher 20 campos na mão toda vez que você cria uma tecla parecida com outra.
//
// Os presets de fábrica são NEUTROS de propósito: o plugin é de ditado geral, não uma
// ferramenta de nenhum domínio. O que for do seu trabalho entra pelo seu dicionário
// canônico e pelos presets que você salvar.
//
// Nome e instrução vêm de preset-text.ts e são resolvidos no idioma de CONTEÚDO — que
// é independente do idioma do painel. Dá para ter a interface em inglês e os presets
// em português, que é exatamente o caso de quem usa o Stream Deck em inglês.

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
   * Chave do texto curto que explica o preset, traduzido em ui/i18n.js.
   * Só os presets de fábrica têm: os seus são descritos pelo resumo que o painel
   * gera a partir das próprias configurações — assim nunca fica desatualizado.
   */
  descKey?: string;
  settings: Partial<ActionSettings>;
};

/** Molde de fábrica antes de ser traduzido. */
type BuiltinPreset = {
  id: string;
  textKey: PresetTextKey;
  descKey: string;
  /** Rótulo da tecla. Quando ausente, usa o nome traduzido do preset. */
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
      // Texto já escrito não passa pela limpeza de DITADO: não há hesitação nem
      // comando de pontuação falado para tratar.
      cleanup: false, styleMode: "custom",
      icon: "pen", colorIdle: "#7A4FA8",
    },
  },
];


function builtinToPreset(b: BuiltinPreset, locale: Locale): Preset {
  const text = presetText(locale, b.textKey);
  const target = b.settings.targetLanguage;

  // "Traduzir" + idioma de destino, no idioma do conteúdo.
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

/** Salva (ou substitui) um preset do usuário. Presets de fábrica são imutáveis. */
export async function savePreset(
  name: string,
  settings: Partial<ActionSettings>,
  locale: Locale,
): Promise<Preset> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("nome vazio");
  if (builtinPresets(locale).some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error("esse nome é de um preset de fábrica");
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

/** Campos que um preset carrega. Fora daqui (microfone, cores finas) é da tecla. */
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
