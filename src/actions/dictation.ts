// A tecla de ditado: máquina de estados, desenho ao vivo e o pipeline completo.
//
// GRAMÁTICA DE INTERAÇÃO (a mesma do plugin da VPN): toque curto faz o seguro,
// SEGURAR faz o destrutivo. Aqui isso vira: toque para/envia, segurar cancela — e
// o aviso "SOLTE P/ CANCELAR" aparece ANTES de a ação acontecer, não depois.

import streamDeck, {
  action,
  SingletonAction,
  type KeyDownEvent,
  type KeyUpEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
  type DidReceiveSettingsEvent,
  type DidReceiveDeepLinkEvent,
  type SendToPluginEvent,
  type KeyAction,
} from "@elgato/streamdeck";
import { rename, unlink, stat } from "node:fs/promises";
import { join } from "node:path";

import {
  withDefaults,
  resolveContentLocale,
  resolveUiLocale,
  TRANSCRIBE_MODELS,
  TEXT_MODELS,
  type ActionSettings,
  type GlobalSettings,
  type LangPref,
} from "../lib/settings.js";
import { Recorder } from "../lib/recorder.js";
import {
  getState,
  acquireLock,
  releaseLock,
  isBusyElsewhere,
  trackPid,
  untrackPid,
  type Phase,
} from "../lib/sessions.js";
import { AUDIO_DIR, FAILED_DIR, stamp } from "../lib/paths.js";
import { applyCanon, parseTerms, buildTranscribePrompt, promptBudget } from "../lib/canon.js";
import {
  buildTextSystemPrompt,
  hasTextWork,
  textPromptParts,
  type TextPromptOptions,
} from "../lib/prompts.js";
import { transcribe, runText, ApiError, shortError } from "../lib/openai.js";
import {
  deliver,
  readSelectionOrClipboard,
  appendHistory,
  getFocusPid,
  isForegroundFullscreen,
} from "../lib/deliver.js";
import { lookup, normalizeAlias, ownerOf, rememberKey, shortcutUrl } from "../lib/shortcuts.js";
import { keyImage, clock, wordCount, wrapLabel, iconThumb, ICON_NAMES, KEY_STYLES } from "../lib/icons.js";
import { keyText, wordCountLines } from "../lib/key-text.js";
import { SWATCHES } from "../lib/theme.js";
import { beep } from "../lib/beep.js";
import { getApiKey, setApiKey, clearApiKey } from "../lib/vault.js";
import { listPresets, getPreset, savePreset, deletePreset, PRESET_FIELDS } from "../lib/presets.js";
import type { Locale } from "../lib/prompt-text.js";
import { spokenLanguages, targetLanguages, languageBadge } from "../lib/languages.js";

/** Segurar por isto durante a gravação = cancelar. */
const HOLD_MS = 1000;
/** No modo ptt, soltar antes disto é toque acidental — descarta. */
const PTT_MIN_MS = 400;
/** Áudio menor que isto não vai para a API (blindagem anti-eco). */
const MIN_AUDIO_MS = 800;
/** 8 fps: suficiente para a waveform parecer viva sem martelar o Stream Deck. */
const TICK_MS = 125;
/** Confirmação final: número grande em cima, palavra pequena embaixo. */
const DONE_SIZES = [22, 10];

// Injetados pelo build a partir de version.json (fonte única da versão).
declare const __TT_VERSION__: string;
declare const __TT_DATE__: string;

function ffmpegOf(g: GlobalSettings | undefined): string {
  return g?.ffmpegPath?.trim() || "ffmpeg";
}

/**
 * Presets para o painel: nome, chave da descrição curta e as PRÓPRIAS configurações.
 *
 * As configurações vão junto para o painel poder montar o detalhe do preset a partir
 * do que ele realmente faz — em vez de uma descrição escrita à mão que envelheceria
 * assim que alguém mexesse no preset.
 */
async function presetSummaries(locale: Locale) {
  return (await listPresets(locale)).map((p) => ({
    id: p.id,
    name: p.name,
    builtin: !!p.builtin,
    descKey: p.descKey ?? null,
    settings: p.settings,
  }));
}

/** Idioma do app Stream Deck, quando ele informa. */
function appLanguage(): string | undefined {
  return (streamDeck.info as { application?: { language?: string } })?.application?.language;
}

