// The dictation key: state machine, live drawing and the full pipeline.
//
// INTERACTION GRAMMAR (the same as the VPN plugin's): a short tap does the safe thing,
// HOLDING does the destructive one. Here that becomes: a tap stops/sends, a hold
// cancels — and the "RELEASE TO CANCEL" warning appears BEFORE the action happens, not
// after.

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
  claimStart,
  finishStart,
  type KeyState,
} from "../lib/sessions.js";
import { AUDIO_DIR, FAILED_DIR, stamp } from "../lib/paths.js";
import { applyCanon, parseTerms, buildTranscribePrompt, buildKeywords, promptBudget } from "../lib/canon.js";
import {
  buildTextSystemPrompt,
  hasTextWork,
  textPromptParts,
  type TextPromptOptions,
} from "../lib/prompts.js";
import { transcribe, runText, supportsKeywords, ApiError, shortError } from "../lib/openai.js";
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

/** Holding for this long during a recording = cancel. */
const HOLD_MS = 1000;
/** In ptt mode, releasing before this is an accidental tap — discard it. */
const PTT_MIN_MS = 400;
/** Audio shorter than this does not go to the API (anti-echo shield). */
const MIN_AUDIO_MS = 800;
/** 8 fps: enough for the waveform to look alive without hammering the Stream Deck. */
const TICK_MS = 125;
/** Final confirmation: big number on top, small word underneath. */
const DONE_SIZES = [22, 10];

// Injected by the build from version.json (the single source of the version).
declare const __TT_VERSION__: string;
declare const __TT_DATE__: string;

function ffmpegOf(g: GlobalSettings | undefined): string {
  return g?.ffmpegPath?.trim() || "ffmpeg";
}

/**
 * Presets for the panel: name, short-description key and the settings THEMSELVES.
 *
 * The settings travel along so the panel can build the preset's detail from what it
 * actually does — instead of a hand-written description that would go stale the moment
 * someone touched the preset.
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

/** The Stream Deck app's language, when it reports one. */
function appLanguage(): string | undefined {
  return (streamDeck.info as { application?: { language?: string } })?.application?.language;
}

/**
 * The PANEL's language, cached.
 *
 * The key is redrawn at 8 fps while recording; one `getGlobalSettings` round-trip per
 * frame would be absurd. Since the language only changes when the person moves the
 * selector, the cache is refreshed on `willAppear` and after every `setGlobal`.
 */
let uiLocaleCache: Locale = "pt";

async function refreshUiLocale(g?: GlobalSettings): Promise<Locale> {
  const global = g ?? (await streamDeck.settings.getGlobalSettings<GlobalSettings>());
  uiLocaleCache = resolveUiLocale(global?.uiLang, appLanguage());
  return uiLocaleCache;
}

/** The language this key's presets and prompts are written in. */
function contentLocale(g: GlobalSettings | undefined, spoken?: string): Locale {
  return resolveContentLocale({
    contentLang: g?.contentLang,
    spokenLanguage: spoken,
    uiLang: g?.uiLang,
    appLanguage: appLanguage(),
  });
}

/**
 * The IDLE key, drawn.
 *
 * It lives outside the class because the panel asks for exactly this image for the live
 * preview. One function, one drawing: if the preview and the physical key diverged, the
 * preview would stop serving the purpose it exists for.
 */
function idleImage(s: Required<ActionSettings>, locale: Locale): string {
  return keyImage({
    color: s.colorIdle,
    style: s.keyStyle,
    icon: s.icon,
    // The label may carry breaks the person typed; if it has none and does not fit, it
    // breaks by word on its own instead of squeezing everything onto one line.
    lines: s.showLabel ? wrapLabel(s.label || keyText(locale).defaultLabel, s.labelSize) : [],
    fontSize: s.labelSize,
    lineGap: s.labelGap,
    // A translating key says where to, without anyone having to open the panel.
    badge: s.textOn && s.styleMode === "translate" ? languageBadge(s.targetLanguage) : undefined,
  });
}

