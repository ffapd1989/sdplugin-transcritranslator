// A tecla de ditado: maquina de estados, desenho ao vivo e o pipeline completo.
//
// GRAMATICA DE INTERACAO (a mesma do plugin da VPN): toque curto faz o seguro,
// SEGURAR faz o destrutivo. Aqui isso vira: toque para/envia, segurar cancela — e
// o aviso "SOLTE P/ CANCELAR" aparece ANTES de a acao acontecer, nao depois.

import streamDeck, {
  action,
  SingletonAction,
  type KeyDownEvent,
  type KeyUpEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
  type DidReceiveSettingsEvent,
  type SendToPluginEvent,
  type KeyAction,
} from "@elgato/streamdeck";
import { rename, unlink, stat } from "node:fs/promises";
import { join } from "node:path";

import {
  withDefaults,
  TRANSCRIBE_MODELS,
  TEXT_MODELS,
  LANGUAGES,
  type ActionSettings,
  type GlobalSettings,
} from "../lib/settings.js";
import { Recorder } from "../lib/recorder.js";
import { getState, acquireLock, releaseLock, isBusyElsewhere, trackPid, untrackPid } from "../lib/sessions.js";
import { AUDIO_DIR, FAILED_DIR, stamp } from "../lib/paths.js";
import { applyCanon, parseTerms, buildTranscribePrompt, promptBudget } from "../lib/canon.js";
import { buildTextSystemPrompt, hasTextWork } from "../lib/prompts.js";
import { transcribe, runText, ApiError, shortError } from "../lib/openai.js";
import { deliver, readSelectionOrClipboard, appendHistory, getFocusPid } from "../lib/deliver.js";
import { keyImage, clock, wordCount } from "../lib/icons.js";
import { SWATCHES } from "../lib/theme.js";
import { beep } from "../lib/beep.js";
import { getApiKey, setApiKey, clearApiKey } from "../lib/vault.js";
import { listPresets, getPreset, savePreset, deletePreset, PRESET_FIELDS } from "../lib/presets.js";

/** Segurar por isto durante a gravacao = cancelar. */
const HOLD_MS = 1000;
/** No modo ptt, soltar antes disto e' toque acidental — descarta. */
const PTT_MIN_MS = 400;
/** Audio menor que isto nao vai para a API (blindagem anti-eco). */
const MIN_AUDIO_MS = 800;
/** 8 fps: suficiente para a waveform parecer viva sem martelar o Stream Deck. */
const TICK_MS = 125;

function ffmpegOf(g: GlobalSettings | undefined): string {
  return g?.ffmpegPath?.trim() || "ffmpeg";
}

@action({ UUID: "com.felipe.transcritranslator.dictate" })
export class Dictation extends SingletonAction<ActionSettings> {
  private ticker: NodeJS.Timeout | undefined;

  // ---------- ciclo de vida ----------

  override async onWillAppear(ev: WillAppearEvent<ActionSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    await this.render(ev.action, ev.payload.settings);
    this.ensureTicker();
  }

