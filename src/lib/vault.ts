// Cofre da chave da OpenAI — DPAPI, o mesmo padrão da VPN (cred.xml).
//
// POR QUE NÃO GUARDAR NAS SETTINGS DO STREAM DECK: elas viram um .json em texto
// plano dentro de %APPDATA%\Elgato — qualquer processo do usuário le. O DPAPI
// cifra com a chave da CONTA do Windows: o arquivo só abre nesta conta, nesta
// máquina, e não serve para nada se vazar.
//
// O custo (subir um powershell) só acontece ao salvar e uma vez no boot do
// plugin — nunca no caminho quente do ditado, porque cacheamos em memória.

import { execFile } from "node:child_process";
import { join } from "node:path";

const DIR = join(process.env.LOCALAPPDATA ?? "", "transcritranslator");
const KEY_FILE = join(DIR, "openai-key.xml");

/** Aspas simples de PowerShell: o escape é dobrar a própria aspa. */
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
 * Chave em uso, na ordem: cache -> variavel de ambiente -> cofre DPAPI.
 * A env var ganha do cofre por ser explicita (útil para testar outra chave).
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
    /* cofre ausente ou ilegivel — trata como "sem chave" */
  }
  return null;
}

/** Grava a chave no cofre. A chave vai por STDIN, nunca na linha de comando. */
export async function setApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) throw new Error("chave vazia");

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

/** Apaga o cofre. A env var OPENAI_API_KEY, se existir, continua valendo. */
export async function clearApiKey(): Promise<void> {
  cached = null;
  await powershell(
    `if (Test-Path ${psQuote(KEY_FILE)}) { Remove-Item -Force ${psQuote(KEY_FILE)} }`,
  ).catch(() => {});
}

/** Mostra só o suficiente para o usuário reconhecer a chave. */
export function maskKey(key: string): string {
  if (key.length <= 11) return "•".repeat(key.length);
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}
