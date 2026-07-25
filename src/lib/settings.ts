// Formato das configurações.
//
// Duas camadas, e a divisão NÃO é arbitrária:
//   - GLOBAIS: só o que é propriedade da MÁQUINA ou da PESSOA — a chave da API,
//     o dicionário de palavras canônicas (as siglas que você usa no seu trabalho),
//     o caminho do ffmpeg e as preferências de idioma. Não faz sentido variar por tecla.
//   - POR TECLA: todo o resto. É o que permite ter uma tecla "ditado cru", outra
//     "e-mail formal" e outra "→ inglês" lado a lado no XL, cada uma independente.
//
// A chave da OpenAI não mora aqui: vive no cofre DPAPI (ver vault.ts), porque as
// settings do Stream Deck viram um .json em texto plano em %APPDATA%\Elgato.

import { asLocale, type Locale } from "./prompt-text.js";

export type CaptureMode = "toggle" | "ptt";
export type IconName = "mic" | "globe" | "bubble" | "pen" | "none";
export type StyleMode = "none" | "translate" | "custom";
export type LangPref = "auto" | "pt" | "en" | "es";

export type GlobalSettings = {
  /** Dicionário de palavras canônicas, separado por vírgula. Nasce VAZIO. */
  canonTerms?: string;
  /** Caminho do ffmpeg. Vazio = procura no PATH. */
  ffmpegPath?: string;
  /** Somente leitura, para o Property Inspector saber se já existe chave no cofre. */
  hasKey?: boolean;

  // --- idiomas, em dois eixos independentes ---
  //
  // Existem separados porque são perguntas diferentes: em que idioma você quer LER o
  // painel, e em que idioma quer que os presets e os prompts sejam ESCRITOS. Quem usa
  // o Stream Deck em inglês e trabalha em português precisa das duas coisas
  // divergindo — e o app só informa uma.

  /** Idioma do painel. "auto" segue o app Stream Deck. */
  uiLang?: LangPref;
  /**
   * Idioma dos presets e dos prompts enviados à API.
   * "auto" segue o idioma FALADO da tecla; se ele estiver em detecção automática,
   * cai para o idioma do painel.
   */
  contentLang?: LangPref;
};

/**
 * Idioma em que os presets e os prompts são escritos para esta tecla.
 *
 * A cascata importa: o idioma FALADO vem antes do idioma do painel porque a camada de
 * limpeza depende de exemplos da língua falada ("vírgula", "né") — um prompt em
 * português aplicado a uma fala em inglês perderia exatamente a parte que trabalha.
 */
export function resolveContentLocale(opts: {
  contentLang?: LangPref;
  spokenLanguage?: string;
  uiLang?: LangPref;
  appLanguage?: string;
}): Locale {
  if (opts.contentLang && opts.contentLang !== "auto") return opts.contentLang;
  return (
    asLocale(opts.spokenLanguage) ??
    asLocale(opts.uiLang === "auto" ? undefined : opts.uiLang) ??
    asLocale(opts.appLanguage) ??
    "en"
  );
}

/** Idioma do painel. */
export function resolveUiLocale(uiLang: LangPref | undefined, appLanguage: string | undefined): Locale {
  if (uiLang && uiLang !== "auto") return uiLang;
  return asLocale(appLanguage) ?? "en";
}

export type ActionSettings = {
  // --- preset e essencial ---
  presetId?: string;
  /** Texto na tecla ociosa. */
  label?: string;
  /** Nome DirectShow do microfone. Vazio = primeiro dispositivo encontrado. */
  micDevice?: string;

  // --- captura ---
  mode?: CaptureMode;
  /** Encerrar sozinho após N segundos de silêncio. Ignorado no modo ptt. */
  silenceStop?: boolean;
  silenceSeconds?: number;
  /** Corte automático, para nunca estourar os 25 MB nem gravar por engano. */
  maxMinutes?: number;
  beep?: boolean;

  // --- etapa 1: transcrição ---
  transcribeOn?: boolean;
  transcribeModel?: string;
  /** ISO-639-1 do idioma FALADO. Vazio = detecção automática. */
  language?: string;
  /** Contexto/instrução para o modelo de áudio (não é a lista de termos). */
  transcribeContext?: string;
  /** Mandar também o dicionario canônico no prompt de transcrição. */
  useCanonPrompt?: boolean;

  // --- etapa 2: texto ---
  textOn?: boolean;
  textModel?: string;
  /** Camada A: regras genéricas de limpeza de ditado. */
  cleanup?: boolean;
  /**
   * Camada B, o que fazer ALÉM de limpar:
   *   none      — nada; só a limpeza
   *   translate — traduzir para `targetLanguage` (modo guiado, sem escrever prompt)
   *   custom    — a instrução livre em `style`
   */
  styleMode?: StyleMode;
  /** Idioma de destino quando styleMode = "translate". */
  targetLanguage?: string;
  /** Instrucao livre quando styleMode = "custom". */
  style?: string;

  // --- saída ---
  autoPaste?: boolean;
  history?: boolean;
  historyDir?: string;
  keepAudio?: boolean;

  // --- aparencia ---
  colorIdle?: string;
  colorRec?: string;
  colorDone?: string;
  icon?: IconName;
  showLabel?: boolean;
  showTimer?: boolean;
  showWave?: boolean;
};