  override onWillDisappear(_ev: WillDisappearEvent<ActionSettings>): void {
    // De proposito NAO encerra a gravacao: ela e' uma operacao do usuario, nao uma
    // propriedade da tela. Continua em background e entrega normalmente.
    if (this.actions.next().done) {
      clearInterval(this.ticker);
      this.ticker = undefined;
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ActionSettings>): Promise<void> {
    if (ev.action.isKey()) await this.render(ev.action, ev.payload.settings);
  }

  private ensureTicker(): void {
    if (this.ticker) return;
    this.ticker = setInterval(() => void this.tick(), TICK_MS);
  }

  /** Redesenha apenas as teclas cujo estado esta' animado. */
  private async tick(): Promise<void> {
    for (const a of this.actions) {
      if (!a.isKey()) continue;
      const st = getState(a.id);
      if (st.phase === "idle" || st.phase === "done" || st.phase === "error" || st.phase === "warn") continue;
      const settings = await a.getSettings();
      await this.render(a, settings);
    }
  }

  // ---------- desenho ----------

  private async render(a: KeyAction<ActionSettings>, raw: ActionSettings): Promise<void> {
    const s = withDefaults(raw);
    const st = getState(a.id);
    const label = s.showLabel ? s.label || "Ditado" : "";

    let img: string;
    switch (st.phase) {
      case "arming":
        img = keyImage({ color: s.colorRec, special: "dots", phase: Math.floor(Date.now() / 300), lines: ["abrindo"] });
        break;

      case "recording": {
        const lines: string[] = [];
        if (st.message) { lines.push(...st.message); }
        else if (s.showTimer) lines.push(clock(Date.now() - st.startedAt));
        img = keyImage({
          color: s.colorRec,
          special: s.showWave && !st.message ? "wave" : "dots",
          levels: st.levels,
          phase: Math.floor(Date.now() / 300),
          lines,
        });
        break;
      }

      case "stopping":
      case "transcribing":
        img = keyImage({ color: s.colorRec, special: "dots", phase: Math.floor(Date.now() / 300), lines: ["enviando"] });
        break;

      case "texting":
        img = keyImage({ color: s.colorIdle, special: "dots", phase: Math.floor(Date.now() / 300), lines: ["escrevendo"] });
        break;

      case "done":
        img = keyImage({ color: s.colorDone, special: "check", lines: st.message ?? [] });
        break;

      case "warn":
        img = keyImage({ color: "#B8791F", special: "warn", lines: st.message ?? [] });
        break;

      case "error":
        img = keyImage({ color: "#C44040", special: "cross", lines: st.message ?? [] });
        break;

      default:
        img = keyImage({ color: s.colorIdle, icon: s.icon, lines: label ? [label] : [] });
    }

    await a.setImage(img);
  }

  private async flash(
    a: KeyAction<ActionSettings>,
    phase: "done" | "warn" | "error",
    lines: string[],
    ms: number,
  ): Promise<void> {
    const st = getState(a.id);
    clearTimeout(st.resetTimer);
    st.phase = phase;
    st.message = lines;
    await this.render(a, await a.getSettings());
    st.resetTimer = setTimeout(() => {
      const cur = getState(a.id);
      cur.phase = "idle";
      cur.message = undefined;
      cur.levels = [];
      void a.getSettings().then((s) => this.render(a, s));
    }, ms);
  }

  // ---------- teclas ----------

  override async onKeyDown(ev: KeyDownEvent<ActionSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    const st = getState(ev.action.id);
    st.downAt = Date.now();

    const s = withDefaults(ev.payload.settings);

    if (s.mode === "ptt" && st.phase === "idle") {
      await this.startRecording(ev.action, ev.payload.settings);
      return;
    }

    // Aviso ao vivo de que segurar vai cancelar.
    if (st.phase === "recording" || st.phase === "transcribing" || st.phase === "texting") {
      clearTimeout(st.holdTimer);
      st.holdTimer = setTimeout(() => {
        const cur = getState(ev.action.id);
        if (cur.downAt) {
          cur.message = ["SOLTE P/", "CANCELAR"];
          void ev.action.getSettings().then((x) => this.render(ev.action as KeyAction<ActionSettings>, x));
        }
      }, HOLD_MS);
    }
  }

  override async onKeyUp(ev: KeyUpEvent<ActionSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    const a = ev.action;
    const st = getState(a.id);
    const held = st.downAt ? Date.now() - st.downAt : 0;
    st.downAt = undefined;
    clearTimeout(st.holdTimer);
    st.message = undefined;

    const s = withDefaults(ev.payload.settings);

    // Processando: toque avisa, segurar aborta.
    if (st.phase === "transcribing" || st.phase === "texting") {
      if (held >= HOLD_MS) {
        st.abort?.abort();
        await this.abortRun(a, s, "cancelado");
      } else {
        await this.flash(a, "warn", ["aguarde"], 1200);
      }
      return;
    }

    if (st.phase === "arming" || st.phase === "stopping") return;

    if (st.phase === "recording") {
      if (s.mode === "ptt") {
        if (held < PTT_MIN_MS) await this.abortRun(a, s, "curto demais");
        else await this.stopAndProcess(a, ev.payload.settings);
      } else if (held >= HOLD_MS) {
        await this.abortRun(a, s, "cancelado");
      } else {
        await this.stopAndProcess(a, ev.payload.settings);
      }
      return;
    }

    // Ocioso. No ptt o keyDown ja' iniciou; aqui so' o toggle age.
    if (s.mode !== "ptt") await this.startRecording(a, ev.payload.settings);
  }

  // ---------- pipeline ----------

  private async startRecording(a: KeyAction<ActionSettings>, raw: ActionSettings): Promise<void> {
    const s = withDefaults(raw);
    const st = getState(a.id);
    const global = await streamDeck.settings.getGlobalSettings<GlobalSettings>();

    // Sem etapa de audio: a tecla so' reescreve o que estiver selecionado.
    if (!s.transcribeOn) {
      await this.runTextOnly(a, s, global);
      return;
    }

    if (isBusyElsewhere(a.id)) {
      await this.flash(a, "warn", ["gravando em", "outra tecla"], 1600);
      return;
    }
    if (!acquireLock(a.id)) return;

    if (!(await getApiKey())) {
      releaseLock(a.id);
      await this.flash(a, "error", ["sem chave"], 4000);
      return;
    }

    const ffmpeg = ffmpegOf(global);
    const audioPath = join(AUDIO_DIR, `${stamp()}.mp3`);

    st.phase = "arming";
    st.levels = [];
    st.message = undefined;
    st.audioPath = audioPath;
    st.startedAt = Date.now();
    await this.render(a, raw);

    // Em paralelo, sem bloquear a gravacao: onde o texto deve voltar.
    void getFocusPid().then((pid) => { getState(a.id).focusPid = pid; });

    const rec = new Recorder({
      ffmpegPath: ffmpeg,
      device: s.micDevice || (await this.defaultDevice(ffmpeg)),
      outFile: audioPath,
      silenceStop: s.silenceStop && s.mode !== "ptt",
      silenceSeconds: s.silenceSeconds,
      maxMinutes: s.maxMinutes,
    });
    st.recorder = rec;

    rec.on("ready", () => {
      const cur = getState(a.id);
      if (cur.phase !== "arming") return;
      cur.phase = "recording";
      cur.startedAt = Date.now();
      if (s.beep) beep(ffmpeg, "start");
      void a.getSettings().then((x) => this.render(a, x));
    });

    rec.on("level", (v) => {
      const cur = getState(a.id);
      cur.levels.push(v);
      if (cur.levels.length > 64) cur.levels.shift();
    });

    rec.on("silence", () => { void this.stopAndProcess(a, raw); });
    rec.on("maxReached", () => { void this.stopAndProcess(a, raw); });

    rec.on("error", (err) => {
      streamDeck.logger.error("ffmpeg falhou", err);
      releaseLock(a.id);
      const cur = getState(a.id);
      cur.recorder = undefined;
      void this.flash(a, "error", ["sem ffmpeg"], 4000);
    });

    rec.start();
    await trackPid(rec.pid);
  }

  private async defaultDevice(ffmpeg: string): Promise<string> {
    const { listAudioDevices } = await import("../lib/recorder.js");
    const list = await listAudioDevices(ffmpeg);
    return list[0]?.name ?? "";
  }

  private async abortRun(a: KeyAction<ActionSettings>, s: Required<ActionSettings>, why: string): Promise<void> {
    const st = getState(a.id);
    const pid = st.recorder?.pid;
    st.recorder?.cancel();
    st.recorder = undefined;
    await untrackPid(pid);
    releaseLock(a.id);

    if (st.audioPath) await unlink(st.audioPath).catch(() => {});
    st.audioPath = undefined;
    st.levels = [];

    const global = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
    if (s.beep) beep(ffmpegOf(global), "cancel");
    await this.flash(a, "warn", [why], 1600);
  }

  private async stopAndProcess(a: KeyAction<ActionSettings>, raw: ActionSettings): Promise<void> {
    const st = getState(a.id);
    if (st.phase !== "recording" && st.phase !== "arming") return;

    const s = withDefaults(raw);
    const global = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
    const ffmpeg = ffmpegOf(global);
    const rec = st.recorder;
    const durationMs = st.startedAt ? Date.now() - st.startedAt : 0;

    st.phase = "stopping";
    st.message = undefined;
    await this.render(a, raw);
    if (s.beep) beep(ffmpeg, "stop");

    // Espera o ffmpeg fechar o arquivo antes de ler: `q` termina o MP3 direito.
    await new Promise<void>((resolve) => {
      if (!rec) return resolve();
      rec.on("done", () => resolve());
      rec.stop();
      setTimeout(resolve, 4000);
    });

    await untrackPid(rec?.pid);
    st.recorder = undefined;
    releaseLock(a.id);

    const audioPath = st.audioPath;
    st.audioPath = undefined;

    // Blindagem anti-eco: audio curto ou sem fala nao vai para a API. Sem isto, um
    // toque sem querer poderia voltar com o proprio dicionario como "transcricao".
    const hadSpeech = rec?.speechDetected ?? false;
    if (!audioPath || durationMs < MIN_AUDIO_MS || !hadSpeech) {
      if (audioPath) await unlink(audioPath).catch(() => {});
      st.levels = [];
      await this.flash(a, "warn", ["sem fala"], 1800);
      return;
    }

    await this.runPipeline(a, s, global, { audioPath, durationMs });
  }

  /** Tecla sem etapa de audio: pega a selecao (Ctrl+C) e reescreve. */
  private async runTextOnly(
    a: KeyAction<ActionSettings>,
    s: Required<ActionSettings>,
    global: GlobalSettings | undefined,
  ): Promise<void> {
    if (!hasTextWork(s)) {
      await this.flash(a, "warn", ["nada a", "fazer"], 2000);
      return;
    }
    if (!(await getApiKey())) {
      await this.flash(a, "error", ["sem chave"], 4000);
      return;
    }

    const st = getState(a.id);
    st.phase = "texting";
    st.focusPid = await getFocusPid();
    await this.render(a, await a.getSettings());

    const input = await readSelectionOrClipboard();
    if (!input) {
      await this.flash(a, "warn", ["sem texto"], 2000);
      return;
    }

    await this.runPipeline(a, s, global, { input });
  }

  private async runPipeline(
    a: KeyAction<ActionSettings>,
    s: Required<ActionSettings>,
    global: GlobalSettings | undefined,
    src: { audioPath?: string; durationMs?: number; input?: string },
  ): Promise<void> {
    const st = getState(a.id);
    const apiKey = (await getApiKey())!;
    const terms = parseTerms(global?.canonTerms);
    const ffmpeg = ffmpegOf(global);
    const models: string[] = [];
    let note: string | undefined;
    let raw = src.input ?? "";

    try {
      // --- etapa 1: transcricao ---
      if (src.audioPath) {
        st.phase = "transcribing";
        await this.render(a, await a.getSettings());

        const { prompt } = buildTranscribePrompt({
          terms,
          context: s.transcribeContext,
          useCanon: s.useCanonPrompt,
        });

        const result = await transcribe({
          apiKey,
          audioPath: src.audioPath,
          model: s.transcribeModel,
          language: s.language,
          prompt,
        });
        models.push(s.transcribeModel);

        if (result.echoed || !result.text) {
          await unlink(src.audioPath).catch(() => {});
          st.levels = [];
          await this.flash(a, "warn", ["sem fala"], 1800);
          return;
        }
        raw = applyCanon(result.text, terms);
      }

      // --- etapa 2: texto ---
      let final = raw;
      if (s.textOn && hasTextWork(s)) {
        st.phase = "texting";
        await this.render(a, await a.getSettings());
        try {
          const out = await runText({
            apiKey,
            model: s.textModel,
            systemPrompt: buildTextSystemPrompt({ cleanup: s.cleanup, style: s.style, canonTerms: terms }),
            userText: raw,
          });
          final = applyCanon(out, terms);
          models.push(s.textModel);
        } catch (err) {
          // Recusa do modelo NAO pode custar a fala: entrega o texto cru.
          if (err instanceof ApiError && err.kind === "filter" && raw) {
            note = "bloqueado — texto cru";
            final = raw;
          } else {
            throw err;
          }
        }
      }

      // --- entrega ---
      const how = await deliver(final, { autoPaste: s.autoPaste, expectPid: st.focusPid });

      if (s.history) {
        await appendHistory(
          {
            label: s.label || "Ditado",
            durationMs: src.durationMs ?? 0,
            raw,
            final,
            models: models.join(" → ") || "—",
            note,
          },
          s.historyDir,
        ).catch((e) => streamDeck.logger.warn("historico falhou", e));
      }

      if (src.audioPath && !s.keepAudio) await unlink(src.audioPath).catch(() => {});

      st.levels = [];
      if (note) {
        await this.flash(a, "warn", ["cru —", "bloqueado"], 4000);
      } else if (how === "copied" && s.autoPaste) {
        // O foco mudou: nao colamos. O texto esta' no clipboard esperando.
        await this.flash(a, "warn", ["copiado", "Ctrl+V"], 3500);
      } else {
        await this.flash(a, "done", [`${wordCount(final)} pal.`], 2000);
      }
    } catch (err) {
      streamDeck.logger.error("pipeline falhou", err);

      // Audio que falhou e' preservado mesmo com "guardar audio" desligado —
      // perder minutos de fala por causa de um 429 seria inaceitavel.
      if (src.audioPath) {
        const dest = join(FAILED_DIR, `${stamp()}.mp3`);
        await rename(src.audioPath, dest).catch(() => {});
        streamDeck.logger.warn(`audio preservado em ${dest}`);
      }

      st.levels = [];
      if (s.beep) beep(ffmpeg, "error");
      await this.flash(a, "error", [shortError(err)], 4000);
    }
  }

  // ---------- ponte com o painel ----------

  override async onSendToPlugin(ev: SendToPluginEvent<PiMessage, ActionSettings>): Promise<void> {
    const msg = ev.payload;
    const a = ev.action;
    const global = (await streamDeck.settings.getGlobalSettings<GlobalSettings>()) ?? {};
    const ffmpeg = ffmpegOf(global);
    // No SDK v2 quem fala com o painel e' streamDeck.ui, nao o objeto da acao.
    // A mensagem so' sai se houver um PI visivel — o proprio SDK garante isso.
    const reply = (data: object) => {
      void streamDeck.ui.sendToPropertyInspector(data as never);
    };

    try {
      switch (msg?.cmd) {
        case "init": {
          const { listAudioDevices } = await import("../lib/recorder.js");
          reply({
            event: "init",
            devices: (await listAudioDevices(ffmpeg)).map((d) => d.name),
            presets: (await listPresets()).map((p) => ({ id: p.id, name: p.name, builtin: !!p.builtin })),
            hasKey: !!(await getApiKey()),
            canonTerms: global.canonTerms ?? "",
            ffmpegPath: global.ffmpegPath ?? "",
            swatches: SWATCHES,
            transcribeModels: TRANSCRIBE_MODELS,
            textModels: TEXT_MODELS,
            languages: LANGUAGES,
          });
          break;
        }

        case "setKey":
          await setApiKey(msg.key);
          await streamDeck.settings.setGlobalSettings({ ...global, hasKey: true });
          reply({ event: "keySaved", hasKey: true });
          break;

        case "clearKey":
          await clearApiKey();
          await streamDeck.settings.setGlobalSettings({ ...global, hasKey: false });
          reply({ event: "keySaved", hasKey: false });
          break;

        case "setGlobal":
          await streamDeck.settings.setGlobalSettings({
            ...global,
            canonTerms: msg.canonTerms ?? global.canonTerms,
            ffmpegPath: msg.ffmpegPath ?? global.ffmpegPath,
          });
          reply({ event: "globalSaved" });
          break;

        case "applyPreset": {
          const preset = await getPreset(msg.id);
          if (!preset) { reply({ event: "error", message: "preset nao encontrado" }); break; }
          const current = await a.getSettings();
          const next: ActionSettings = { ...current, presetId: preset.id };
          for (const k of PRESET_FIELDS) {
            const v = preset.settings[k];
            if (v !== undefined) (next as any)[k] = v;
          }
          await a.setSettings(next);
          reply({ event: "presetApplied", settings: next });
          break;
        }

        case "savePreset": {
          const current = await a.getSettings();
          const picked: Partial<ActionSettings> = {};
          for (const k of PRESET_FIELDS) {
            const v = (current as any)[k];
            if (v !== undefined) (picked as any)[k] = v;
          }
          await savePreset(msg.name, picked);
          reply({
            event: "presets",
            presets: (await listPresets()).map((p) => ({ id: p.id, name: p.name, builtin: !!p.builtin })),
          });
          break;
        }

        case "deletePreset":
          await deletePreset(msg.id);
          reply({
            event: "presets",
            presets: (await listPresets()).map((p) => ({ id: p.id, name: p.name, builtin: !!p.builtin })),
          });
          break;

        case "testMic": {
          const device = msg.device || (await this.defaultDevice(ffmpeg));
          if (!device) { reply({ event: "micResult", ok: false, message: "nenhum microfone" }); break; }
          const r = await probeMic(ffmpeg, device, 3);
          reply({
            event: "micResult",
            ok: r.ok && isFinite(r.peakDb),
            peakDb: isFinite(r.peakDb) ? Math.round(r.peakDb) : null,
            message: !r.ok
              ? "nao consegui abrir o microfone"
              : !isFinite(r.peakDb) || r.peakDb < -50
                ? "abriu, mas nao captou som — fale durante o teste"
                : `ok — pico ${Math.round(r.peakDb)} dB`,
          });
          break;
        }

        case "budget":
          reply({
            event: "budget",
            ...promptBudget(parseTerms(global.canonTerms), msg.context ?? ""),
          });
          break;
      }
    } catch (err) {
      streamDeck.logger.error("painel: comando falhou", err);
      reply({ event: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }
}

type PiMessage =
  | { cmd: "init" }
  | { cmd: "setKey"; key: string }
  | { cmd: "clearKey" }
  | { cmd: "setGlobal"; canonTerms?: string; ffmpegPath?: string }
  | { cmd: "applyPreset"; id: string }
  | { cmd: "savePreset"; name: string }
  | { cmd: "deletePreset"; id: string }
  | { cmd: "testMic"; device: string }
  | { cmd: "budget"; context: string };

/** Usado pelo Property Inspector para o botao "Testar" do microfone. */
export async function probeMic(ffmpeg: string, device: string, seconds: number): Promise<{ peakDb: number; ok: boolean }> {
  const out = join(AUDIO_DIR, `probe-${Date.now()}.mp3`);
  const rec = new Recorder({
    ffmpegPath: ffmpeg,
    device,
    outFile: out,
    silenceStop: false,
    silenceSeconds: 99,
    maxMinutes: 0,
  });

  return new Promise((resolve) => {
    let settled = false;
    const finish = async () => {
      if (settled) return;
      settled = true;
      const ok = await stat(out).then((s) => s.size > 0).catch(() => false);
      await unlink(out).catch(() => {});
      resolve({ peakDb: rec.peakDb, ok });
    };
    rec.on("done", () => void finish());
    rec.on("error", () => void finish());
    rec.start();
    setTimeout(() => rec.stop(), seconds * 1000);
    setTimeout(() => void finish(), seconds * 1000 + 5000);
  });
}
