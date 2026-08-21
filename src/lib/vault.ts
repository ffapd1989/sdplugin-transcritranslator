// Vault for the OpenAI key — DPAPI, the same pattern as the VPN plugin (cred.xml).
//
// WHY NOT KEEP IT IN THE STREAM DECK SETTINGS: they become a plain-text .json inside
// %APPDATA%\Elgato — any of the user's processes can read it. DPAPI encrypts with the
// Windows ACCOUNT key: the file only opens on this account, on this machine, and is
// worthless if it leaks.
//
// The cost (starting a powershell) only happens when saving and once at plugin boot —
// never on the hot path of dictation, because we cache it in memory.

import { execFile } from "node:child_process";
import { join } from "node:path";

const DIR = join(process.env.LOCALAPPDATA ?? "", "transcritranslator");
const KEY_FILE = join(DIR, "openai-key.xml");

/** PowerShell single quotes: escaping means doubling the quote itself. */
function psQuote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function powershell(script: string, stdin?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true, maxBuffer: 1 << 20 },
      (err, stdout, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve(stdout)),
    );
    if (stdin !== undefined) {
      child.stdin?.end(stdin, "utf8");
    }
  });
}

let cached: string | null = null;

/**
 * The key in use, in order: cache -> environment variable -> DPAPI vault.
 * The env var beats the vault because it is explicit (handy for testing another key).
 */
export async function getApiKey(): Promise<string | null> {
  if (cached) return cached;

  const fromEnv = process.env.OPENAI_API_KEY?.trim();
  if (fromEnv) {
    cached = fromEnv;
    return cached;
  }

  try {
    const out = await powershell(
      `if (Test-Path ${psQuote(KEY_FILE)}) {` +
        `$s = Import-Clixml ${psQuote(KEY_FILE)};` +
        `[Runtime.InteropServices.Marshal]::PtrToStringBSTR(` +
        `[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)) }`,
    );
    const key = out.trim();
    if (key) {
      cached = key;
      return cached;
    }
  } catch {
    /* vault missing or unreadable — treated as "no key" */
  }
  return null;
}

/** Writes the key into the vault. The key travels over STDIN, never on the command line. */
export async function setApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  // NOTE: this message is echoed verbatim in the property inspector (see the "error"
  // event in dictation.html), so it is user-facing text that does NOT go through i18n.
  // English by decision — it is the one language every reader of this panel has a
  // chance at. Same for the ones in presets.ts.
  if (!trimmed) throw new Error("empty key");

  await powershell(
    `$k = [Console]::In.ReadToEnd().Trim();` +
      `$d = ${psQuote(DIR)};` +
      `if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null };` +
      `ConvertTo-SecureString -String $k -AsPlainText -Force | Export-Clixml -Path ${psQuote(KEY_FILE)}`,
    trimmed,
  );
  cached = trimmed;
}

export async function hasApiKey(): Promise<boolean> {
  return (await getApiKey()) !== null;
}

/** Wipes the vault. The OPENAI_API_KEY env var, if set, still applies. */
export async function clearApiKey(): Promise<void> {
  cached = null;
  await powershell(
    `if (Test-Path ${psQuote(KEY_FILE)}) { Remove-Item -Force ${psQuote(KEY_FILE)} }`,
  ).catch(() => {});
}

/** Shows just enough for the user to recognise the key. */
export function maskKey(key: string): string {
  if (key.length <= 11) return "•".repeat(key.length);
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}
