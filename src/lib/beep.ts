// Bipes de feedback, gerados na hora pelo ffplay (que já vem com o ffmpeg).
//
// Sem arquivos de som no repo: o tom sai de um gerador `lavfi sine`. O `-nodisp`
// impede a janela do ffplay de aparecer.
//
// O bipe de início NÃO toca quando a tecla é apertada — toca quando o ffmpeg
// confirma que está capturando. Assim ele deixa de ser enfeite e vira o sinal de
// "pode falar", que é justamente o que evita perder as primeiras palavras.

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";

export type BeepKind = "start" | "stop" | "cancel" | "error";

const TONES: Record<BeepKind, { freq: number; dur: number }> = {
  start: { freq: 880, dur: 0.07 },
  stop: { freq: 620, dur: 0.07 },
  cancel: { freq: 300, dur: 0.13 },
  error: { freq: 200, dur: 0.18 },
};

/** ffplay mora ao lado do ffmpeg; se o caminho for só "ffmpeg", confia no PATH. */
function ffplayFrom(ffmpegPath: string): string {
  if (!ffmpegPath || ffmpegPath === "ffmpeg" || ffmpegPath === "ffmpeg.exe") return "ffplay";
  return join(dirname(ffmpegPath), "ffplay.exe");
}

/** Dispara e esquece: som nunca deve atrasar nem derrubar o ditado. */
export function beep(ffmpegPath: string, kind: BeepKind): void {
  const { freq, dur } = TONES[kind];
  try {
    const p = spawn(
      ffplayFrom(ffmpegPath),
      [
        "-hide_banner", "-loglevel", "quiet",
        "-nodisp", "-autoexit",
        "-f", "lavfi",
        "-i", `sine=frequency=${freq}:duration=${dur}`,
      ],
      { windowsHide: true, stdio: "ignore", detached: false },
    );
    p.on("error", () => {});
  } catch {
    /* sem som é melhor que quebrar */
  }
}
