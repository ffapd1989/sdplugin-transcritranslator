// Presets: moldes de configuracao de tecla.
//
// Um preset NAO e' configuracao compartilhada — aplicar um preset COPIA os valores
// para aquela tecla, que segue independente dali em diante. E' so' um jeito de nao
// preencher 20 campos na mao toda vez que voce cria uma tecla parecida com outra.
//
// Os presets de fabrica sao todos NEUTROS de proposito: o plugin e' de ditado geral,
// nao uma ferramenta de nenhum dominio. O que for do seu trabalho entra pelo seu
// dicionario canonico e pelos presets que voce salvar.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { ActionSettings } from "./settings.js";

export type Preset = {
  id: string;
  name: string;
  builtin?: boolean;
  settings: Partial<ActionSettings>;
};

const PRESETS_FILE = join(
  process.env.LOCALAPPDATA ?? "",
  "transcritranslator",
  "presets.json",
);

export const BUILTIN_PRESETS: Preset[] = [
  {
    id: "raw",
    name: "Ditado cru",
    builtin: true,
    settings: {
      label: "Ditado",
      transcribeOn: true,
      textOn: false,
      cleanup: false,
      style: "",
      icon: "mic",
      colorIdle: "#404650",
    },
  },
  {
    id: "clean",
    name: "Ditado limpo",
    builtin: true,
    settings: {
      label: "Ditado",
      transcribeOn: true,
      textOn: true,
      cleanup: true,
      style: "",
      icon: "mic",
      colorIdle: "#3B6FD4",
    },
  },
  {
    id: "en",
    name: "→ Ingles",
    builtin: true,
    settings: {
      label: "EN",
      transcribeOn: true,
      textOn: true,
      cleanup: true,
      style: "Traduza o texto para o ingles, preservando o registro e o tom do original.",
      icon: "globe",
      colorIdle: "#2E7D74",
    },
  },
  {
    id: "email",
    name: "E-mail formal",
    builtin: true,
    settings: {
      label: "E-mail",
      transcribeOn: true,
      textOn: true,
      cleanup: true,
      style:
        "Reescreva como um e-mail profissional: saudacao breve, corpo objetivo em paragrafos curtos e fecho cordial. " +
        "Nao invente destinatario, assunto, prazos nem informacoes que nao estejam no texto.",
      icon: "bubble",
      colorIdle: "#5A4FCF",
    },
  },
  {
    id: "topics",
    name: "Topicos",
    builtin: true,
    settings: {
      label: "Topicos",
      transcribeOn: true,
      textOn: true,
      cleanup: true,
      style:
        "Reorganize o conteudo em topicos com marcadores, um item por ideia, na ordem em que foram ditas. " +
        "Nao acrescente itens, nao agrupe ideias distintas e nao crie titulos.",
      icon: "pen",
      colorIdle: "#B8791F",
    },
  },
  {
    id: "rewrite",
    name: "So reescrever selecao",
    builtin: true,
    settings: {
      label: "Reescrever",
      transcribeOn: false,
      textOn: true,
      cleanup: true,
      style: "",
      icon: "pen",
      colorIdle: "#7A4FA8",
    },
  },
];

async function readUserPresets(): Promise<Preset[]> {
  try {
    const raw = await readFile(PRESETS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function listPresets(): Promise<Preset[]> {
  return [...BUILTIN_PRESETS, ...(await readUserPresets())];
}

export async function getPreset(id: string): Promise<Preset | undefined> {
  return (await listPresets()).find((p) => p.id === id);
}

/** Salva (ou substitui) um preset do usuario. Presets de fabrica sao imutaveis. */
export async function savePreset(name: string, settings: Partial<ActionSettings>): Promise<Preset> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("nome vazio");
  if (BUILTIN_PRESETS.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error("esse nome e' de um preset de fabrica");
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

/** Campos que um preset carrega. Fora daqui (microfone, cores finas) e' da tecla. */
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
  "style",
  "autoPaste",
  "icon",
  "colorIdle",
];
