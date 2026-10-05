// The person's preferences — panel language, content language, dictionary, ffmpeg path —
// in a file of the plugin's own, next to the presets and the shortcut notebook.
//
// WHY NOT the Stream Deck global settings, where they used to live: the app keeps those in
// the Windows Credential Manager, and on a real machine that store broke. Every write
// failed with `CredWrite() err: 1312` and every read with "Failed to parse account settings
// from credentials" — for Elgato's own plugins too. The panel looked saved and came back on
// "Default", and the dictionary was gone. A JSON file under %LOCALAPPDATA% has none of
// that, survives reinstalling the plugin, and is read once instead of a round-trip per use.

import { readFile, writeFile } from "node:fs/promises";
import { PREFS_FILE } from "./paths.js";
import type { GlobalSettings } from "./settings.js";

let prefs: GlobalSettings = {};
let writing: Promise<void> = Promise.resolve();

/** Reads the file at boot. Returns false when there is none yet (or it is unreadable). */
export async function loadPrefs(): Promise<boolean> {
  try {
    const data = JSON.parse(await readFile(PREFS_FILE, "utf8"));
    if (data && typeof data === "object") prefs = data;
    return true;
  } catch {
    return false;
  }
}

export function getPrefs(): GlobalSettings {
  return prefs;
}

/** Replaces the preferences. Writes queue up, so the last one is always the one on disk. */
export function setPrefs(next: GlobalSettings): Promise<void> {
  prefs = next;
  const json = JSON.stringify(next, null, 2);
  writing = writing.then(() => writeFile(PREFS_FILE, json, "utf8")).catch(() => {});
  return writing;
}
