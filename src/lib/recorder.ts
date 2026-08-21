// Recording through ffmpeg (DirectShow).
//
// ONE process, TWO simultaneous outputs:
//   1. the MP3 that goes to the API;
//   2. a level meter (~21 samples/s) — this is what feeds the key's live waveform AND
//      the silence detection.
//
// THE METER COMES OUT OF STDERR, and that is NOT a detail. Measured on this machine:
//   ametadata ... file=-  (stdout) -> first sample at 4519 ms, all at once
//   ametadata with no `file` (stderr) -> first sample at 373 ms, continuous stream
// ffmpeg's stdout goes through avio, which buffers; the log goes straight out. Over
// stdout the key would only turn REC after 4.5 s — the whole dictation would be lost.
//
// Silence does NOT use the silencedetect filter: since the RMS already arrives, silence
// is computed here — and that way the auto-stop can be ARMED only after there has been
// speech, otherwise it would end the recording while you are still taking a deep breath.
//
// Stopping is `q` on stdin, never taskkill: the `q` makes ffmpeg close the file properly.

import { spawn, execFile, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";

export type AudioDevice = { name: string; alternativeName?: string };

// Thresholds RELATIVE to the noise floor, not absolute.
//
// Measured on this machine in silence: FIFINE = -80 dBFS, CORSAIR headset = -96 dBFS.
// A fixed threshold like "-34 dB is speech" would break on any low-gain microphone:
// speech would land below it and the plugin would say "no speech" on EVERY dictation.
// By anchoring on the observed floor, the same rule holds for a desktop USB mic and for
// a headset microphone.

/** Speech = floor + this. */
const SPEECH_OVER_FLOOR = 14;
/** Silence = below floor + this. The gap between the two avoids flapping. */
const SILENCE_OVER_FLOOR = 8;
/** Safety ceiling: in a noisy room the floor must not drag the threshold upwards. */
const MAX_FLOOR_DB = -30;
/** Speech has to last this long to arm the auto-stop — a click must not arm it. */
const SPEECH_ARM_MS = 250;
/** Before this the floor is not trustworthy yet; a fixed scale is used for drawing. */
const WARMUP_SAMPLES = 8;

export type RecorderEvents = {
  /** ffmpeg confirmed it is capturing — this is where the key turns REC. */
  ready: [];
  /** Instantaneous level, already normalised to 0..1 for drawing the bar. */
  level: [number];
  /** Prolonged silence after there has been speech. */
  silence: [];
  /** Maximum recording limit reached. */
  maxReached: [];
  error: [Error];
  /** The process exited. ok=false when it exited with a code != 0. */
  done: [{ ok: boolean; stderr: string }];
};

export class Recorder extends EventEmitter {
  private proc: ChildProcess | undefined;
  /** Leftover incomplete line between stderr chunks. */
  private logBuf = "";
  /** ffmpeg's log without the samples, for diagnosing failures. */
  private stderrBuf = "";
  private silenceSince: number | undefined;
  private speechSince: number | undefined;
  private maxTimer: NodeJS.Timeout | undefined;
  /** A single `q`. The second would arrive at an already-closed pipe. */
  private stopped = false;

  /** Turns true as soon as there has been sustained speech. Basis of the anti-echo shield. */
  speechDetected = false;
  /** Highest level seen, in dBFS. -Infinity if nothing ever arrived. */
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
      // `info` is what makes ametadata arrive live (see the note at the top).
      "-loglevel", "info",
      "-f", "dshow",
      // Short buffer: less latency between speaking and the bar moving.
      "-audio_buffer_size", "50",
      "-i", `audio=${a.device}`,
      // Output 1 — the file that will be uploaded.
      "-map", "0:a",
      "-ac", "1",
      "-ar", "16000",
      "-c:a", "libmp3lame",
      "-b:a", "48k",
      "-y", a.outFile,
      // Output 2 — level meter, discarded. With no `file=`: it goes to the log.
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

  /** Clean shutdown: `q` on stdin finalises the MP3 properly. */
  stop(): void {
    clearTimeout(this.maxTimer);
    const p = this.proc;
    if (!p || p.exitCode !== null || this.stopped) return;
    this.stopped = true;

    const stdin = p.stdin;
    if (stdin) {
      // The "write after end" error is NOT thrown here: it arrives asynchronously, as
      // an `error` event on the stream. Without this listener it becomes an unhandled
      // exception and brings the plugin process down — which is what happened when two
      // stop requests arrived together over the keyboard shortcut.
      stdin.on("error", () => {
        /* ffmpeg already closed the pipe; the `q` had nowhere left to go */
      });
      try {
        if (stdin.writable) {
          stdin.write("q");
          stdin.end();
        }
      } catch {
        /* already dead */
      }
    }
    // Safety net: if it does not shut down on its own, kill it.
    setTimeout(() => {
      if (this.proc && this.proc.exitCode === null) {
        try { this.proc.kill(); } catch { /* noop */ }
      }
    }, 3000);
  }

  /** Discards: there is no file to preserve, so it can be killed outright. */
  cancel(): void {
    clearTimeout(this.maxTimer);
    try { this.proc?.kill(); } catch { /* noop */ }
  }

  /**
   * stderr carries two things mixed together: the meter's samples and ffmpeg's normal
   * log. The samples become levels; the rest is kept (capped) for diagnostics when
   * something goes wrong.
   */
  private onMeter(chunk: string): void {
    this.logBuf += chunk;
    const lines = this.logBuf.split(/\r?\n/);
    this.logBuf = lines.pop() ?? "";

    for (const line of lines) {
      const m = /RMS_level=(-?[\d.]+|-?inf)/i.exec(line);
      if (!m) {
        // Every sample comes with "[Parsed_ametadata_1 @ …] frame:21 pts:…" and with
        // the progress line "size=…". Neither of them helps with diagnostics.
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

      // The floor is the lowest level seen so far. If the person starts speaking right
      // away, the valleys between syllables still calibrate it — no initial pause needed.
      this.samples++;
      if (isFinite(db) && db < this.floorDb) this.floorDb = db;

      this.emit("level", this.normalize(db));
      this.trackSilence(db);
    }
  }

  private samples = 0;
  private floorDb = Infinity;

  /** Effective floor, capped so it does not climb too high in a noisy room. */
  private get floor(): number {
    if (!isFinite(this.floorDb)) return -60;
    return Math.min(this.floorDb, MAX_FLOOR_DB);
  }

  /** dBFS -> 0..1, anchored on the floor: the bar moves with any microphone gain. */
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
    if (db >= silenceDb) return; // dead zone between the two thresholds

    // Silence only counts after there has been speech: it must not end during the initial pause.
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
 * Lists the DirectShow microphones.
 *
 * ffmpeg writes this to stderr and exits with a code != 0 on purpose (the `dummy` input
 * does not exist) — which is why execFile's error is ignored.
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

          // Newer ffmpeg marks the type on the line itself; older ones use sections.
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