export const DEFAULTS: Required<ActionSettings> = {
  presetId: "clean",
  label: "",
  micDevice: "",

  mode: "toggle",
  silenceStop: true,
  silenceSeconds: 2.5,
  maxMinutes: 10,
  beep: true,

  transcribeOn: true,
  transcribeModel: "gpt-4o-mini-transcribe",
  language: "pt",
  transcribeContext: "",
  useCanonPrompt: true,

  textOn: true,
  textModel: "gpt-4.1-mini",
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
  icon: "mic",
  showLabel: true,
  showTimer: true,
  showWave: true,
};

export function withDefaults(s: ActionSettings | undefined): Required<ActionSettings> {
  const out = { ...DEFAULTS } as Required<ActionSettings>;
  if (!s) return out;
  for (const k of Object.keys(DEFAULTS) as Array<keyof ActionSettings>) {
    const v = s[k];
    if (v !== undefined && v !== null && v !== "") (out as any)[k] = v;
  }
  // Campos onde string vazia é um valor legitimo (não deve cair no default).
  for (const k of ["label", "style", "transcribeContext", "historyDir", "language"] as const) {
    if (s[k] !== undefined) (out as any)[k] = s[k];
  }
  return out;
}

/** Modelos sugeridos no painel. O campo aceita qualquer id digitado a mao. */
export const TRANSCRIBE_MODELS = [
  { id: "gpt-4o-mini-transcribe", label: "GPT-4o mini Transcribe (padrão)" },
  { id: "gpt-4o-transcribe", label: "GPT-4o Transcribe (melhor)" },
  { id: "whisper-1", label: "Whisper-1 (legado)" },
];

export const TEXT_MODELS = [
  { id: "gpt-4.1-mini", label: "GPT-4.1 mini (padrão)" },
  { id: "gpt-4.1-nano", label: "GPT-4.1 nano (mais barato)" },
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-4o-mini", label: "GPT-4o mini" },
];

/**
 * Idiomas que você PODE FALAR. O vazio deixa o modelo detectar.
 *
 * Informar o idioma "will improve accuracy and latency" (documentação da OpenAI) — é
 * a configuração de maior efeito por clique do painel, e por isso ela mora na seção
 * essencial, não no avançado.
 */
export const LANGUAGES = [
  { code: "", label: "Detectar (ou misturo idiomas)" },
  { code: "pt", label: "Português" },
  { code: "en", label: "Inglês" },
  { code: "es", label: "Espanhol" },
  { code: "fr", label: "Francês" },
  { code: "de", label: "Alemão" },
  { code: "it", label: "Italiano" },
  { code: "nl", label: "Holandês" },
  { code: "ca", label: "Catalão" },
  { code: "gl", label: "Galego" },
  { code: "ja", label: "Japonês" },
  { code: "zh", label: "Chinês" },
  { code: "ko", label: "Coreano" },
  { code: "ru", label: "Russo" },
  { code: "uk", label: "Ucraniano" },
  { code: "pl", label: "Polonês" },
  { code: "tr", label: "Turco" },
  { code: "ar", label: "Árabe" },
  { code: "he", label: "Hebraico" },
  { code: "hi", label: "Híndi" },
  { code: "id", label: "Indonésio" },
  { code: "sv", label: "Sueco" },
  { code: "no", label: "Norueguês" },
  { code: "da", label: "Dinamarquês" },
  { code: "fi", label: "Finlandês" },
  { code: "el", label: "Grego" },
  { code: "cs", label: "Tcheco" },
  { code: "ro", label: "Romeno" },
  { code: "hu", label: "Húngaro" },
  { code: "vi", label: "Vietnamita" },
  { code: "th", label: "Tailandês" },
];

/** Idiomas de DESTINO da tradução. Sem "detectar": não se traduz para o desconhecido. */
export const TARGET_LANGUAGES = [
  { code: "en", label: "Inglês" },
  { code: "es", label: "Espanhol" },
  { code: "pt", label: "Português" },
  { code: "fr", label: "Francês" },
  { code: "de", label: "Alemão" },
  { code: "it", label: "Italiano" },
  { code: "nl", label: "Holandês" },
  { code: "ja", label: "Japonês" },
  { code: "zh", label: "Chinês (simplificado)" },
  { code: "ko", label: "Coreano" },
  { code: "ru", label: "Russo" },
  { code: "ar", label: "Árabe" },
];

export function targetLanguageName(code: string): string {
  return TARGET_LANGUAGES.find((l) => l.code === code)?.label ?? code;
}


/** Sigla curta para o badge da tecla: "EN", "ES". */
export function languageBadge(code: string): string {
  return (code || "").slice(0, 2).toUpperCase();
}
