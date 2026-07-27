// Gravação pelo ffmpeg (DirectShow).
//
// UM processo, DUAS saídas simultaneas:
//   1. o MP3 que vai para a API;
//   2. um medidor de nível (~21 amostras/s) — é dele que sai a waveform ao vivo da
//      tecla E a detecção de silêncio.
//
// O MEDIDOR SAI PELO STDERR, e isso NÃO é detalhe. Medido nesta máquina:
//   ametadata ... file=-  (stdout) -> primeira amostra em 4519 ms, tudo de uma vez
//   ametadata sem `file`  (stderr) -> primeira amostra em  373 ms, fluxo contínuo
// O stdout do ffmpeg passa por avio, que bufferiza; o log vai direto. Pelo stdout a
// tecla só viraria REC depois de 4,5 s — o ditado inteiro seria perdido.
//
// O silêncio NÃO usa o filtro silencedetect: como o RMS já chega, o silêncio é
// calculado aqui — e assim dá para ARMAR o auto-stop somente depois que houve fala,
// senão ele encerraria a gravação enquanto você ainda respira fundo para começar.
//
// Parar é `q` no stdin, nunca taskkill: o `q` faz o ffmpeg fechar o arquivo direito.

import { spawn, execFile, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";

export type AudioDevice = { name: string; alternativeName?: string };

// Limiares RELATIVOS ao piso de ruído, não absolutos.
//
// Medido nesta máquina em silêncio: FIFINE = -80 dBFS, headset CORSAIR = -96 dBFS.
// Um limiar fixo como "-34 dB é fala" quebraria em qualquer microfone de ganho
// baixo: a fala chegaria abaixo dele e o plugin diria "sem fala" em TODO ditado.
// Ancorando no piso observado, a mesma regra vale para um USB de mesa e para o
// microfone de um headset.

/** Fala = piso + isto. */
const SPEECH_OVER_FLOOR = 14;
/** Silêncio = abaixo de piso + isto. A folga entre os dois evita oscilação. */
const SILENCE_OVER_FLOOR = 8;
/** Teto de segurança: em ambiente ruidoso o piso não arrasta o limiar para cima. */
const MAX_FLOOR_DB = -30;
/** Fala precisa durar isto para armar o auto-stop — evita armar com um estalo. */
const SPEECH_ARM_MS = 250;
/** Antes disto o piso ainda não é confiável; usa escala fixa para desenhar. */
const WARMUP_SAMPLES = 8;

export type RecorderEvents = {
  /** ffmpeg confirmou que está capturando — é aqui que a tecla vira REC. */
  ready: [];
  /** Nível instantâneo, já normalizado em 0..1 para desenhar a barra. */
  level: [number];
  /** Silêncio prolongado depois de ter havido fala. */
  silence: [];
  /** Limite máximo de gravação atingido. */
  maxReached: [];
  error: [Error];
  /** Processo encerrou. ok=false quando saiu com código != 0. */
  done: [{ ok: boolean; stderr: string }];
};

export class Recorder extends EventEmitter {
  private proc: ChildProcess | undefined;
  /** Sobra de linha incompleta entre chunks do stderr. */
  private logBuf = "";
  /** Log do ffmpeg sem as amostras, para diagnóstico de falha. */
  private stderrBuf = "";
  private silenceSince: number | undefined;
  private speechSince: number | undefined;
  private maxTimer: NodeJS.Timeout | undefined;
  /** Um `q` só. O segundo chegaria num cano já fechado. */
  private stopped = false;

  /** Ficou true assim que houve fala sustentada. Base da blindagem anti-eco. */
  speechDetected = false;
  /** Maior nível visto, em dBFS. -Infinity se nunca chegou nada. */
  peakDb = -Infinity;
  startedAt = 0;

  constructor(
    private readonly opts: {
      ffmpegPath: string;
      device: string;
      outFile: string;
      silenceStop: boolean;
      silenceSeconds: number;
      maxMinutes: number;
    },
  ) {
    super();
  }

  get pid(): number | undefined {
    return this.proc?.pid;
  }

  get elapsedMs(): number {
    return this.startedAt ? Date.now() - this.startedAt : 0;
  }

  start(): void {
    const a = this.opts;
    const args = [
      "-hide_banner",
      // `info` é o que faz o ametadata chegar ao vivo (ver nota no topo).
      "-loglevel", "info",
      "-f", "dshow",
      // Buffer curto: menos latência entre falar e a barrinha mexer.
      "-audio_buffer_size", "50",
      "-i", `audio=${a.device}`,
      // Saída 1 — o arquivo que será' enviado.
      "-map", "0:a",
      "-ac", "1",
      "-ar", "16000",
      "-c:a", "libmp3lame",
      "-b:a", "48k",
      "-y", a.outFile,
      // Saída 2 — medidor de nível, descartado. Sem `file=`: vai para o log.
      "-map", "0:a",
      "-af", "astats=metadata=1:reset=1,ametadata=mode=print:key=lavfi.astats.Overall.RMS_level",
      "-f", "null", "-",
    ];

    this.startedAt = Date.now();
    this.proc = spawn(a.ffmpegPath, args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });

    this.proc.stderr?.setEncoding("utf8");
    this.proc.stderr?.on("data", (chunk: string) => this.onMeter(chunk));

    this.proc.on("error", (err) => this.emit("error", err));
    this.proc.on("close", (code) => {
      clearTimeout(this.maxTimer);
      this.emit("done", { ok: code === 0, stderr: this.stderrBuf.trim() });
    });

    if (a.maxMinutes > 0) {
      this.maxTimer = setTimeout(() => this.emit("maxReached"), a.maxMinutes * 60_000);
    }
  }

  /** Encerra limpo: `q` no stdin finaliza o MP3 corretamente. */
  stop(): void {
    clearTimeout(this.maxTimer);
    const p = this.proc;
    if (!p || p.exitCode !== null || this.stopped) return;
    this.stopped = true;

    const stdin = p.stdin;
    if (stdin) {
      // O erro de "write after end" NÃO é lançado aqui: ele chega assíncrono, como
      // evento `error` do stream. Sem este listener ele vira exceção não tratada e
      // derruba o processo do plugin — foi o que aconteceu quando dois pedidos de
      // parada chegaram juntos pelo atalho de teclado.
      stdin.on("error", () => {
        /* o ffmpeg já fechou o cano; o `q` não tinha mais para onde ir */
      });
      try {
        if (stdin.writable) {
          stdin.write("q");
          stdin.end();
        }
      } catch {
        /* já morreu */
      }
    }
    // Rede de segurança: se não encerrar sozinho, mata.
    setTimeout(() => {
      if (this.proc && this.proc.exitCode === null) {
        try { this.proc.kill(); } catch { /* noop */ }
      }
    }, 3000);
  }

  /** Descarta: não há arquivo a preservar, entao pode matar direto. */
  cancel(): void {
    clearTimeout(this.maxTimer);
    try { this.proc?.kill(); } catch { /* noop */ }
  }

  /**
   * O stderr traz duas coisas misturadas: as amostras do medidor e o log normal do
   * ffmpeg. As amostras viram nível; o resto é guardado (limitado) para diagnóstico
   * quando algo dá errado.
   */
  private onMeter(chunk: string): void {
    this.logBuf += chunk;
    const lines = this.logBuf.split(/\r?\n/);
    this.logBuf = lines.pop() ?? "";

    for (const line of lines) {
      const m = /RMS_level=(-?[\d.]+|-?inf)/i.exec(line);
      if (!m) {
        // Cada amostra vem acompanhada de "[Parsed_ametadata_1 @ …] frame:21 pts:…"
        // e da linha de progresso "size=…". Nenhuma das duas ajuda a diagnosticar.
        if (line.trim() && !/frame:\s*\d+\s+pts:/.test(line) && !/^\s*size=/.test(line)) {
          this.stderrBuf += line + "\n";
          if (this.stderrBuf.length > 8000) this.stderrBuf = this.stderrBuf.slice(-8000);
        }
        continue;
      }

      if (!this.gotFirstSample) {
        this.gotFirstSample = true;
        this.emit("ready");
      }

      const db = m[1].toLowerCase().includes("inf") ? -Infinity : parseFloat(m[1]);
      if (db > this.peakDb) this.peakDb = db;

      // O piso é o menor nível já visto. Se a pessoa começa a falar de imediato,
      // os vales entre sílabas ainda o calibram — não depende de uma pausa inicial.
      this.samples++;
      if (isFinite(db) && db < this.floorDb) this.floorDb = db;

      this.emit("level", this.normalize(db));
      this.trackSilence(db);
    }
  }

  private samples = 0;
  private floorDb = Infinity;

  /** Piso efetivo, com teto para não subir demais em ambiente barulhento. */
  private get floor(): number {
    if (!isFinite(this.floorDb)) return -60;
    return Math.min(this.floorDb, MAX_FLOOR_DB);
  }

  /** dBFS -> 0..1, ancorado no piso: a barra mexe com qualquer ganho de microfone. */
  private normalize(db: number): number {
    if (!isFinite(db)) return 0;
    if (this.samples < WARMUP_SAMPLES) return Math.max(0, Math.min(1, (db + 55) / 49));
    const lo = this.floor + 3;
    const hi = this.floor + 45;
    return Math.max(0, Math.min(1, (db - lo) / (hi - lo)));
  }

  private gotFirstSample = false;

  private trackSilence(db: number): void {
    const now = Date.now();
    const speechDb = this.floor + SPEECH_OVER_FLOOR;
    const silenceDb = this.floor + SILENCE_OVER_FLOOR;

    if (db >= speechDb) {
      this.silenceSince = undefined;
      this.speechSince ??= now;
      if (!this.speechDetected && now - this.speechSince >= SPEECH_ARM_MS) {
        this.speechDetected = true;
      }
      return;
    }

    this.speechSince = undefined;
    if (db >= silenceDb) return; // zona morta entre os dois limiares

    // So' conta silêncio depois que houve fala: não encerra durante a pausa inicial.
    if (!this.opts.silenceStop || !this.speechDetected) return;

    this.silenceSince ??= now;
    if (now - this.silenceSince >= this.opts.silenceSeconds * 1000) {
      this.silenceSince = undefined;
      this.emit("silence");
    }
  }
}

