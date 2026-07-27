// O caderninho dos atalhos de teclado.
//
// POR QUE ELE EXISTE: o SDK só entrega as ações VISÍVEIS (`SingletonAction.actions`
// é literalmente "the visible actions"). Uma tecla que mora na tela 5 não existe para
// o plugin enquanto você está na tela 1 — não dá para ler as configurações dela nem
// desenhar nela. Como o ponto do atalho de teclado é justamente acionar o que não
// está à vista, o plugin guarda por conta própria uma cópia das configurações de
// cada tecla que já apareceu alguma vez, indexada pelo apelido que a pessoa deu.
//
// POR QUE EM ARQUIVO, e não nas settings globais do Stream Deck: as globais são a
// chave da OpenAI, o dicionário e as preferências de idioma — coisas da PESSOA. Isto
// aqui é um índice derivado, que o plugin reconstrói sozinho conforme as teclas
// aparecem. Misturar os dois faria o painel carregar um mapa inteiro de teclas a cada
// abertura, sem nenhum ganho.
//
// NÃO É CACHE DESCARTÁVEL: se o arquivo sumir, um atalho para uma tecla que ainda não
// apareceu nesta sessão deixa de funcionar até você visitar a tela dela. Por isso ele
// é gravado em disco e lido no boot.

import { readFile, writeFile } from "node:fs/promises";
import { SHORTCUTS_FILE } from "./paths.js";
import type { ActionSettings } from "./settings.js";

export type ShortcutEntry = {
  /** Contexto da ação na sessão em que ela foi vista por último. Pode estar morto. */
  actionId: string;
  /** Cópia das configurações da tecla, para rodar o ditado sem ela na tela. */
  settings: ActionSettings;
  /** Quando foi visto pela última vez (ms). Só para diagnóstico. */
  seenAt: number;
};

/**
 * Apelido -> tecla. Um apelido só, uma tecla só.
 *
 * A regra de conflito é "vale a primeira que apareceu": copiar e colar uma tecla
 * dentro do app do Stream Deck copia as configurações junto, apelido incluso, e
 * adivinhar qual das duas cópias é a "verdadeira" erraria nos casos legítimos.
 * Quem resolve é a pessoa, avisada pelo painel.
 */
const entries = new Map<string, ShortcutEntry>();
let loaded = false;
let writeTimer: NodeJS.Timeout | undefined;

/**
 * Apelido -> forma canônica para caber numa URL.
 *
 * Acento vira sopa de `%C3%AA` no endereço, então some aqui. Isto NÃO fere a regra de
 * acentuação do projeto: o que a pessoa lê continua acentuado; o que é aplainado é um
 * identificador técnico, da mesma família de um nome de variável. O painel mostra o
 * resultado na hora, então nunca é surpresa.
 */
export function normalizeAlias(raw: string | undefined): string {
  return (raw ?? "")
    .normalize("NFD")
    // Faixa dos diacríticos combinantes, escrita em escape para não depender do
    // encoding com que este arquivo for lido algum dia.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Monta o endereço que vai no atalho de teclado. */
export function shortcutUrl(alias: string, pluginUuid = "com.felipe.transcritranslator"): string {
  return `streamdeck://plugins/message/${pluginUuid}/dictate?key=${encodeURIComponent(alias)}&streamdeck=hidden`;
}

export async function loadShortcuts(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const data = JSON.parse(await readFile(SHORTCUTS_FILE, "utf8"));
    if (data && typeof data === "object") {
      for (const [alias, entry] of Object.entries(data as Record<string, ShortcutEntry>)) {
        if (entry && typeof entry.actionId === "string") entries.set(alias, entry);
      }
    }
  } catch {
    /* primeira execução, ou arquivo corrompido: começa vazio */
  }
}

function persist(): void {
  clearTimeout(writeTimer);
  // O painel grava a cada 150 ms enquanto se digita; agrupar evita uma escrita por
  // caractere digitado no campo de apelido.
  writeTimer = setTimeout(() => {
    void writeFile(SHORTCUTS_FILE, JSON.stringify(Object.fromEntries(entries), null, 2), "utf8").catch(
      () => {
        /* o índice se reconstrói sozinho; falha de escrita não pode derrubar o ditado */
      },
    );
  }, 400);
}

export type RememberResult =
  | { status: "ok" }
  | { status: "cleared" }
  | { status: "taken"; byLabel: string };

/**
 * Anota (ou atualiza) a tecla no caderninho. Chamado sempre que uma tecla aparece ou
 * tem as configurações alteradas — é assim que a cópia fica fresca.
 */
export function rememberKey(actionId: string, settings: ActionSettings): RememberResult {
  const alias = normalizeAlias(settings.shortcutAlias);

  // Apelido apagado: a tecla sai do caderninho e deixa de ser alcançável.
  for (const [key, entry] of entries) {
    if (entry.actionId === actionId && key !== alias) {
      entries.delete(key);
      persist();
    }
  }
  if (!alias) return { status: "cleared" };

  const existing = entries.get(alias);
  if (existing && existing.actionId !== actionId) {
    return { status: "taken", byLabel: existing.settings.label?.trim() || alias };
  }

  entries.set(alias, { actionId, settings, seenAt: Date.now() });
  persist();
  return { status: "ok" };
}

export function lookup(alias: string): ShortcutEntry | undefined {
  return entries.get(normalizeAlias(alias));
}

/** Dono atual do apelido, para o painel avisar sobre conflito antes de salvar. */
export function ownerOf(alias: string): { actionId: string; label: string } | undefined {
  const entry = entries.get(normalizeAlias(alias));
  if (!entry) return undefined;
  return { actionId: entry.actionId, label: entry.settings.label?.trim() || normalizeAlias(alias) };
}

/** Só para teste. */
export function resetShortcuts(): void {
  entries.clear();
  loaded = false;
}
