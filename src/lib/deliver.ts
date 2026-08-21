// Text delivery: clipboard, pasting and history.
//
// THE FOCUS RULE: the focused window's PID is read at the START of the recording and
// checked at the END. If it changed, the plugin does NOT paste — it only copies and
// warns. That is the difference between the text landing where you asked for it and the
// text landing in the middle of something else you went off to do while the API answered.
//
// Everything involving text goes through a UTF-8 FILE, never through the command line
// nor through PowerShell's stdout — that is what guarantees "ação", "três" and "coração"
// arrive intact. Broken accents here would make the plugin useless in Portuguese.

import { execFile } from "node:child_process";
import { readFile, writeFile, appendFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { HISTORY_DIR } from "./paths.js";

function psQuote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function powershell(script: string, timeout?: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true, maxBuffer: 1 << 20, timeout },
      (err, stdout, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve(stdout.trim())),
    );
  });
}

async function tempFile(prefix: string): Promise<string> {
  return join(tmpdir(), `tt-${prefix}-${process.pid}-${Date.now()}.txt`);
}

/**
 * PID of the process owning the focused window.
 *
 * Uses UIAutomation (an already-compiled assembly, ~75 ms) instead of P/Invoke with
 * `Add-Type -TypeDefinition`, which would compile C# on every call and cost ~1 s.
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

/**
 * Does the focused window take up the whole screen?
 *
 * It serves exactly one case: the KEYBOARD shortcut must not trigger dictation while a
 * game is running full-screen. The comparison is against the screen's `Bounds`, not its
 * `WorkingArea`, and that is what separates "full-screen" from "maximised" — a maximised
 * window stops at the taskbar, a full-screen one does not.
 *
 * IT FAILS ON THE PERMISSIVE SIDE on purpose: if the reading takes too long, errors out,
 * or the game does not talk to UIAutomation, the answer is `false` and dictation happens.
 * Losing a dictation to a false positive would be worse than the annoyance this avoids —
 * and the real defence is the shortcut not existing inside the game at all (the program
 * list in PowerToys).
 */
export async function isForegroundFullscreen(): Promise<boolean> {
  try {
    const out = await powershell(
      "Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms;" +
        "$el = [System.Windows.Automation.AutomationElement]::FocusedElement;" +
        "$root = [System.Windows.Automation.AutomationElement]::RootElement;" +
        "$walk = [System.Windows.Automation.TreeWalker]::ControlViewWalker;" +
        // Walk up to the top-level window: the focused element is usually a control inside it.
        "while ($el -ne $null) { $p = $walk.GetParent($el);" +
        "  if ($p -eq $null -or [System.Windows.Automation.Automation]::Compare($p, $root)) { break }" +
        "  $el = $p }" +
        "$r = $el.Current.BoundingRectangle;" +
        "$full = $false;" +
        "foreach ($s in [System.Windows.Forms.Screen]::AllScreens) { $b = $s.Bounds;" +
        "  if ($r.Left -le ($b.Left + 2) -and $r.Top -le ($b.Top + 2) -and" +
        "      $r.Right -ge ($b.Right - 2) -and $r.Bottom -ge ($b.Bottom - 2)) { $full = $true } }" +
        "if ($full) { 'S' } else { 'N' }",
      1800,
    );
    return out.trim().endsWith("S");
  } catch {
    return false;
  }
}

export type DeliveryResult = "pasted" | "copied";

/**
 * Copies and — if the focus is still where it was — pastes.
 *
 * expectPid = 0 means we could not read the focus at the start; in that case it pastes
 * anyway, because the common case is that the focus did not change, and blocking the
 * paste for lack of information would break the main flow.
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
 * Copies the current selection (Ctrl+C) and returns the text.
 *
 * If the clipboard does not change, there was no selection — it returns whatever was
 * already there, which is the useful behaviour: you copied first and pressed the key
 * afterwards.
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
 * One .md per month. Keeps the RAW text and the FINAL one: if the text step distorts
 * something, the original is still recoverable — and that is the safety net for when the
 * Ctrl+V does not happen.
 */
export async function appendHistory(entry: HistoryEntry, dir?: string): Promise<void> {
  const target = dir?.trim() || HISTORY_DIR;
  await mkdir(target, { recursive: true });

  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const file = join(target, `${now.getFullYear()}-${p(now.getMonth() + 1)}.md`);

  const secs = Math.round(entry.durationMs / 1000);
  const dur = `${Math.floor(secs / 60)}:${p(secs % 60)}`;
  const head = `## ${p(now.getHours())}:${p(now.getMinutes())} · ${entry.label || "Dictation"} · ${dur}`;

  const parts = [
    "",
    head,
    "",
    `\`${entry.models}\`${entry.note ? ` · _${entry.note}_` : ""}`,
    "",
  ];

  if (entry.raw && entry.final && entry.raw !== entry.final) {
    parts.push("**Transcribed**", "", entry.raw, "", "**Final**", "", entry.final, "");
  } else {
    parts.push(entry.final || entry.raw, "");
  }

  await appendFile(file, parts.join("\n"), "utf8");
}
