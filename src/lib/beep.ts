// Feedback beeps, generated on the fly by ffplay (which ships with ffmpeg).
//
// No sound files in the repo: the tone comes out of a `lavfi sine` generator. `-nodisp`
// keeps the ffplay window from showing up.
//
// The start beep does NOT play when the key is pressed — it plays when ffmpeg confirms
// it is capturing. That way it stops being decoration and becomes the "you may speak now"
// signal, which is precisely what keeps the first words from being lost.

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";

export type BeepKind = "start" | "stop" | "cancel" | "error";

const TONES: Record<BeepKind, { freq: number; dur: number }> = {
  start: { freq: 880, dur: 0.07 },
  stop: { freq: 620, dur: 0.07 },
  cancel: { freq: 300, dur: 0.13 },
  error: { freq: 200, dur: 0.18 },
};

/** ffplay lives next to ffmpeg; if the path is just "ffmpeg", trust the PATH. */
function ffplayFrom(ffmpegPath: string): string {
  if (!ffmpegPath || ffmpegPath === "ffmpeg" || ffmpegPath === "ffmpeg.exe") return "ffplay";
  return join(dirname(ffmpegPath), "ffplay.exe");
}

/** Fire and forget: sound must never delay or bring down the dictation. */
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
    /* no sound is better than breaking */
  }
}