/**
 * Where a dictation draws itself and where it reads its settings from.
 *
 * It exists because a dictation fired by a KEYBOARD SHORTCUT may have no key on screen at
 * all: `SingletonAction.actions` only hands over the VISIBLE actions, and the whole point
 * of the shortcut is to trigger the key on page 5 while standing on page 1. A real
 * `KeyAction` satisfies this type; so does the borrowed surface (below), reading from a
 * copy of the settings and drawing on any visible key of the plugin.
 */
type Surface = {
  readonly id: string;
  getSettings(): Promise<ActionSettings>;
  setImage(image: string): Promise<void>;
  /** Preferred key for drawing, when it happens to be visible. */
  readonly preferId?: string;
  /** Called when the dictation returns to idle — gives the borrowed key back. */
  onIdle?(): Promise<void>;
};

/**
 * A dictation in flight with no key of its own on screen, which is why it borrows someone
 * else's. There can only be one: the global lock in `sessions.ts` already guarantees one
 * recording at a time on the machine, so there are never two things fighting over the
 * display.
 */
let borrowed: Surface | null = null;

/**
 * Keyboard shortcut bounce.
 *
 * MEASURED: a single HELD key delivers a burst of messages to the plugin — PowerToys
 * fires the action on every keyboard auto-repeat, ~30 ms apart. Without this, holding
 * Alt+L for half a second opened eight recordings from the same microphone, seven of
 * which were orphaned. The window is refreshed on every message, so holding the key still
 * counts as ONE action, no matter how long you hold it.
 */
const LINK_DEBOUNCE_MS = 600;
const lastLink = new Map<string, number>();

/**
 * The shortcut's reentrancy bolt.
 *
 * The debounce alone would not be enough: the handler's body has `await`s before the
 * phase turns "arming" (vault, settings, full-screen), and in that interval a second
 * message would still find the key "idle" and start another recording.
 */
let linkRunning = false;

/** Phases that change from frame to frame and therefore need the ticker. */
function isAnimated(phase: Phase): boolean {
  return phase !== "idle" && phase !== "done" && phase !== "warn" && phase !== "error";
}

