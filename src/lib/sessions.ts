// Live key state, OUTSIDE the action instance.
//
// WHY OUTSIDE: the SDK fires willDisappear when you navigate to another page, profile or
// folder — the key vanishes and drops out of the list of visible actions. If the
// recording state lived in the instance, switching pages mid-dictation would kill the
// recording. Here it lives in a global registry indexed by the action id (which does not
// change), so the recording carries on in the background and the key picks the live
// state back up when you return.
//
// GLOBAL LOCK: only one recording at a time on the whole machine. You have one mouth —
// two simultaneous recordings from the same microphone would produce two texts fighting
// over the clipboard and the Ctrl+V at the end.

import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { PIDS_FILE } from "./paths.js";
import type { Recorder } from "./recorder.js";

export type Phase =
  | "idle"
  | "arming"
  | "recording"
  | "stopping"
  | "transcribing"
  | "texting"
  | "done"
  | "warn"
  | "error";

export type KeyState = {
  phase: Phase;
  recorder?: Recorder;
  audioPath?: string;
  focusPid: number;
  /** Level history for the waveform (0..1, most recent last). */
  levels: number[];
  startedAt: number;
  /** Transient text shown on the key (e.g. "copied"). */
  message?: string[];
  /** Aborts the API call in flight. */
  abort?: AbortController;
  /** Moment of keyDown, to tell a short tap from a hold. */
  downAt?: number;
  /** Timer that switches the key to "RELEASE TO CANCEL" while you hold it. */
  holdTimer?: NodeJS.Timeout;
  /** Set between "this key asked to record" and "the recorder exists". See `claimStart`. */
  starting?: boolean;
  resetTimer?: NodeJS.Timeout;
};

const states = new Map<string, KeyState>();
let lockOwner: string | null = null;

export function getState(actionId: string): KeyState {
  let s = states.get(actionId);
  if (!s) {
    s = { phase: "idle", focusPid: 0, levels: [], startedAt: 0 };
    states.set(actionId, s);
  }
  return s;
}

export function allStates(): Map<string, KeyState> {
  return states;
}

/**
 * Reserves the right to START a recording on this key. SYNCHRONOUS by contract.
 *
 * The machine-wide lock below answers "is another key recording?", and it deliberately
 * says yes to the key that already owns it — a key must be able to recover the lock after
 * a start that failed halfway. That leaves the question it does NOT answer: whether THIS
 * key is already recording. `startRecording` awaits four times before the recorder exists,
 * so two triggers on the same key both used to walk through, and the second overwrote
 * `state.recorder` — the first ffmpeg then had no reference, no timer and no way to be
 * stopped. That is what multiplied one abandoned dictation into several.
 *
 * Nothing here may become async: the burst from a held-down keyboard shortcut arrives
 * precisely during an await.
 */
export function claimStart(actionId: string): boolean {
  const s = getState(actionId);
  if (s.starting || s.recorder) return false;
  s.starting = true;
  return true;
}

/** Releases the reservation. The recorder, if it exists by now, takes over the guard. */
export function finishStart(actionId: string): void {
  getState(actionId).starting = false;
}

/** true if the lock was acquired. */
export function acquireLock(actionId: string): boolean {
  if (lockOwner && lockOwner !== actionId) return false;
  lockOwner = actionId;
  return true;
}

export function releaseLock(actionId: string): void {
  if (lockOwner === actionId) lockOwner = null;
}

export function isBusyElsewhere(actionId: string): boolean {
  return lockOwner !== null && lockOwner !== actionId;
}

// --- PID tracking, so no ffmpeg is left orphaned ---

const livePids = new Set<number>();

export async function trackPid(pid: number | undefined): Promise<void> {
  if (!pid) return;
  livePids.add(pid);
  await persistPids();
}

export async function untrackPid(pid: number | undefined): Promise<void> {
  if (!pid) return;
  livePids.delete(pid);
  await persistPids();
}

async function persistPids(): Promise<void> {
  try {
    await writeFile(PIDS_FILE, JSON.stringify([...livePids]), "utf8");
  } catch {
    /* tracking is best-effort */
  }
}

/**
 * Kills ffmpeg processes left behind by an abrupt shutdown of the Stream Deck app.
 *
 * Checks that the PID is still an ffmpeg before killing: Windows recycles PIDs, and
 * killing blindly could bring down somebody else's process.
 */
export async function cleanupOrphans(): Promise<void> {
  let pids: number[] = [];
  try {
    pids = JSON.parse(await readFile(PIDS_FILE, "utf8"));
  } catch {
    return;
  }
  if (!Array.isArray(pids) || pids.length === 0) return;

  await Promise.all(
    pids.map(
      (pid) =>
        new Promise<void>((resolve) => {
          execFile(
            "tasklist",
            ["/fi", `PID eq ${pid}`, "/nh"],
            { windowsHide: true },
            (err, stdout) => {
              if (!err && /ffmpeg\.exe/i.test(stdout || "")) {
                execFile("taskkill", ["/PID", String(pid), "/F"], { windowsHide: true }, () => resolve());
              } else {
                resolve();
              }
            },
          );
        }),
    ),
  );

  await writeFile(PIDS_FILE, "[]", "utf8").catch(() => {});
}

/** Shuts everything down when the plugin is unloaded. */
export function killAll(): void {
  for (const s of states.values()) {
    try { s.recorder?.cancel(); } catch { /* noop */ }
  }
}
