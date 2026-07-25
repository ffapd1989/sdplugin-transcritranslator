// Entrega do texto: clipboard, colagem e histórico.
//
// A REGRA DO FOCO: o PID da janela em foco é lido no INICIO da gravação e conferido
// no FIM. Se mudou, o plugin NÃO cola — só copia e avisa. E' a diferença entre o
// texto aparecer onde você pediu e o texto aparecer no meio de outra coisa que você
// foi fazer enquanto a API respondia.
//
// Tudo que envolve texto passa por ARQUIVO UTF-8, nunca pela linha de comando nem
// pelo stdout do PowerShell — é o que garante que "ação", "três" e "coração"
// cheguem inteiros. Acentuacao errada aqui inutilizaria o plugin em português.

import { execFile } from "node:child_process";
import { readFile, writeFile, appendFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { HISTORY_DIR } from "./paths.js";

function psQuote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function powershell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true, maxBuffer: 1 << 20 },
      (err, stdout, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve(stdout.trim())),
    );
  });
}

async function tempFile(prefix: string): Promise<string> {
  return join(tmpdir(), `tt-${prefix}-${process.pid}-${Date.now()}.txt`);
}

/**
 * PID do processo dono da janela em foco.
 *
 * Usa UIAutomation (assembly já compilado, ~75 ms) em vez de P/Invoke com
 * `Add-Type -TypeDefinition`, que compilaria C# a cada chamada e custaria ~1 s.
 */
export async function getFocusPid(): Promise<number> {
  try {
    const out = await powershell(
      "Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes;" +
        "[System.Windows.Automation.AutomationElement]::FocusedElement.Current.ProcessId",
    );
    const pid = parseInt(out, 10);
    return Number.isFinite(pid) ? pid : 0;
  } catch {
    return 0;
  }
}

export type DeliveryResult = "pasted" | "copied";

/**
 * Copia e — se o foco continuar onde estava — cola.
 *
 * expectPid = 0 significa que não conseguimos ler o foco no início; nesse caso cola
 * assim mesmo, porque o caso comum é o foco não ter mudado e travar a colagem por
 * falta de informacao quebraria o fluxo principal.
 */
export async function deliver(
  text: string,
  opts: { autoPaste: boolean; expectPid: number },
): Promise<DeliveryResult> {
  const file = await tempFile("out");
  await writeFile(file, text, "utf8");

  try {
    if (!opts.autoPaste) {
      await powershell(
        `$t = [IO.File]::ReadAllText(${psQuote(file)}, [Text.Encoding]::UTF8); Set-Clipboard -Value $t`,
      );
      return "copied";
    }

    const out = await powershell(
      "Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms;" +
        `$t = [IO.File]::ReadAllText(${psQuote(file)}, [Text.Encoding]::UTF8);` +
        "Set-Clipboard -Value $t;" +
        "$cur = 0;" +
        "try { $cur = [System.Windows.Automation.AutomationElement]::FocusedElement.Current.ProcessId } catch {};" +
        `$expect = ${opts.expectPid};` +
        "if ($expect -eq 0 -or $cur -eq $expect) {" +
        "  [System.Windows.Forms.SendKeys]::SendWait('^v'); 'pasted'" +
        "} else { 'copied' }",
    );
    return out.includes("pasted") ? "pasted" : "copied";
  } finally {
    await unlink(file).catch(() => {});
  }
}

/**
 * Copia a selecao atual (Ctrl+C) e devolve o texto.
 *
 * Se o clipboard não mudar, é porque não havia selecao — devolve o que já estava
 * la', que é o comportamento útil: você copiou antes e apertou a tecla depois.
 */
export async function readSelectionOrClipboard(): Promise<string> {
  const file = await tempFile("clip");
  try {
    await powershell(
      "Add-Type -AssemblyName System.Windows.Forms;" +
        "[System.Windows.Forms.SendKeys]::SendWait('^c');" +
        "Start-Sleep -Milliseconds 250;" +
        "$t = Get-Clipboard -Raw;" +
        `[IO.File]::WriteAllText(${psQuote(file)}, [string]$t, (New-Object Text.UTF8Encoding($false)))`,
    );
    return (await readFile(file, "utf8")).trim();
  } catch {
    return "";
  } finally {
    await unlink(file).catch(() => {});
  }
}

export type HistoryEntry = {
  label: string;
  durationMs: number;
  raw: string;
  final: string;
  models: string;
  note?: string;
};

/**
 * Um .md por mes. Guarda o texto CRU e o FINAL: se a etapa de texto distorcer algo,
 * o original continua recuperavel — e essa é a rede de segurança quando o Ctrl+V
 * não acontece.
 */
export async function appendHistory(entry: HistoryEntry, dir?: string): Promise<void> {
  const target = dir?.trim() || HISTORY_DIR;
  await mkdir(target, { recursive: true });

  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const file = join(target, `${now.getFullYear()}-${p(now.getMonth() + 1)}.md`);

  const secs = Math.round(entry.durationMs / 1000);
  const dur = `${Math.floor(secs / 60)}:${p(secs % 60)}`;
  const head = `## ${p(now.getHours())}:${p(now.getMinutes())} · ${entry.label || "Ditado"} · ${dur}`;

  const parts = [
    "",
    head,
    "",
    `\`${entry.models}\`${entry.note ? ` · _${entry.note}_` : ""}`,
    "",
  ];

  if (entry.raw && entry.final && entry.raw !== entry.final) {
    parts.push("**Transcrito**", "", entry.raw, "", "**Final**", "", entry.final, "");
  } else {
    parts.push(entry.final || entry.raw, "");
  }

  await appendFile(file, parts.join("\n"), "utf8");
}