export declare interface Recorder {
  on<K extends keyof RecorderEvents>(e: K, l: (...a: RecorderEvents[K]) => void): this;
  emit<K extends keyof RecorderEvents>(e: K, ...a: RecorderEvents[K]): boolean;
}

/**
 * Lista os microfones do DirectShow.
 *
 * O ffmpeg escreve isto no stderr e sai com código != 0 de propósito (a entrada
 * `dummy` não existe) — por isso o erro do execFile é ignorado.
 */
export function listAudioDevices(ffmpegPath: string): Promise<AudioDevice[]> {
  return new Promise((resolve) => {
    execFile(
      ffmpegPath,
      ["-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"],
      { windowsHide: true, encoding: "utf8", maxBuffer: 1 << 20 },
      (_err, _stdout, stderr) => {
        const devices: AudioDevice[] = [];
        let inAudioSection = false;
        let last: AudioDevice | undefined;

        for (const line of (stderr || "").split(/\r?\n/)) {
          if (/DirectShow audio devices/i.test(line)) { inAudioSection = true; continue; }
          if (/DirectShow video devices/i.test(line)) { inAudioSection = false; continue; }

          const alt = /Alternative name\s+"([^"]+)"/i.exec(line);
          if (alt && last) { last.alternativeName = alt[1]; continue; }

          const named = /"([^"]+)"/.exec(line);
          if (!named) continue;

          // ffmpeg novo marca o tipo na própria linha; o antigo usa secoes.
          const isAudio = /\(audio\)/i.test(line) || (inAudioSection && !/\(video\)/i.test(line));
          if (!isAudio) continue;

          last = { name: named[1] };
          devices.push(last);
        }
        resolve(devices);
      },
    );
  });
}