/**
 * Idioma do PAINEL, em cache.
 *
 * A tecla é redesenhada a 8 fps enquanto grava; um round-trip de `getGlobalSettings`
 * por quadro seria absurdo. Como o idioma só muda quando a pessoa troca o seletor, o
 * cache é atualizado no `willAppear` e depois de cada `setGlobal`.
 */
let uiLocaleCache: Locale = "pt";

async function refreshUiLocale(g?: GlobalSettings): Promise<Locale> {
  const global = g ?? (await streamDeck.settings.getGlobalSettings<GlobalSettings>());
  uiLocaleCache = resolveUiLocale(global?.uiLang, appLanguage());
  return uiLocaleCache;
}

/** Idioma em que os presets e os prompts desta tecla são escritos. */
function contentLocale(g: GlobalSettings | undefined, spoken?: string): Locale {
  return resolveContentLocale({
    contentLang: g?.contentLang,
    spokenLanguage: spoken,
    uiLang: g?.uiLang,
    appLanguage: appLanguage(),
  });
}

/**
 * A tecla OCIOSA, desenhada.
 *
 * Vive fora da classe porque o painel pede exatamente esta imagem para a prévia ao
 * vivo. Uma função só, um desenho só: se a prévia e a tecla física divergissem, a
 * prévia deixaria de servir para o que existe.
 */
function idleImage(s: Required<ActionSettings>, locale: Locale): string {
  return keyImage({
    color: s.colorIdle,
    style: s.keyStyle,
    icon: s.icon,
    // O rótulo pode ter quebras digitadas pela pessoa; se não tiver e não couber,
    // quebra sozinho por palavra em vez de espremer tudo numa linha.
    lines: s.showLabel ? wrapLabel(s.label || keyText(locale).defaultLabel, s.labelSize) : [],
    fontSize: s.labelSize,
    lineGap: s.labelGap,
    // A tecla que traduz diz para onde, sem precisar abrir o painel.
    badge: s.textOn && s.styleMode === "translate" ? languageBadge(s.targetLanguage) : undefined,
  });
}

/**
 * Onde um ditado se desenha e de onde ele lê as configurações.
 *
 * Existe porque o ditado disparado por ATALHO DE TECLADO pode não ter tecla nenhuma na
 * tela: `SingletonAction.actions` só entrega as ações VISÍVEIS, e o ponto do atalho é
 * justamente acionar a tecla da tela 5 estando na tela 1. Uma `KeyAction` de verdade
 * satisfaz este tipo; a superfície emprestada (abaixo) também, lendo de uma cópia das
 * configurações e desenhando em qualquer tecla do plugin que esteja à vista.
 */
type Surface = {
  readonly id: string;
  getSettings(): Promise<ActionSettings>;
  setImage(image: string): Promise<void>;
  /** Tecla preferida para o desenho, quando ela estiver visível. */
  readonly preferId?: string;
  /** Chamado quando o ditado volta ao ocioso — devolve a tecla emprestada. */
  onIdle?(): Promise<void>;
};

/**
 * Ditado em curso que não tem tecla própria na tela, e por isso pega emprestada a de
 * outra. Só pode haver um: a trava global do `sessions.ts` já garante uma gravação por
 * vez na máquina, então nunca há duas coisas disputando o visor.
 */
let borrowed: Surface | null = null;

/**
 * Repique do atalho de teclado.
 *
 * MEDIDO: uma única tecla SEGURADA entrega ao plugin uma rajada de recados — o
 * PowerToys dispara a ação a cada repetição automática do teclado, ~30 ms uma da
 * outra. Sem isto, segurar Alt+L por meio segundo abria oito gravações do mesmo
 * microfone, e sete ficavam órfãs. A janela é atualizada a cada recado, então segurar
 * a tecla continua valendo por UMA ação, não importa quanto tempo você segure.
 */
const LINK_DEBOUNCE_MS = 600;
const lastLink = new Map<string, number>();

/**
 * Trava de reentrância do atalho.
 *
 * O debounce sozinho não bastaria: o corpo do tratador tem `await` antes de a fase
 * virar "arming" (cofre, settings, tela cheia), e nesse intervalo um segundo recado
 * ainda encontraria a tecla "ociosa" e começaria outra gravação.
 */
let linkRunning = false;

/** Fases que mudam de quadro a quadro e por isso precisam do ticker. */
function isAnimated(phase: Phase): boolean {
  return phase !== "idle" && phase !== "done" && phase !== "warn" && phase !== "error";
}

