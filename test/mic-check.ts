// Checagem do núcleo de gravação contra o hardware de verdade.
//
// Valida o que teste puro não alcança: se o comando do ffmpeg com DUAS saídas
// funciona, se o medidor de nível chega pelo stdout, se o `q` fecha o MP3 direito
// e se o arquivo sai válido.
//
//   npm run mic
//   npm run mic -- "NOME DO MICROFONE"

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
console.log("\nmicrofones encontrados:");
devices.forEach((d, i) => console.log(`  ${i + 1}. ${d.name}`));
if (devices.length === 0) {
  console.log("  nenhum — o ffmpeg não enxergou dispositivos dshow");
  process.exit(1);
}

const device = process.argv[2] || devices[0].name;
const out = join(tmpdir(), `tt-miccheck-${Date.now()}.mp3`);

console.log(`\ngravando ${SECONDS}s de "${device}" — fale alguma coisa\n`);

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
  console.log(`  ffmpeg confirmou captura em ${readyAt} ms`);
});
rec.on("level", (v) => {
  samples++;
  if (samples % 8 === 0) {
    const bars = "█".repeat(Math.round(v * 28)).padEnd(28, "·");
    process.stdout.write(`\r  [${bars}] ${(v * 100).toFixed(0).padStart(3)}%`);
  }
});
rec.on("error", (e) => console.log("\n  ERRO:", e.message));

const done = new Promise<{ ok: boolean; stderr: string }>((r) => rec.on("done", r));
rec.start();
setTimeout(() => rec.stop(), SECONDS * 1000);

const result = await done;
process.stdout.write("\n");

const size = await stat(out).then((s) => s.size).catch(() => 0);
const duration = size ? await probeDuration(out) : -1;
const pid = await pidPromise;

console.log("\nresultado:");
console.log(`  saiu limpo         ${result.ok ? "sim" : "NÃO"}`);
console.log(`  amostras de nível  ${samples}  (~${(samples / SECONDS).toFixed(0)}/s)`);
console.log(`  pico               ${isFinite(rec.peakDb) ? rec.peakDb.toFixed(1) + " dBFS" : "nenhum sinal"}`);
console.log(`  fala detectada     ${rec.speechDetected ? "sim" : "não"}`);
console.log(`  arquivo            ${size} bytes`);
console.log(`  duração do mp3     ${duration > 0 ? duration.toFixed(2) + "s" : "inválido"}`);
console.log(`  kbps efetivo       ${duration > 0 ? ((size * 8) / duration / 1000).toFixed(0) : "—"}`);
console.log(`  pid em foco        ${pid || "não consegui ler"}`);
if (result.stderr) console.log(`  stderr             ${result.stderr.slice(0, 300)}`);

await unlink(out).catch(() => {});

const good = result.ok && samples > 10 && size > 0 && duration > SECONDS * 0.6;
console.log(`\n${good ? "NÚCLEO OK" : "NÚCLEO COM PROBLEMA"}\n`);
process.exit(good ? 0 : 1);
