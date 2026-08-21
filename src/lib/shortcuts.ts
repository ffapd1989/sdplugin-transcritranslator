// The keyboard shortcuts' little notebook.
//
// WHY IT EXISTS: the SDK only hands over the VISIBLE actions (`SingletonAction.actions`
// is literally "the visible actions"). A key that lives on page 5 does not exist as far
// as the plugin is concerned while you are on page 1 — you cannot read its settings nor
// draw on it. Since the whole point of the keyboard shortcut is to trigger what is not
// in sight, the plugin keeps a copy of its own of the settings of every key that has
// shown up at least once, indexed by the nickname the person gave it.
//
// WHY IN A FILE, and not in the Stream Deck global settings: the globals are the OpenAI
// key, the dictionary and the language preferences — the PERSON's things. This is a
// derived index, which the plugin rebuilds by itself as keys show up. Mixing the two
// would make the panel load a whole map of keys on every open, for no gain at all.
//
// IT IS NOT A DISPOSABLE CACHE: if the file disappears, a shortcut pointing at a key
// that has not shown up in this session stops working until you visit its page. That is
// why it is written to disk and read at boot.

import { readFile, writeFile } from "node:fs/promises";
import { SHORTCUTS_FILE } from "./paths.js";
import type { ActionSettings } from "./settings.js";

export type ShortcutEntry = {
  /** The action's context in the session it was last seen in. May be dead. */
  actionId: string;
  /** Copy of the key's settings, so dictation can run without it on screen. */
  settings: ActionSettings;
  /** When it was last seen (ms). For diagnostics only. */
  seenAt: number;
};

/**
 * Nickname -> key. One nickname, one key.
 *
 * The conflict rule is "first one to show up wins": copying and pasting a key inside the
 * Stream Deck app copies the settings along with it, nickname included, and guessing
 * which of the two copies is the "real" one would get the legitimate cases wrong. The
 * person settles it, warned by the panel.
 */
const entries = new Map<string, ShortcutEntry>();
let loaded = false;
let writeTimer: NodeJS.Timeout | undefined;

/**
 * Nickname -> canonical form, so it fits in a URL.
 *
 * An accent turns into `%C3%AA` soup in the address, so it goes away here. This does NOT
 * break the project's accent rule: what the person reads stays accented; what gets
 * flattened is a technical identifier, of the same family as a variable name. The panel
 * shows the result immediately, so it is never a surprise.
 */
export function normalizeAlias(raw: string | undefined): string {
  return (raw ?? "")
    .normalize("NFD")
    // The combining diacritics range, written as escapes so it does not depend on
    // whatever encoding this file is read with some day.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Builds the address that goes into the keyboard shortcut. */
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
    /* first run, or a corrupted file: start empty */
  }
}

function persist(): void {
  clearTimeout(writeTimer);
  // The panel saves every 150 ms while you type; batching avoids one write per
  // character typed into the nickname field.
  writeTimer = setTimeout(() => {
    void writeFile(SHORTCUTS_FILE, JSON.stringify(Object.fromEntries(entries), null, 2), "utf8").catch(
      () => {
        /* the index rebuilds itself; a write failure must not bring down dictation */
      },
    );
  }, 400);
}

export type RememberResult =
  | { status: "ok" }
  | { status: "cleared" }
  | { status: "taken"; byLabel: string };

/**
 * Notes the key down (or updates it) in the notebook. Called whenever a key shows up or
 * has its settings changed — that is how the copy stays fresh.
 */
export function rememberKey(actionId: string, settings: ActionSettings): RememberResult {
  const alias = normalizeAlias(settings.shortcutAlias);

  // Nickname erased: the key leaves the notebook and stops being reachable.
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

/** Current owner of the nickname, so the panel can warn about a clash before saving. */
export function ownerOf(alias: string): { actionId: string; label: string } | undefined {
  const entry = entries.get(normalizeAlias(alias));
  if (!entry) return undefined;
  return { actionId: entry.actionId, label: entry.settings.label?.trim() || normalizeAlias(alias) };
}

/** For tests only. */
export function resetShortcuts(): void {
  entries.clear();
  loaded = false;
}
