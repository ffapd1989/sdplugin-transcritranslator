// Estado vivo das teclas, FORA da instancia da ação.
//
// POR QUE FORA: o SDK dispara willDisappear quando você navega para outra página,
// perfil ou pasta — a tecla some e sai da lista de acoes visiveis. Se o estado da
// gravação morasse na instancia, trocar de página no meio de um ditado mataria a
// gravação. Aqui ele vive num registro global indexado pelo id da ação (que não
// muda), entao a gravação continua em background e a tecla reassume o estado ao
// vivo quando você volta.
//
// TRAVA GLOBAL: só uma gravação por vez na máquina inteira. Você tem uma boca —
// duas gravações simultaneas do mesmo microfone gerariam dois textos disputando o
// clipboard e o Ctrl+V no final.

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
  /** Historico de níveis para a waveform (0..1, mais recente por último). */
  levels: number[];
  startedAt: number;
  /** Texto transitorio mostrado na tecla (ex.: "copiado"). */
  message?: string[];
  /** Aborta a chamada de API em andamento. */
  abort?: AbortController;
  /** Momento do keyDown, para distinguir toque curto de segurar. */
  downAt?: number;
  /** Timer que troca a tecla para "SOLTE P/ CANCELAR" enquanto você segura. */
  holdTimer?: NodeJS.Timeout;
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

/** true se conseguiu a trava. */
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

// --- rastreio de PIDs, para não deixar ffmpeg órfão ---

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
    /* rastreio é best-effort */
  }
}

/**
 * Mata ffmpeg deixado para tras por um encerramento abrupto do app Stream Deck.
 *
 * Confere que o PID ainda é um ffmpeg antes de matar: PIDs são reciclados pelo
 * Windows, e matar as cegas poderia derrubar um processo alheio.
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

/** Encerra tudo ao descarregar o plugin. */
export function killAll(): void {
  for (const s of states.values()) {
    try { s.recorder?.cancel(); } catch { /* noop */ }
  }
}