/** Traduz as settings da tecla para o formato que a montagem de prompt espera. */
function textOptions(
  s: Required<ActionSettings>,
  canonTerms: string[],
  locale: Locale,
): TextPromptOptions {
  return {
    locale,
    cleanup: s.cleanup,
    styleMode: s.styleMode,
    targetLanguage: s.targetLanguage,
    style: s.style,
    canonTerms,
  };
}

@action({ UUID: "com.felipe.transcritranslator.dictate" })
export class Dictation extends SingletonAction<ActionSettings> {
  private ticker: NodeJS.Timeout | undefined;

  constructor() {
    super();
    // O recado do atalho de teclado chega por aqui. Registrado no construtor porque a
    // instância é única e nasce no boot, antes de `connect()`.
    streamDeck.system.onDidReceiveDeepLink((ev) => void this.onDeepLink(ev));
  }

  // ---------- ciclo de vida ----------

  override async onWillAppear(ev: WillAppearEvent<ActionSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    await refreshUiLocale();
    rememberKey(ev.action.id, ev.payload.settings);
    await this.render(ev.action, ev.payload.settings);
    this.ensureTicker();
  }

  override onWillDisappear(_ev: WillDisappearEvent<ActionSettings>): void {
    // De propósito NÃO encerra a gravação: ela é uma operação do usuário, não uma
    // propriedade da tela. Continua em background e entrega normalmente.
    if (this.actions.next().done) {
      clearInterval(this.ticker);
      this.ticker = undefined;
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ActionSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    // É aqui que a cópia guardada no caderninho fica fresca: toda gravação do painel
    // passa por este evento.
    rememberKey(ev.action.id, ev.payload.settings);
    await this.render(ev.action, ev.payload.settings);
  }

  private ensureTicker(): void {
    if (this.ticker) return;
    this.ticker = setInterval(() => void this.tick(), TICK_MS);
  }

  /** Redesenha apenas as teclas cujo estado está animado. */
  private async tick(): Promise<void> {
    // O ditado emprestado não está em `this.actions` — sem isto, a waveform dele
    // ficaria parada no primeiro quadro.
    if (borrowed && isAnimated(getState(borrowed.id).phase)) {
      await this.render(borrowed, await borrowed.getSettings());
    }
    for (const a of this.actions) {
      if (!a.isKey()) continue;
      const st = getState(a.id);
      if (!isAnimated(st.phase)) continue;
      const settings = await a.getSettings();
      await this.render(a, settings);
    }
  }

  // ---------- visor emprestado ----------

  /**
   * A tecla que está exibindo o ditado disparado pelo teclado.
   *
   * Preferência para a tecla DONA do ditado, se ela estiver visível — nesse caso o
   * empréstimo é invisível, tudo aparece onde deveria. Se não estiver, serve qualquer
   * tecla do plugin que esteja ociosa. Se não houver nenhuma, o ditado roda sem visor:
   * os bipes continuam, e o texto chega do mesmo jeito.
   */
  private lender(): KeyAction<ActionSettings> | undefined {
    if (!borrowed) return undefined;
    let fallback: KeyAction<ActionSettings> | undefined;
    for (const a of this.actions) {
      if (!a.isKey()) continue;
      if (a.id === borrowed.preferId) return a;
      if (!fallback && getState(a.id).phase === "idle") fallback = a;
    }
    return fallback;
  }

  /** Superfície de um ditado sem tecla própria na tela. */
  private borrowSurface(alias: string, settings: ActionSettings, preferId: string): Surface {
    // O modo "segurar para falar" não existe no teclado: o recado do Windows é um
    // pulso, não há "soltou". Decisão de produto: converte para alternado em vez de
    // recusar o ditado.
    const snapshot: ActionSettings = { ...settings, mode: "toggle" };
    return {
      id: `sc:${alias}`,
      preferId,
      getSettings: async () => snapshot,
      setImage: async (image) => {
        await this.lender()?.setImage(image);
      },
      onIdle: async () => {
        const back = this.lender();
        borrowed = null;
        if (back) await this.render(back, await back.getSettings());
      },
    };
  }

  /** A superfície emprestada, quando é ESTA tecla que está exibindo o ditado. */
  private borrowedHere(actionId: string): Surface | null {
    if (!borrowed) return null;
    return this.lender()?.id === actionId ? borrowed : null;
  }

  // ---------- atalho de teclado ----------

  /**
   * Recado de fora: `streamdeck://plugins/message/<uuid>/dictate?key=<apelido>`.
   *
   * Alterna sempre — o mesmo atalho começa e termina —, porque um endereço é um pulso
   * e não existe "soltou a tecla" para o modo de segurar.
   */
  private async onDeepLink(ev: DidReceiveDeepLinkEvent): Promise<void> {
    // As duas travas são SÍNCRONAS de propósito: qualquer `await` antes delas abriria
    // a janela em que a rajada de repetição do teclado se transforma em N gravações.
    if (linkRunning) return;
    const path0 = ev.url.path.replace(/^\/+|\/+$/g, "");
    const alias0 = normalizeAlias(ev.url.queryParameters.get("key") ?? path0.split("/")[1] ?? "");
    const now = Date.now();
    const prev = lastLink.get(alias0) ?? 0;
    lastLink.set(alias0, now);
    if (now - prev < LINK_DEBOUNCE_MS) return;

    linkRunning = true;
    try {
      await this.runDeepLink(ev);
    } finally {
      linkRunning = false;
    }
  }

  private async runDeepLink(ev: DidReceiveDeepLinkEvent): Promise<void> {
    const global = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
    const ffmpeg = ffmpegOf(global);
    const fail = (why: string): void => {
      streamDeck.logger.warn(`atalho: ${why}`);
      beep(ffmpeg, "error");
    };

    const path = ev.url.path.replace(/^\/+|\/+$/g, "");
    const [verb, tail] = path.split("/");
    if (verb && verb !== "dictate") return fail(`comando desconhecido "${verb}"`);

    const alias = normalizeAlias(ev.url.queryParameters.get("key") ?? tail ?? "");
    if (!alias) return fail("endereço sem apelido");

    const entry = lookup(alias);
    if (!entry) return fail(`apelido "${alias}" não corresponde a nenhuma tecla conhecida`);

    const surface =
      borrowed?.id === `sc:${alias}`
        ? borrowed
        : this.borrowSurface(alias, entry.settings, entry.actionId);
    const st = getState(surface.id);

    if (st.phase === "recording" || st.phase === "arming") {
      await this.stopAndProcess(surface, await surface.getSettings());
      return;
    }
    // Já está transcrevendo ou escrevendo: o atalho não cancela (cancelar é segurar
    // uma tecla, gesto que o teclado não tem). Só avisa que chegou tarde.
    if (isAnimated(st.phase)) {
      beep(ffmpeg, "cancel");
      return;
    }

    // Jogo em tela cheia: não grava. Calado de propósito — um bipe por cima do jogo
    // seria exatamente o incômodo que esta trava existe para evitar.
    if (await isForegroundFullscreen()) {
      streamDeck.logger.info(`atalho "${alias}" ignorado: janela em tela cheia`);
      return;
    }

    if (isBusyElsewhere(surface.id)) {
      beep(ffmpeg, "cancel");
      return;
    }

    borrowed = surface;
    await this.startRecording(surface, await surface.getSettings());
  }

  // ---------- desenho ----------

  private async render(a: Surface, raw: ActionSettings): Promise<void> {
    // Tecla emprestando a tela não pode redesenhar o próprio estado por cima do
    // ditado alheio que está exibindo.
    if (borrowed && a.id !== borrowed.id && this.lender()?.id === a.id) return;

    const s = withDefaults(raw);
    const st = getState(a.id);
    const T = keyText(uiLocaleCache);

    // A direção visual escolhida vale para TODOS os estados: uma tecla neon que
    // virasse aurora ao gravar não seria a mesma tecla.
    const style = s.keyStyle;

    let img: string;
    switch (st.phase) {
      case "arming":
        img = keyImage({ color: s.colorRec, style, special: "dots", phase: Math.floor(Date.now() / 300), lines: [T.opening] });
        break;

      case "recording": {
        const lines: string[] = [];
        if (st.message) { lines.push(...st.message); }
        else if (s.showTimer) lines.push(clock(Date.now() - st.startedAt));
        img = keyImage({
          color: s.colorRec,
          style,
          special: s.showWave && !st.message ? "wave" : "dots",
          levels: st.levels,
          phase: Math.floor(Date.now() / 300),
          lines,
        });
        break;
      }

      case "stopping":
      case "transcribing":
        img = keyImage({ color: s.colorRec, style, special: "dots", phase: Math.floor(Date.now() / 300), lines: [T.sending] });
        break;

      case "texting":
        img = keyImage({ color: s.colorIdle, style, special: "dots", phase: Math.floor(Date.now() / 300), lines: [T.writing] });
        break;

      case "done":
        // A contagem vem em duas linhas — número grande, palavra pequena — porque o
        // que se lê de relance é o NÚMERO. "142 pal." numa linha só empatava os dois.
        img = keyImage({
          color: s.colorDone,
          style,
          special: "check",
          lines: st.message ?? [],
          fontSizes: DONE_SIZES,
        });
        break;

      case "warn":
        img = keyImage({ color: "#B8791F", style, special: "warn", lines: st.message ?? [] });
        break;

      case "error":
        img = keyImage({ color: "#C44040", style, special: "cross", lines: st.message ?? [] });
        break;

      default:
        img = idleImage(s, uiLocaleCache);
    }

    await a.setImage(img);
  }

  private async flash(
    a: Surface,
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
      // Todo desfecho passa por aqui — é o ponto em que a tecla emprestada volta a
      // ser ela mesma, em vez de desenhar o ocioso de um ditado que não é dela.
      if (a.onIdle) {
        void a.onIdle();
        return;
      }
      void a.getSettings().then((s) => this.render(a, s));
    }, ms);
  }

  // ---------- teclas ----------

  override async onKeyDown(ev: KeyDownEvent<ActionSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    const st = getState(ev.action.id);
    st.downAt = Date.now();

    const s = withDefaults(ev.payload.settings);

    // Emprestando a tela: esta tecla é o botão de parada do ditado que ela exibe, e
    // não a tecla dela mesma. Vem ANTES do ptt, senão o keyDown iniciaria uma segunda
    // gravação que a trava global só recusaria depois.
    const lent = this.borrowedHere(ev.action.id);
    if (lent) {
      const bst = getState(lent.id);
      clearTimeout(st.holdTimer);
      st.holdTimer = setTimeout(() => {
        if (getState(ev.action.id).downAt) {
          bst.message = [...keyText(uiLocaleCache).releaseCancel];
          void lent.getSettings().then((x) => this.render(lent, x));
        }
      }, HOLD_MS);
      return;
    }

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
          cur.message = [...keyText(uiLocaleCache).releaseCancel];
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
    const T = keyText(uiLocaleCache);

    // Emprestando a tela: age sobre o ditado exibido, com a mesma gramática de sempre
    // — toque para e entrega, segurar cancela.
    const lent = this.borrowedHere(a.id);
    if (lent) {
      const bs = withDefaults(await lent.getSettings());
      const bst = getState(lent.id);
      bst.message = undefined;
      if (bst.phase === "recording") {
        if (held >= HOLD_MS) await this.abortRun(lent, bs, T.cancelled);
        else await this.stopAndProcess(lent, await lent.getSettings());
      } else if (bst.phase === "transcribing" || bst.phase === "texting") {
        if (held >= HOLD_MS) {
          bst.abort?.abort();
          await this.abortRun(lent, bs, T.cancelled);
        } else {
          await this.flash(lent, "warn", [T.wait], 1200);
        }
      }
      return;
    }

    // Processando: toque avisa, segurar aborta.
    if (st.phase === "transcribing" || st.phase === "texting") {
      if (held >= HOLD_MS) {
        st.abort?.abort();
        await this.abortRun(a, s, T.cancelled);
      } else {
        await this.flash(a, "warn", [T.wait], 1200);
      }
      return;
    }

    if (st.phase === "arming" || st.phase === "stopping") return;

    if (st.phase === "recording") {
      if (s.mode === "ptt") {
        if (held < PTT_MIN_MS) await this.abortRun(a, s, T.tooShort);
        else await this.stopAndProcess(a, ev.payload.settings);
      } else if (held >= HOLD_MS) {
        await this.abortRun(a, s, T.cancelled);
      } else {
        await this.stopAndProcess(a, ev.payload.settings);
      }
      return;
    }

    // Ocioso. No ptt o keyDown já iniciou; aqui só o toggle age.
    if (s.mode !== "ptt") await this.startRecording(a, ev.payload.settings);
  }

  // ---------- pipeline ----------

  private async startRecording(a: Surface, raw: ActionSettings): Promise<void> {
    const s = withDefaults(raw);
    const st = getState(a.id);
    const global = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
    const T = keyText(await refreshUiLocale(global));

    // Sem etapa de áudio: a tecla só reescreve o que estiver selecionado.
    if (!s.transcribeOn) {
      await this.runTextOnly(a, s, global);
      return;
    }

    if (isBusyElsewhere(a.id)) {
      await this.flash(a, "warn", [...T.busy], 1600);
      return;
    }
    if (!acquireLock(a.id)) return;

    if (!(await getApiKey())) {
      releaseLock(a.id);
      await this.flash(a, "error", [T.noKey], 4000);
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

    // Em paralelo, sem bloquear a gravação: onde o texto deve voltar.
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
      void this.flash(a, "error", [keyText(uiLocaleCache).noFfmpeg], 4000);
    });

    rec.start();
    await trackPid(rec.pid);
  }

  private async defaultDevice(ffmpeg: string): Promise<string> {
    const { listAudioDevices } = await import("../lib/recorder.js");
    const list = await listAudioDevices(ffmpeg);
    return list[0]?.name ?? "";
  }

  private async abortRun(a: Surface, s: Required<ActionSettings>, why: string): Promise<void> {
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

  private async stopAndProcess(a: Surface, raw: ActionSettings): Promise<void> {
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

    // Blindagem anti-eco: áudio curto ou sem fala não vai para a API. Sem isto, um
    // toque sem querer poderia voltar com o próprio dicionario como "transcrição".
    const hadSpeech = rec?.speechDetected ?? false;
    if (!audioPath || durationMs < MIN_AUDIO_MS || !hadSpeech) {
      if (audioPath) await unlink(audioPath).catch(() => {});
      st.levels = [];
      await this.flash(a, "warn", [keyText(uiLocaleCache).noSpeech], 1800);
      return;
    }

    await this.runPipeline(a, s, global, { audioPath, durationMs });
  }

  /** Tecla sem etapa de áudio: pega a seleção (Ctrl+C) e reescreve. */
  private async runTextOnly(
    a: Surface,
    s: Required<ActionSettings>,
    global: GlobalSettings | undefined,
  ): Promise<void> {
    const T = keyText(uiLocaleCache);
    if (!hasTextWork(textOptions(s, [], contentLocale(global, s.language)))) {
      await this.flash(a, "warn", [...T.nothingToDo], 2000);
      return;
    }
    if (!(await getApiKey())) {
      await this.flash(a, "error", [T.noKey], 4000);
      return;
    }

    const st = getState(a.id);
    st.phase = "texting";
    st.focusPid = await getFocusPid();
    await this.render(a, await a.getSettings());

    const input = await readSelectionOrClipboard();
    if (!input) {
      await this.flash(a, "warn", [T.noText], 2000);
      return;
    }

    await this.runPipeline(a, s, global, { input });
  }

  private async runPipeline(
    a: Surface,
    s: Required<ActionSettings>,
    global: GlobalSettings | undefined,
    src: { audioPath?: string; durationMs?: number; input?: string },
  ): Promise<void> {
    const st = getState(a.id);
    const apiKey = (await getApiKey())!;
    const terms = parseTerms(global?.canonTerms);
    const ffmpeg = ffmpegOf(global);
    const T = keyText(uiLocaleCache);
    const models: string[] = [];
    let note: string | undefined;
    let raw = src.input ?? "";

    try {
      // --- etapa 1: transcrição ---
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
          await this.flash(a, "warn", [T.noSpeech], 1800);
          return;
        }
        raw = applyCanon(result.text, terms);
      }

      // --- etapa 2: texto ---
      let final = raw;
      const textOpts = textOptions(s, terms, contentLocale(global, s.language));
      if (s.textOn && hasTextWork(textOpts)) {
        st.phase = "texting";
        await this.render(a, await a.getSettings());
        try {
          const out = await runText({
            apiKey,
            model: s.textModel,
            systemPrompt: buildTextSystemPrompt(textOpts),
            userText: raw,
          });
          final = applyCanon(out, terms);
          models.push(s.textModel);
        } catch (err) {
          // Recusa do modelo NÃO pode custar a fala: entrega o texto cru.
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
        ).catch((e) => streamDeck.logger.warn("histórico falhou", e));
      }

      if (src.audioPath && !s.keepAudio) await unlink(src.audioPath).catch(() => {});

      st.levels = [];
      if (note) {
        await this.flash(a, "warn", [...T.rawBlocked], 4000);
      } else if (how === "copied" && s.autoPaste) {
        // O foco mudou: não colamos. O texto está no clipboard esperando.
        await this.flash(a, "warn", [...T.copied], 3500);
      } else {
        await this.flash(a, "done", [...wordCountLines(wordCount(final), uiLocaleCache)], 2000);
      }
    } catch (err) {
      streamDeck.logger.error("pipeline falhou", err);

      // Áudio que falhou é preservado mesmo com "guardar áudio" desligado —
      // perder minutos de fala por causa de um 429 seria inaceitavel.
      if (src.audioPath) {
        const dest = join(FAILED_DIR, `${stamp()}.mp3`);
        await rename(src.audioPath, dest).catch(() => {});
        streamDeck.logger.warn(`audio preservado em ${dest}`);
      }

      st.levels = [];
      if (s.beep) beep(ffmpeg, "error");
      await this.flash(a, "error", [shortError(err, uiLocaleCache)], 4000);
    }
  }

  // ---------- ponte com o painel ----------

  override async onSendToPlugin(ev: SendToPluginEvent<PiMessage, ActionSettings>): Promise<void> {
    const msg = ev.payload;
    const a = ev.action;
    const global = (await streamDeck.settings.getGlobalSettings<GlobalSettings>()) ?? {};
    const ffmpeg = ffmpegOf(global);
    // No SDK v2 quem fala com o painel é streamDeck.ui, não o objeto da ação.
    // A mensagem só sai se houver um PI visível — o próprio SDK garante isso.
    const reply = (data: object) => {
      void streamDeck.ui.sendToPropertyInspector(data as never);
    };

    try {
      switch (msg?.cmd) {
        case "init": {
          const { listAudioDevices } = await import("../lib/recorder.js");
          const uiLocale = await refreshUiLocale(global);
          reply({
            event: "init",
            devices: (await listAudioDevices(ffmpeg)).map((d) => d.name),
            presets: await presetSummaries(contentLocale(global)),
            hasKey: !!(await getApiKey()),
            canonTerms: global.canonTerms ?? "",
            ffmpegPath: global.ffmpegPath ?? "",
            uiLang: global.uiLang ?? "auto",
            contentLang: global.contentLang ?? "auto",
            appLanguage: appLanguage() ?? "",
            uiLocale: resolveUiLocale(global.uiLang, appLanguage()),
            version: __TT_VERSION__,
            versionDate: __TT_DATE__,
            swatches: SWATCHES,
            transcribeModels: TRANSCRIBE_MODELS,
            textModels: TEXT_MODELS,
            // As listas saem no idioma do PAINEL — quem lê é o usuário.
            languages: spokenLanguages(uiLocale, msg.autoLabel || "Detect / mixed"),
            targetLanguages: targetLanguages(uiLocale),
          });
          break;
        }

        // Mostra ao painel o texto EXATO que vai para a API. Nada de prompt oculto:
        // se o plugin manda, você pode ler.
        case "preview": {
          const s = withDefaults(await a.getSettings());
          const terms = parseTerms(global.canonTerms);
          const built = buildTranscribePrompt({
            terms,
            context: s.transcribeContext,
            useCanon: s.useCanonPrompt,
          });
          reply({
            event: "preview",
            transcribe: {
              enabled: s.transcribeOn,
              model: s.transcribeModel,
              language: s.language,
              prompt: built.prompt,
              dropped: built.droppedTerms,
            },
            text: {
              enabled: s.textOn && hasTextWork(textOptions(s, terms, contentLocale(global, s.language))),
              model: s.textModel,
              parts: textPromptParts(textOptions(s, terms, contentLocale(global, s.language))),
            },
          });
          break;
        }

        // A tecla desenhada, para o painel mostrar ao vivo o efeito de cor, ícone,
        // rótulo e corpo de fonte. As configurações vêm NA mensagem, e não de
        // `a.getSettings()`, porque o painel grava com atraso de 150 ms — lendo do
        // Stream Deck, a prévia mostraria sempre o penúltimo caractere digitado.
        case "keyPreview": {
          const s = withDefaults(msg.settings);
          reply({
            event: "keyPreview",
            image: idleImage(s, uiLocaleCache),
            // As grades custam ~20 KB e só mudam quando muda a cor ou a direção —
            // não a cada tecla digitada no rótulo. Por isso o painel pede à parte.
            icons: msg.withThumbs
              ? ICON_NAMES.map((n) => ({ name: n, image: iconThumb(n, s.keyStyle, s.colorIdle) }))
              : undefined,
            styles: msg.withThumbs
              ? KEY_STYLES.map((st) => ({ name: st, image: iconThumb(s.icon === "none" ? "mic" : s.icon, st, s.colorIdle) }))
              : undefined,
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

        case "setGlobal": {
          const next = {
            ...global,
            canonTerms: msg.canonTerms ?? global.canonTerms,
            ffmpegPath: msg.ffmpegPath ?? global.ffmpegPath,
            uiLang: msg.uiLang ?? global.uiLang,
            contentLang: msg.contentLang ?? global.contentLang,
          };
          await streamDeck.settings.setGlobalSettings(next);
          // A tecla também escreve no idioma do painel: trocar o seletor tem de
          // repintar as teclas visíveis, não só o painel.
          await refreshUiLocale(next);
          for (const other of this.actions) {
            if (other.isKey()) await this.render(other, await other.getSettings());
          }
          // Trocar o idioma de conteúdo renomeia e reescreve os presets de fábrica,
          // então o painel precisa da lista nova junto com a confirmação.
          reply({
            event: "globalSaved",
            presets: await presetSummaries(contentLocale(next)),
            uiLocale: resolveUiLocale(next.uiLang, appLanguage()),
          });
          break;
        }

        case "applyPreset": {
          const preset = await getPreset(msg.id, contentLocale(global));
          if (!preset) { reply({ event: "error", message: "preset não encontrado" }); break; }
          const current = await a.getSettings();
          const next: ActionSettings = { ...current, presetId: preset.id };
          for (const k of PRESET_FIELDS) {
            const v = preset.settings[k];
            if (v !== undefined) (next as any)[k] = v;
          }
          await a.setSettings(next);
          // Redesenha AQUI, na mão: quando é o plugin que grava as configurações, o
          // Stream Deck avisa o painel mas não devolve `didReceiveSettings` para o
          // próprio plugin. Como a tecla ociosa fica fora do ciclo de animação, ela
          // continuava com o desenho antigo — e o preset só "pegava" no clique
          // seguinte, quando outro evento acabava forçando o redesenho.
          if (a.isKey()) await this.render(a, next);
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
          await savePreset(msg.name, picked, contentLocale(global));
          reply({
            event: "presets",
            presets: await presetSummaries(contentLocale(global)),
          });
          break;
        }

        case "deletePreset":
          await deletePreset(msg.id);
          reply({
            event: "presets",
            presets: await presetSummaries(contentLocale(global)),
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
              ? "não consegui abrir o microfone"
              : !isFinite(r.peakDb) || r.peakDb < -50
                ? "abriu, mas não captou som — fale durante o teste"
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

        // O painel manda o que foi digitado e recebe de volta a forma normalizada, o
        // endereço pronto para copiar e o aviso de apelido já usado. A normalização
        // vive no plugin, e não no painel, para não haver duas regras de aplainar
        // acento — a que valeria é sempre a do plugin.
        case "shortcutCheck": {
          const alias = normalizeAlias(msg.alias);
          const owner = alias ? ownerOf(alias) : undefined;
          reply({
            event: "shortcutState",
            alias,
            url: alias ? shortcutUrl(alias) : "",
            conflictWith: owner && owner.actionId !== a.id ? owner.label : null,
          });
          break;
        }
      }
    } catch (err) {
      streamDeck.logger.error("painel: comando falhou", err);
      reply({ event: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }
}

type PiMessage =
  | { cmd: "init"; autoLabel?: string }
  | { cmd: "preview" }
  | { cmd: "keyPreview"; settings?: ActionSettings; withThumbs?: boolean }
  | { cmd: "setKey"; key: string }
  | { cmd: "clearKey" }
  | { cmd: "setGlobal"; canonTerms?: string; ffmpegPath?: string; uiLang?: LangPref; contentLang?: LangPref }
  | { cmd: "applyPreset"; id: string }
  | { cmd: "savePreset"; name: string }
  | { cmd: "deletePreset"; id: string }
  | { cmd: "testMic"; device: string }
  | { cmd: "budget"; context: string }
  | { cmd: "shortcutCheck"; alias?: string };

/** Usado pelo Property Inspector para o botão "Testar" do microfone. */
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
