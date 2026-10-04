// Finding ffmpeg, and installing it for someone who does not have it.
//
// THE TRAP this module exists for: the plugin inherits its PATH from the Stream Deck app,
// frozen at the moment the app started. Installing ffmpeg — by winget, by hand, by any
// package manager — writes the new PATH to the registry, and the app does not see it
// until it is restarted. So the search reads the PATH straight from the registry as well.
// One mechanism covers every way of installing, with no list of per-manager folders.
//
// The install button runs winget with a FIXED package id: nothing the panel sends ends up
// on that command line. Success is decided by finding ffmpeg afterwards, not by winget's
// exit code — "already installed" exits non-zero and is a perfectly good outcome.

import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export type FfmpegInfo = { path: string; version: string };

/** Essentials, not the full build: a smaller download, and it still brings ffplay. */
export const WINGET_PACKAGE = "Gyan.FFmpeg.Essentials";
const INSTALL_TIMEOUT_MS = 10 * 60_000;

function run(file: string, args: string[], timeout: number): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, timeout, maxBuffer: 1 << 20 }, (err, stdout) =>
      resolve(err ? null : String(stdout)),
    );
  });
}

/** The version this executable reports, or null if it is not a working ffmpeg. */
export async function probe(path: string): Promise<string | null> {
  const out = await run(path, ["-hide_banner", "-version"], 5000);
  return /^ffmpeg version (\S+)/m.exec(out ?? "")?.[1] ?? null;
}

/** A PATH value split into folders: `%VAR%` expanded, quotes stripped, no repeats. */
export function pathDirs(raw: string, env: Record<string, string | undefined>): string[] {
  const seen = new Set<string>();
  const dirs: string[] = [];
  for (const part of raw.split(";")) {
    const dir = part
      .replace(/%([^%]+)%/g, (whole, name: string) => env[name] ?? whole)
      .replace(/"/g, "")
      .trim();
    if (!dir || seen.has(dir.toLowerCase())) continue;
    seen.add(dir.toLowerCase());
    dirs.push(dir);
  }
  return dirs;
}

async function registryPath(key: string): Promise<string> {
  const out = await run("reg", ["query", key, "/v", "Path"], 5000);
  return /REG_(?:EXPAND_)?SZ\s+(.*)$/m.exec(out ?? "")?.[1] ?? "";
}

/** The PATH as it is NOW in the registry — user first, then machine. */
async function freshPathDirs(): Promise<string[]> {
  const [user, machine] = await Promise.all([
    registryPath("HKCU\\Environment"),
    registryPath("HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment"),
  ]);
  return pathDirs(`${user};${machine}`, process.env);
}

let found: FfmpegInfo | null | undefined;

/** The last search's result: undefined = never searched, null = not found. */
export function ffmpegInfo(): FfmpegInfo | null | undefined {
  return found;
}

/**
 * Searches, in order: the path the person configured, the PATH the app inherited, the
 * PATH in the registry, and winget's links folder. The first one that answers wins.
 */
export async function findFfmpeg(configured?: string): Promise<FfmpegInfo | null> {
  const candidates = [configured?.trim() ?? "", "ffmpeg"];
  for (const dir of await freshPathDirs()) candidates.push(join(dir, "ffmpeg.exe"));
  candidates.push(join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WinGet", "Links", "ffmpeg.exe"));

  let result: FfmpegInfo | null = null;
  for (const path of candidates) {
    if (!path || (path !== "ffmpeg" && !existsSync(path))) continue;
    const version = await probe(path);
    if (version) {
      result = { path, version };
      break;
    }
  }
  found = result;
  return result;
}

let wingetCache: boolean | undefined;

export async function hasWinget(): Promise<boolean> {
  wingetCache ??= (await run("winget", ["--version"], 10_000)) !== null;
  return wingetCache;
}

let installing: Promise<FfmpegInfo | null> | undefined;

export function isInstalling(): boolean {
  return installing !== undefined;
}

/** Installs through winget and searches again. A second click joins the first install. */
export function installFfmpeg(configured?: string): Promise<FfmpegInfo | null> {
  installing ??= new Promise<void>((resolve) => {
    const child = spawn(
      "winget",
      [
        "install", "--id", WINGET_PACKAGE, "-e", "--source", "winget",
        "--accept-source-agreements", "--accept-package-agreements", "--disable-interactivity",
      ],
      { windowsHide: true, stdio: "ignore" },
    );
    const timer = setTimeout(() => child.kill(), INSTALL_TIMEOUT_MS);
    child.on("error", () => resolve());
    child.on("close", () => {
      clearTimeout(timer);
      resolve();
    });
  })
    .then(() => findFfmpeg(configured))
    .finally(() => {
      installing = undefined;
    });
  return installing;
}
