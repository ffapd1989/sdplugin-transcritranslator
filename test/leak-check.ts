// A check that no recording is ever left running with nobody able to stop it.
//
// This is the ONLY test that can see the bug it guards against: the failure lives in the
// interaction between `flash`'s reset timer and a dictation started while that timer is
// still pending, and both sides of it only exist inside a live Stream Deck. A pure test
// would have to mock the SDK, the state registry and the clock — and would then be
// testing the mock.
//
// What it does: fires the keyboard-shortcut address four times. The third lands INSIDE
// the flash window of the second — that is the trigger — and the fourth is an ordinary
// stop. The assertion is that the stop is OBEYED. Before the fix the third dictation had
// its phase reset to "idle" under it, so every later stop hit the phase guard and
// returned; ffmpeg recorded until the plugin died. That is where the 19-hour MP3s came
// from, and it is also what the person at the key sees: an idle-looking key that is
// still recording and will not stop.
//
// The check is deliberately NOT "did anything survive C": a recording that C started and
// nobody stopped is supposed to keep going. Only ignoring the stop is the bug.
//
//   npm run leak
//   npm run leak -- <nickname>
//
// Needs the Stream Deck running with the plugin loaded and at least one key carrying a
// shortcut nickname. The nickname comes from the plugin's own notebook, never hardcoded.
//
// The steps synchronise on the AUDIO FILE, not on a stopwatch. `onDeepLink` holds a
// reentrancy bolt for as long as it is processing a dictation, so an address fired on a
// fixed delay gets swallowed and the sequence slides one step out of place — the run
// then reports a leak that is really just a recording nobody asked to stop. Watching the
// file appear and disappear is what the plugin itself is doing, so the steps cannot
// drift apart.

import { execFile } from "node:child_process";
import { readFile, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { AUDIO_DIR, SHORTCUTS_FILE } from "../src/lib/paths.js";

const PLUGIN_UUID = "com.felipe.transcritranslator";

function sh(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, encoding: "utf8" }, (_e, out) => resolve(out || ""));
  });
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function livePids(): Promise<Set<number>> {
  const out = await sh("tasklist", ["/fi", "IMAGENAME eq ffmpeg.exe", "/nh", "/fo", "csv"]);
  const pids = new Set<number>();
  for (const line of out.split(/\r?\n/)) {
    const m = /^"ffmpeg\.exe","(\d+)"/i.exec(line.trim());
    if (m) pids.add(Number(m[1]));
  }
  return pids;
}

async function pickAlias(): Promise<string> {
  const fromArgs = process.argv[2];
  if (fromArgs) return fromArgs;
  const book = JSON.parse(await readFile(SHORTCUTS_FILE, "utf8")) as Record<string, unknown>;
  const first = Object.keys(book)[0];
  if (!first) throw new Error("no key carries a shortcut nickname — give one: npm run leak -- <nickname>");
  return first;
}

const alias = await pickAlias();
const url = `streamdeck://plugins/message/${PLUGIN_UUID}/dictate?key=${alias}&streamdeck=hidden`;
const fire = (): Promise<string> => sh("cmd", ["/c", "start", "", url]);

console.log(`nickname: ${alias}`);
const before = await livePids();
const filesBefore = new Set(await readdir(AUDIO_DIR).catch(() => []));

async function newAudio(): Promise<string | undefined> {
  for (const name of await readdir(AUDIO_DIR).catch(() => [])) {
    if (name.endsWith(".mp3") && !filesBefore.has(name)) return name;
  }
  return undefined;
}

/** Waits for a recording to start (or, with `gone`, for it to be cleaned up). */
async function until(what: "appears" | "gone", label: string): Promise<void> {
  for (let i = 0; i < 150; i++) {
    const found = await newAudio();
    if ((what === "appears") === !!found) return;
    await wait(100);
  }
  throw new Error(`timed out waiting for the audio to ${what} (${label})`);
}

// A starts, B stops it. B ends with no speech, so the file is deleted and the key
// flashes for 1.8 s — the flash is what schedules the timer that used to do the damage.
console.log("  fires A (start)");
await fire();
await until("appears", "A");
console.log("  fires B (stop) — no speech, so it ends with a flash");
await fire();
await until("gone", "B");

// The file being gone means B has finished and the flash has just begun: the bolt on
// `onDeepLink` is free again and there are ~1.8 s of flash window left. C lands in it.
console.log("  fires C (start again, inside the flash window)");
await fire();
await until("appears", "C");

await wait(2000);
console.log("  fires D (stop) — this is the one that has to be obeyed");
await fire();

// Room for the stop to travel: the `q`, ffmpeg closing the MP3, and the 3 s kill net.
await wait(9000);

const after = await livePids();
const leaked = [...after].filter((pid) => !before.has(pid));

// Whatever C left behind, so a failing run does not leave the machine recording.
for (const pid of leaked) await sh("taskkill", ["/PID", String(pid), "/F"]);
const filesAfter = await readdir(AUDIO_DIR).catch(() => []);
const newFiles: string[] = [];
for (const name of filesAfter) {
  if (filesBefore.has(name) || !name.endsWith(".mp3")) continue;
  newFiles.push(name);
  await unlink(join(AUDIO_DIR, name)).catch(() => {});
}

console.log();
if (leaked.length > 0) {
  console.log(`FAIL — the stop was ignored: ${leaked.length} ffmpeg still recording: ${leaked.join(", ")}`);
  console.log(`       audio left behind: ${newFiles.join(", ") || "(none)"}`);
  console.log("       killed here so the machine is not left recording.");
  process.exit(1);
}

// A dictation that ran and stopped cleanly leaves nothing behind either: with
// keepAudio off, the file is deleted on the way out.
if (newFiles.length > 0) {
  console.log(`FAIL — no ffmpeg leaked, but ${newFiles.length} audio file(s) were left in the folder: ${newFiles.join(", ")}`);
  process.exit(1);
}

console.log("ok — every recording was stopped, and the folder came out clean");
