// Where the plugin keeps its own things. All outside the repo, under %LOCALAPPDATA%.

import { mkdir } from "node:fs/promises";
import { join } from "node:path";

export const ROOT = join(process.env.LOCALAPPDATA ?? "", "transcritranslator");
export const AUDIO_DIR = join(ROOT, "audio");
/** Audio from a failed upload lands here, even with "keep audio" switched off. */
export const FAILED_DIR = join(AUDIO_DIR, "falhou");
export const HISTORY_DIR = join(ROOT, "historico");
/** PIDs of live ffmpeg processes, to clean up orphans if the Stream Deck app restarts. */
export const PIDS_FILE = join(ROOT, "ffmpeg-pids.json");
/** Shortcut nickname -> key, to trigger a key that is not on screen (see shortcuts.ts). */
export const SHORTCUTS_FILE = join(ROOT, "atalhos.json");

export async function ensureDirs(): Promise<void> {
  for (const d of [ROOT, AUDIO_DIR, FAILED_DIR, HISTORY_DIR]) {
    await mkdir(d, { recursive: true });
  }
}

/** File name with a local timestamp: 2026-07-25_14-32-07. */
export function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
  );
}
