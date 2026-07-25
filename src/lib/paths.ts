// Onde o plugin guarda o que e' dele. Tudo fora do repo, em %LOCALAPPDATA%.

import { mkdir } from "node:fs/promises";
import { join } from "node:path";

export const ROOT = join(process.env.LOCALAPPDATA ?? "", "transcritranslator");
export const AUDIO_DIR = join(ROOT, "audio");
/** Audio de envio que falhou fica aqui, mesmo com "guardar audio" desligado. */
export const FAILED_DIR = join(AUDIO_DIR, "falhou");
export const HISTORY_DIR = join(ROOT, "historico");
/** PIDs de ffmpeg vivos, para limpar orfaos se o app Stream Deck reiniciar. */
export const PIDS_FILE = join(ROOT, "ffmpeg-pids.json");

export async function ensureDirs(): Promise<void> {
  for (const d of [ROOT, AUDIO_DIR, FAILED_DIR, HISTORY_DIR]) {
    await mkdir(d, { recursive: true });
  }
}

/** Nome de arquivo com carimbo de tempo local: 2026-07-25_14-32-07. */
export function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
  );
}
