// Shape of the settings.
//
// Two layers, and the split is NOT arbitrary:
//   - GLOBAL: only what belongs to the MACHINE or to the PERSON — the canonical word
//     dictionary (the acronyms you use at work), the ffmpeg path and the language
//     preferences. There is no sense in varying these per key. They live in a file of the
//     plugin's own, not in the Stream Deck global settings — see prefs.ts for why.
//   - PER KEY: everything else. This is what lets you have a "raw dictation" key, a
//     "formal email" key and a "-> English" key side by side on the XL, each independent.
//
// The OpenAI key does not live here: it lives in the DPAPI vault (see vault.ts), because
// the Stream Deck settings become a plain-text .json under %APPDATA%\Elgato.

import { asLocale, type Locale } from "./prompt-text.js";

export type CaptureMode = "toggle" | "ptt";
/**
 * The key's visual direction (chosen on 26/07/2026, see docs/estilos):
 *   neon   — a lit outline with a colour halo
 *   aurora — an atmospheric smear of colour behind the white glyph
 *   ring   — a colour meter-arc around the glyph
 * All three are a user option ON PURPOSE: the decision was not to elect one.
 */
export type KeyStyle = "neon" | "aurora" | "ring";
export type IconName =
  | "mic" | "micOff" | "waves" | "headset"
  | "globe" | "translate" | "bubble" | "quote"
  | "doc" | "list" | "keyboard" | "code"
  | "pen" | "wand" | "bolt" | "check"
  | "mail" | "calendar"
  | "none";
export type StyleMode = "none" | "translate" | "custom";
export type LangPref = "auto" | "pt" | "en" | "es";

export type GlobalSettings = {
  /** Canonical word dictionary, comma-separated. Starts out EMPTY. */
  canonTerms?: string;
  /** Path to ffmpeg. Empty = look it up on the PATH. */
  ffmpegPath?: string;
  /** Read-only, so the Property Inspector knows whether a key is already in the vault. */
  hasKey?: boolean;

  // --- languages, on two independent axes ---
  //
  // They exist separately because they are different questions: which language you want
  // to READ the panel in, and which language you want the presets and prompts to be
  // WRITTEN in. Someone running the Stream Deck in English while working in Portuguese
  // needs those two to diverge — and the app only reports one.

  /** The panel's language. "auto" follows Windows, then the Stream Deck app. */
  uiLang?: LangPref;
  /**
   * Language of the presets and of the prompts sent to the API.
   * "auto" follows the key's SPOKEN language; if that is on auto-detect, it falls back
   * to the panel's language.
   */
  contentLang?: LangPref;
};

/**
 * Windows' language, as the plugin's Node sees it ("pt-BR").
 *
 * It comes BEFORE the Stream Deck app's language in both cascades because the app has no
 * Portuguese: a Brazilian user's app reports English, and only Windows tells the truth.
 */
