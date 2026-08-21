// A check of the recording core against real hardware.
//
// Validates what a pure test cannot reach: whether the ffmpeg command with TWO outputs
// works, whether the level meter arrives over stdout, whether the `q` closes the MP3
// properly and whether the file comes out valid.
//
//   npm run mic
//   npm run mic -- "MICROPHONE NAME"

import { stat, unlink } from "node:fs/promises";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Recorder, listAudioDevices } from "../src/lib/recorder.js";
import { getFocusPid } from "../src/lib/deliver.js";

const FFMPEG = "ffmpeg";
const SECONDS = 3;

function probeDuration(file: string): Promise<number> {
  return new Promise((resolve) => {
    execFile(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
      { windowsHide: true },
      (err, stdout) => resolve(err ? -1 : parseFloat(String(stdout).trim()) || -1),
    );
  });
}

const devices = await listAudioDevices(FFMPEG);
console.log("\nmicrophones found:");
devices.forEach((d, i) => console.log(`  ${i + 1}. ${d.name}`));
if (devices.length === 0) {
  console.log("  none — ffmpeg did not see any dshow devices");
  process.exit(1);
}

const device = process.argv[2] || devices[0].name;
const out = join(tmpdir(), `tt-miccheck-${Date.now()}.mp3`);

console.log(`\nrecording ${SECONDS}s from "${device}" — say something\n`);

const pidPromise = getFocusPid();
const rec = new Recorder({
  ffmpegPath: FFMPEG,
  device,
  outFile: out,
  silenceStop: false,
  silenceSeconds: 99,
  maxMinutes: 0,
});

let samples = 0;
let readyAt = 0;
const t0 = Date.now();

rec.on("ready", () => {
  readyAt = Date.now() - t0;
  console.log(`  ffmpeg confirmed capture in ${readyAt} ms`);
});
rec.on("level", (v) => {
  samples++;
  if (samples % 8 === 0) {
    const bars = "█".repeat(Math.round(v * 28)).padEnd(28, "·");
    process.stdout.write(`\r  [${bars}] ${(v * 100).toFixed(0).padStart(3)}%`);
  }
});
rec.on("error", (e) => console.log("\n  ERROR:", e.message));

const done = new Promise<{ ok: boolean; stderr: string }>((r) => rec.on("done", r));
rec.start();
setTimeout(() => rec.stop(), SECONDS * 1000);

const result = await done;
process.stdout.write("\n");

const size = await stat(out).then((s) => s.size).catch(() => 0);
const duration = size ? await probeDuration(out) : -1;
const pid = await pidPromise;

console.log("\nresult:");
console.log(`  exited cleanly     ${result.ok ? "yes" : "NO"}`);
console.log(`  level samples      ${samples}  (~${(samples / SECONDS).toFixed(0)}/s)`);
console.log(`  peak               ${isFinite(rec.peakDb) ? rec.peakDb.toFixed(1) + " dBFS" : "no signal"}`);
console.log(`  speech detected    ${rec.speechDetected ? "yes" : "no"}`);
console.log(`  file               ${size} bytes`);
console.log(`  mp3 duration       ${duration > 0 ? duration.toFixed(2) + "s" : "invalid"}`);
console.log(`  effective kbps     ${duration > 0 ? ((size * 8) / duration / 1000).toFixed(0) : "—"}`);
console.log(`  focused pid        ${pid || "could not read it"}`);
if (result.stderr) console.log(`  stderr             ${result.stderr.slice(0, 300)}`);

await unlink(out).catch(() => {});

const good = result.ok && samples > 10 && size > 0 && duration > SECONDS * 0.6;
console.log(`\n${good ? "CORE OK" : "CORE HAS A PROBLEM"}\n`);
process.exit(good ? 0 : 1);