/** Maps the key's settings into the shape the prompt assembly expects. */
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
    // The keyboard shortcut's message arrives here. Registered in the constructor
    // because the instance is unique and is born at boot, before `connect()`.
    streamDeck.system.onDidReceiveDeepLink((ev) => void this.onDeepLink(ev));
  }

  // ---------- lifecycle ----------

  override async onWillAppear(ev: WillAppearEvent<ActionSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    await refreshUiLocale();
    rememberKey(ev.action.id, ev.payload.settings);
    await this.render(ev.action, ev.payload.settings);
    this.ensureTicker();
  }

  override onWillDisappear(_ev: WillDisappearEvent<ActionSettings>): void {
    // On purpose it does NOT end the recording: that is an operation of the user's, not
    // a property of the screen. It carries on in the background and delivers normally.
    if (this.actions.next().done) {
      clearInterval(this.ticker);
      this.ticker = undefined;
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ActionSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    // This is where the copy kept in the notebook stays fresh: every save from the panel
    // goes through this event.
    rememberKey(ev.action.id, ev.payload.settings);
    await this.render(ev.action, ev.payload.settings);
  }

  private ensureTicker(): void {
    if (this.ticker) return;
    this.ticker = setInterval(() => void this.tick(), TICK_MS);
  }

  /** Redraws only the keys whose state is animated. */
  private async tick(): Promise<void> {
    // The borrowed dictation is not in `this.actions` — without this, its waveform would
    // sit frozen on the first frame.
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

  // ---------- borrowed display ----------

  /**
   * The key currently displaying the dictation fired from the keyboard.
   *
   * Preference goes to the dictation's OWN key, if it is visible — in that case the
   * borrowing is invisible and everything appears where it should. If it is not, any idle
   * key of the plugin will do. If there is none, the dictation runs with no display: the
   * beeps carry on, and the text arrives just the same.
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

  /** Surface for a dictation with no key of its own on screen. */
  private borrowSurface(alias: string, settings: ActionSettings, preferId: string): Surface {
    // "Hold to talk" does not exist on the keyboard: the message from Windows is a
    // pulse, there is no "released". Product decision: convert to toggle instead of
    // refusing the dictation.
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

  /** The borrowed surface, when THIS key is the one displaying the dictation. */
  private borrowedHere(actionId: string): Surface | null {
    if (!borrowed) return null;
    return this.lender()?.id === actionId ? borrowed : null;
  }

  // ---------- keyboard shortcut ----------

  /**
   * A message from outside: `streamdeck://plugins/message/<uuid>/dictate?key=<nickname>`.
   *
   * Always a toggle — the same shortcut starts and ends it — because an address is a
   * pulse and there is no "key released" for hold mode.
   */
  private async onDeepLink(ev: DidReceiveDeepLinkEvent): Promise<void> {
    // Both locks are SYNCHRONOUS on purpose: any `await` before them would open the
    // window in which the keyboard's repeat burst turns into N recordings.
    //
    // The ORDER between them is a decision, not an accident. The burst is checked first
    // and stays MUTE: a held-down shortcut fires ~30 ms apart, and answering it would be
    // 28 beeps. What is left after that filter is a deliberate press, and a deliberate
    // press that gets swallowed while the previous dictation is still being processed
    // must not look like a plugin that died — it gets the same short beep the
    // "you came late" branch in `runDeepLink` gives.
    const path0 = ev.url.path.replace(/^\/+|\/+$/g, "");
    const alias0 = normalizeAlias(ev.url.queryParameters.get("key") ?? path0.split("/")[1] ?? "");
    const now = Date.now();
    const prev = lastLink.get(alias0) ?? 0;
    lastLink.set(alias0, now);
    if (now - prev < LINK_DEBOUNCE_MS) return;

    if (linkRunning) {
      void this.beepLate();
      return;
    }

    linkRunning = true;
    try {
      await this.runDeepLink(ev);
    } finally {
      linkRunning = false;
    }
  }

  /** "Heard you, but the previous dictation is still going." Never delays the caller. */
  private async beepLate(): Promise<void> {
    const global = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
    beep(ffmpegOf(global), "cancel");
  }

  private async runDeepLink(ev: DidReceiveDeepLinkEvent): Promise<void> {
    const global = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
    const ffmpeg = ffmpegOf(global);
    const fail = (why: string): void => {
      streamDeck.logger.warn(`shortcut: ${why}`);
      beep(ffmpeg, "error");
    };

    const path = ev.url.path.replace(/^\/+|\/+$/g, "");
    const [verb, tail] = path.split("/");
    if (verb && verb !== "dictate") return fail(`unknown command "${verb}"`);

    const alias = normalizeAlias(ev.url.queryParameters.get("key") ?? tail ?? "");
    if (!alias) return fail("address with no nickname");

    const entry = lookup(alias);
    if (!entry) return fail(`nickname "${alias}" matches no known key`);

    const surface =
      borrowed?.id === `sc:${alias}`
        ? borrowed
        : this.borrowSurface(alias, entry.settings, entry.actionId);
    const st = getState(surface.id);

    if (st.phase === "recording" || st.phase === "arming") {
      await this.stopAndProcess(surface, await surface.getSettings());
      return;
    }
    // Already transcribing or writing: the shortcut does not cancel (cancelling means
    // holding a key, a gesture the keyboard does not have). It only says you came late.
    if (isAnimated(st.phase)) {
      beep(ffmpeg, "cancel");
      return;
    }

    // Full-screen game: do not record. Silent on purpose — a beep over the game would be
    // exactly the annoyance this lock exists to avoid.
    if (await isForegroundFullscreen()) {
      streamDeck.logger.info(`shortcut "${alias}" ignored: full-screen window`);
      return;
    }

    if (isBusyElsewhere(surface.id)) {
      beep(ffmpeg, "cancel");
      return;
    }

    borrowed = surface;
    await this.startRecording(surface, await surface.getSettings());
  }

  // ---------- drawing ----------

  private async render(a: Surface, raw: ActionSettings): Promise<void> {
    // A key lending its screen must not redraw its own state on top of somebody else's
    // dictation that it is displaying.
    if (borrowed && a.id !== borrowed.id && this.lender()?.id === a.id) return;

    const s = withDefaults(raw);
    const st = getState(a.id);
    const T = keyText(uiLocaleCache);

    // The chosen visual direction applies to ALL states: a neon key that turned aurora
    // while recording would not be the same key.
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
        // The count comes on two lines — big number, small word — because what you read
        // at a glance is the NUMBER. "142 wds" on one line tied the two for attention.
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
      // Every outcome passes through here — it is the point at which the borrowed key
      // becomes itself again, instead of drawing the idle state of someone else's
      // dictation.
      if (a.onIdle) {
        void a.onIdle();
        return;
      }
      void a.getSettings().then((s) => this.render(a, s));
    }, ms);
  }

  // ---------- key presses ----------

  override async onKeyDown(ev: KeyDownEvent<ActionSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    const st = getState(ev.action.id);
    st.downAt = Date.now();

    const s = withDefaults(ev.payload.settings);

    // Lending its screen: this key is the stop button for the dictation it displays, not
    // its own key. This comes BEFORE ptt, otherwise keyDown would start a second
    // recording that the global lock would only refuse afterwards.
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

    // Live warning that holding will cancel.
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

    // Lending its screen: it acts on the displayed dictation, with the usual grammar —
    // a tap stops and delivers, a hold cancels.
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

    // Processing: a tap warns, a hold aborts.
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

    // Idle. In ptt the keyDown already started it; here only toggle acts.
    if (s.mode !== "ptt") await this.startRecording(a, ev.payload.settings);
  }

  // ---------- pipeline ----------

  private async startRecording(a: Surface, raw: ActionSettings): Promise<void> {
    const st = getState(a.id);
    // Before the first await, always: everything below this line runs while a second
    // trigger on the same key could be arriving.
    if (!claimStart(a.id)) return;
    try {
      await this.startRecordingInner(a, raw, st);
    } finally {
      finishStart(a.id);
    }
  }

  private async startRecordingInner(
    a: Surface,
    raw: ActionSettings,
    st: KeyState,
  ): Promise<void> {
    const s = withDefaults(raw);
    const global = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
    const T = keyText(await refreshUiLocale(global));

    // No audio step: the key only rewrites whatever is selected.
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

    // The previous dictation's flash left a timer scheduled that sets the phase back to
    // "idle". Starting again before it fires — which is what pressing twice in a row
    // does — let that timer land on top of THIS recording: the phase went to "idle", the
    // `ready` below abandoned the recorder, and ffmpeg carried on with nobody left able
    // to stop it. That is where the 19-hour MP3s came from.
    clearTimeout(st.resetTimer);
    st.resetTimer = undefined;

    st.phase = "arming";
    st.levels = [];
    st.message = undefined;
    st.audioPath = audioPath;
    st.startedAt = Date.now();
    await this.render(a, raw);

    // In parallel, without blocking the recording: where the text should come back to.
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
      // Something moved the phase out from under this recording while it was opening.
      // Returning would leave ffmpeg running with no reference and no timer able to
      // reach it: an abandoned recording is not a silent one, it is a file that grows
      // until the plugin dies. Give up the recording instead of leaking the process.
      if (cur.phase !== "arming") {
        streamDeck.logger.warn(`recording abandoned while opening (phase=${cur.phase}) — closing ffmpeg`);
        rec.cancel();
        void untrackPid(rec.pid);
        releaseLock(a.id);
        cur.recorder = undefined;
        void unlink(audioPath).catch(() => {});
        return;
      }
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
      streamDeck.logger.error("ffmpeg failed", err);
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

    // Wait for ffmpeg to close the file before reading: `q` finishes the MP3 properly.
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

    // Anti-echo shield: short audio or audio with no speech does not go to the API.
    // Without this, an accidental tap could come back with the dictionary itself as the
    // "transcription".
    const hadSpeech = rec?.speechDetected ?? false;
    if (!audioPath || durationMs < MIN_AUDIO_MS || !hadSpeech) {
      if (audioPath) await unlink(audioPath).catch(() => {});
      st.levels = [];
      await this.flash(a, "warn", [keyText(uiLocaleCache).noSpeech], 1800);
      return;
    }

    await this.runPipeline(a, s, global, { audioPath, durationMs });
  }

  /** A key with no audio step: grabs the selection (Ctrl+C) and rewrites it. */
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
      // --- step 1: transcription ---
      if (src.audioPath) {
        st.phase = "transcribing";
        await this.render(a, await a.getSettings());

        // On a model that takes `keywords[]`, the dictionary goes there and the prompt is
        // left to the key's free context alone — which is what removes the echo risk at
        // its source, instead of only shielding against it downstream.
        const asKeywords = supportsKeywords(s.transcribeModel);
        const { prompt } = buildTranscribePrompt({
          terms,
          context: s.transcribeContext,
          useCanon: s.useCanonPrompt && !asKeywords,
        });

        const result = await transcribe({
          apiKey,
          audioPath: src.audioPath,
          model: s.transcribeModel,
          language: s.language,
          prompt,
          keywords: asKeywords ? buildKeywords({ terms, useCanon: s.useCanonPrompt }).keywords : undefined,
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

      // --- step 2: text ---
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
          // A model refusal must NOT cost you the speech: deliver the raw text.
          if (err instanceof ApiError && err.kind === "filter" && raw) {
            note = "bloqueado — texto cru";
            final = raw;
          } else {
            throw err;
          }
        }
      }

      // --- delivery ---
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
        ).catch((e) => streamDeck.logger.warn("history failed", e));
      }

      if (src.audioPath && !s.keepAudio) await unlink(src.audioPath).catch(() => {});

      st.levels = [];
      if (note) {
        await this.flash(a, "warn", [...T.rawBlocked], 4000);
      } else if (how === "copied" && s.autoPaste) {
        // The focus changed: we do not paste. The text is on the clipboard, waiting.
        await this.flash(a, "warn", [...T.copied], 3500);
      } else {
        await this.flash(a, "done", [...wordCountLines(wordCount(final), uiLocaleCache)], 2000);
      }
    } catch (err) {
      streamDeck.logger.error("pipeline failed", err);

      // Audio from a failed upload is preserved even with "keep audio" switched off —
      // losing minutes of speech to a 429 would be unacceptable.
      if (src.audioPath) {
        const dest = join(FAILED_DIR, `${stamp()}.mp3`);
        await rename(src.audioPath, dest).catch(() => {});
        streamDeck.logger.warn(`audio preserved at ${dest}`);
      }

      st.levels = [];
      if (s.beep) beep(ffmpeg, "error");
      await this.flash(a, "error", [shortError(err, uiLocaleCache)], 4000);
    }
  }

  // ---------- bridge to the panel ----------

  override async onSendToPlugin(ev: SendToPluginEvent<PiMessage, ActionSettings>): Promise<void> {
    const msg = ev.payload;
    const a = ev.action;
    const global = (await streamDeck.settings.getGlobalSettings<GlobalSettings>()) ?? {};
    const ffmpeg = ffmpegOf(global);
    // In SDK v2 the one that talks to the panel is streamDeck.ui, not the action object.
    // The message only goes out if there is a visible PI — the SDK itself guarantees that.
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
            // The lists come out in the PANEL's language — the user is the reader.
            languages: spokenLanguages(uiLocale, msg.autoLabel || "Detect / mixed"),
            targetLanguages: targetLanguages(uiLocale),
          });
          break;
        }

        // Shows the panel the EXACT text that goes to the API. No hidden prompt: if the
        // plugin sends it, you can read it.
        case "preview": {
          const s = withDefaults(await a.getSettings());
          const terms = parseTerms(global.canonTerms);
          const asKeywords = supportsKeywords(s.transcribeModel);
          const built = buildTranscribePrompt({
            terms,
            context: s.transcribeContext,
            useCanon: s.useCanonPrompt && !asKeywords,
          });
          const kw = buildKeywords({ terms, useCanon: s.useCanonPrompt });
          reply({
            event: "preview",
            transcribe: {
              enabled: s.transcribeOn,
              model: s.transcribeModel,
              language: s.language,
              prompt: built.prompt,
              dropped: asKeywords ? kw.droppedTerms : built.droppedTerms,
              keywords: asKeywords ? kw.keywords : undefined,
            },
            text: {
              enabled: s.textOn && hasTextWork(textOptions(s, terms, contentLocale(global, s.language))),
              model: s.textModel,
              parts: textPromptParts(textOptions(s, terms, contentLocale(global, s.language))),
            },
          });
          break;
        }

        // The drawn key, so the panel can show the effect of colour, icon, label and font
        // size live. The settings come IN the message, and not from `a.getSettings()`,
        // because the panel saves with a 150 ms delay — reading from the Stream Deck, the
        // preview would always show the second-to-last character typed.
        case "keyPreview": {
          const s = withDefaults(msg.settings);
          reply({
            event: "keyPreview",
            image: idleImage(s, uiLocaleCache),
            // The grids cost ~20 KB and only change when the colour or the direction
            // changes — not on every keystroke in the label. Hence the separate request.
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
          // The key writes in the panel's language too: moving the selector has to repaint
          // the visible keys, not just the panel.
          await refreshUiLocale(next);
          for (const other of this.actions) {
            if (other.isKey()) await this.render(other, await other.getSettings());
          }
          // Changing the content language renames and rewrites the built-in presets, so
          // the panel needs the new list along with the confirmation.
          reply({
            event: "globalSaved",
            presets: await presetSummaries(contentLocale(next)),
            uiLocale: resolveUiLocale(next.uiLang, appLanguage()),
          });
          break;
        }

        case "applyPreset": {
          const preset = await getPreset(msg.id, contentLocale(global));
          if (!preset) { reply({ event: "error", message: "preset not found" }); break; }
          const current = await a.getSettings();
          const next: ActionSettings = { ...current, presetId: preset.id };
          for (const k of PRESET_FIELDS) {
            const v = preset.settings[k];
            if (v !== undefined) (next as any)[k] = v;
          }
          await a.setSettings(next);
          // Redraw HERE, by hand: when it is the plugin that saves the settings, the
          // Stream Deck notifies the panel but does not send `didReceiveSettings` back to
          // the plugin itself. Since an idle key sits outside the animation cycle, it kept
          // the old drawing — and the preset only "took" on the next click, when some
          // other event ended up forcing the redraw.
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
          if (!device) { reply({ event: "micResult", ok: false, message: "no microphone" }); break; }
          const r = await probeMic(ffmpeg, device, 3);
          reply({
            event: "micResult",
            ok: r.ok && isFinite(r.peakDb),
            peakDb: isFinite(r.peakDb) ? Math.round(r.peakDb) : null,
            // Not routed through i18n: these come from the plugin, which has no
            // translation for them. English by decision — see the note in vault.ts.
            message: !r.ok
              ? "could not open the microphone"
              : !isFinite(r.peakDb) || r.peakDb < -50
                ? "opened, but picked up no sound — speak during the test"
                : `ok — peak ${Math.round(r.peakDb)} dB`,
          });
          break;
        }

        // With `keywords[]` the dictionary no longer travels in the prompt, so it does
        // not spend the 224-token budget — the panel would warn about an overflow that
        // does not exist.
        case "budget": {
          const terms = supportsKeywords(msg.model ?? "") ? [] : parseTerms(global.canonTerms);
          reply({ event: "budget", ...promptBudget(terms, msg.context ?? "") });
          break;
        }

        // The panel sends what was typed and gets back the normalised form, the address
        // ready to copy and the warning about a nickname already in use. Normalisation
        // lives in the plugin, not in the panel, so there are not two rules for flattening
        // accents — the one that would count is always the plugin's.
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
      streamDeck.logger.error("panel: command failed", err);
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
  | { cmd: "budget"; context: string; model?: string }
  | { cmd: "shortcutCheck"; alias?: string };

/** Used by the Property Inspector for the microphone's "Test" button. */
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