export function osLanguage(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

/**
 * The language in which presets and prompts are written for this key.
 *
 * The cascade matters: the SPOKEN language comes before the panel's language because the
 * clean-up layer relies on examples from the spoken tongue ("vírgula", "né") — a
 * Portuguese prompt applied to English speech would lose exactly the part that works.
 */
export function resolveContentLocale(opts: {
  contentLang?: LangPref;
  spokenLanguage?: string;
  uiLang?: LangPref;
  osLanguage?: string;
  appLanguage?: string;
}): Locale {
  if (opts.contentLang && opts.contentLang !== "auto") return opts.contentLang;
  return (
    asLocale(opts.spokenLanguage) ??
    asLocale(opts.uiLang === "auto" ? undefined : opts.uiLang) ??
    asLocale(opts.osLanguage) ??
    asLocale(opts.appLanguage) ??
    "en"
  );
}

/** The panel's language. */
export function resolveUiLocale(
  uiLang: LangPref | undefined,
  appLanguage: string | undefined,
  osLang?: string,
): Locale {
  if (uiLang && uiLang !== "auto") return uiLang;
  return asLocale(osLang) ?? asLocale(appLanguage) ?? "en";
}

export type ActionSettings = {
  // --- preset and essentials ---
  presetId?: string;
  /** Text on the idle key. */
  label?: string;
  /** DirectShow name of the microphone. Empty = first device found. */
  micDevice?: string;
  /**
   * Nickname addressing this key from a keyboard shortcut (see shortcuts.ts).
   *
   * Empty = the key is NOT reachable from outside. That is on purpose: any program on the
   * machine can fire a `streamdeck://` address, and a key with no nickname is a key
   * nobody opens behind your back. The field is the switch itself.
   */
  shortcutAlias?: string;

  // --- capture ---
  mode?: CaptureMode;
  /**
   * End by itself after N seconds of silence. Ignored in ptt mode.
   * Clamped to [SILENCE_MIN, SILENCE_MAX] in `withDefaults` — see the note there.
   */
  silenceStop?: boolean;
  silenceSeconds?: number;
  /** Automatic cut-off, so it never blows past 25 MB nor records by mistake. */
  maxMinutes?: number;
  beep?: boolean;

  // --- step 1: transcription ---
  transcribeOn?: boolean;
  transcribeModel?: string;
  /** ISO-639-1 of the SPOKEN language. Empty = auto-detect. */
  language?: string;
  /** Context/instruction for the audio model (this is not the term list). */
  transcribeContext?: string;
  /** Also send the canonical dictionary in the transcription prompt. */
  useCanonPrompt?: boolean;

  // --- step 2: text ---
  textOn?: boolean;
  textModel?: string;
  /** Layer A: generic dictation clean-up rules. */
  cleanup?: boolean;
  /**
   * Layer B, what to do BEYOND cleaning up:
   *   none      — nothing; clean-up only
   *   translate — translate into `targetLanguage` (guided mode, no prompt writing)
   *   custom    — the free instruction in `style`
   */
  styleMode?: StyleMode;
  /** Target language when styleMode = "translate". */
  targetLanguage?: string;
  /** Free instruction when styleMode = "custom". */
  style?: string;

  // --- output ---
  autoPaste?: boolean;
  history?: boolean;
  historyDir?: string;
  keepAudio?: boolean;

  // --- appearance ---
  colorIdle?: string;
  colorRec?: string;
  colorDone?: string;
  /** Visual direction of the idle key and of the states. */
  keyStyle?: KeyStyle;
  icon?: IconName;
  showLabel?: boolean;
  showTimer?: boolean;
  showWave?: boolean;
  /** Label font size, in px. */
  labelSize?: number;
  /** Extra space between label lines, in px. */
  labelGap?: number;
};

export const DEFAULTS: Required<ActionSettings> = {
  presetId: "clean",
  label: "",
  micDevice: "",
  shortcutAlias: "",

  mode: "toggle",
  silenceStop: true,
  silenceSeconds: 10,
  maxMinutes: 10,
  beep: true,

  transcribeOn: true,
  transcribeModel: "gpt-transcribe",
  language: "",
  transcribeContext: "",
  useCanonPrompt: true,

  textOn: true,
  textModel: "gpt-5.6-luna",
  cleanup: true,
  styleMode: "none",
  targetLanguage: "en",
  style: "",

  autoPaste: true,
  history: true,
  historyDir: "",
  keepAudio: false,

  colorIdle: "#404650",
  colorRec: "#C44040",
  colorDone: "#2E8C3C",
  keyStyle: "neon",
  icon: "mic",
  showLabel: true,
  showTimer: true,
  showWave: true,
  labelSize: 14,
  labelGap: 1,
};

/**
 * Accepted range for the pause that ends a recording.
 *
 * The 2.5 s floor is the point at which a pause is still clearly the end of speech; below
 * that the recording cuts off people who think before carrying on. The 30 s ceiling
 * exists so the minute limit stays the real lock on audio length.
 *
 * The same two numbers are in the field's `min`/`max` in `ui/dictation.html` — but an
 * `<input type="number">` does NOT prevent an out-of-range value typed by hand, and
 * settings saved by an earlier version accepted 0.5 s. That is why the range is enforced
 * here, on the path that EVERY settings read goes through, and not only in the panel.
 */
export const SILENCE_MIN = 2.5;
export const SILENCE_MAX = 30;

export function withDefaults(s: ActionSettings | undefined): Required<ActionSettings> {
  const out = { ...DEFAULTS } as Required<ActionSettings>;
  if (!s) return clampSilence(out);
  for (const k of Object.keys(DEFAULTS) as Array<keyof ActionSettings>) {
    const v = s[k];
    if (v !== undefined && v !== null && v !== "") (out as any)[k] = v;
  }
  // Fields where an empty string is a legitimate value (must not fall back to the default).
  for (const k of ["label", "style", "transcribeContext", "historyDir", "language", "shortcutAlias"] as const) {
    if (s[k] !== undefined) (out as any)[k] = s[k];
  }
  return clampSilence(out);
}

function clampSilence(out: Required<ActionSettings>): Required<ActionSettings> {
  const v = out.silenceSeconds;
  if (!Number.isFinite(v)) out.silenceSeconds = DEFAULTS.silenceSeconds;
  else out.silenceSeconds = Math.min(SILENCE_MAX, Math.max(SILENCE_MIN, v));
  return out;
}

/**
 * Models suggested in the panel. The field accepts any id typed by hand.
 *
 * The previous generation stays on the list on purpose: `gpt-transcribe` is the only one
 * that takes the dictionary in `keywords[]` (see `supportsKeywords` in openai.ts), and
 * anyone who has a key tuned to the old behaviour should be able to go back to it without
 * editing code.
 */
export const TRANSCRIBE_MODELS = [
  { id: "gpt-transcribe", label: "GPT Transcribe (default, keyword hints)" },
  { id: "gpt-4o-transcribe", label: "GPT-4o Transcribe (previous)" },
  { id: "gpt-4o-mini-transcribe", label: "GPT-4o mini Transcribe (previous, cheapest)" },
  { id: "whisper-1", label: "Whisper-1 (legacy)" },
];

export const TEXT_MODELS = [
  { id: "gpt-5.6-luna", label: "GPT-5.6 Luna (default)" },
  { id: "gpt-5.6-terra", label: "GPT-5.6 Terra (stronger, dearer)" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 mini (fallback)" },
  { id: "gpt-4.1-nano", label: "GPT-4.1 nano (cheapest)" },
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-4o-mini", label: "GPT-4o mini" },
];

/**
 * Where step 2 goes when the chosen model is not available to the account.
 *
 * A new default that the person's project has not been granted yet would otherwise turn
 * every dictation into a lost one, and the model id is a free-text field — a typo has the
 * same shape as a model you cannot reach. `gpt-4.1-mini` is the fallback because it is the
 * model this plugin ran on before and is reachable by any account.
 *
 * It is deliberately NOT a setting: a fallback the person has to configure is a fallback
 * that is empty on the day it is needed.
 */
export const TEXT_FALLBACK_MODEL = "gpt-4.1-mini";





