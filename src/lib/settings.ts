// Formato das configuracoes.
//
// Duas camadas, e a divisao NAO e' arbitraria:
//   - GLOBAIS: so' o que e' propriedade da MAQUINA ou da PESSOA — a chave da API,
//     o dicionario de palavras canonicas (as siglas que voce usa no seu trabalho)
//     e o caminho do ffmpeg. Nao faz sentido variar por tecla.
//   - POR TECLA: todo o resto. E' o que permite ter uma tecla "ditado cru", outra
//     "e-mail formal" e outra "-> ingles" lado a lado no XL, cada uma independente.
//
// A chave da OpenAI nao mora aqui: vive no cofre DPAPI (ver vault.ts), porque as
// settings do Stream Deck viram um .json em texto plano em %APPDATA%\Elgato.

export type CaptureMode = "toggle" | "ptt";
export type IconName = "mic" | "globe" | "bubble" | "pen" | "none";

export type GlobalSettings = {
  /** Dicionario de palavras canonicas, separado por virgula. Nasce VAZIO. */
  canonTerms?: string;
  /** Caminho do ffmpeg. Vazio = procura no PATH. */
  ffmpegPath?: string;
  /** Somente leitura, para o Property Inspector saber se ja existe chave no cofre. */
  hasKey?: boolean;
};

export type ActionSettings = {
  // --- preset e essencial ---
  presetId?: string;
  /** Texto na tecla ociosa. */
  label?: string;
  /** Nome DirectShow do microfone. Vazio = primeiro dispositivo encontrado. */
  micDevice?: string;

  // --- captura ---
  mode?: CaptureMode;
  /** Encerrar sozinho apos N segundos de silencio. Ignorado no modo ptt. */
  silenceStop?: boolean;
  silenceSeconds?: number;
  /** Corte automatico, para nunca estourar os 25 MB nem gravar por engano. */
  maxMinutes?: number;
  beep?: boolean;

  // --- etapa 1: transcricao ---
  transcribeOn?: boolean;
  transcribeModel?: string;
  /** ISO-639-1 do idioma FALADO. Vazio = deteccao automatica. */
  language?: string;
  /** Contexto/instrucao para o modelo de audio (nao e' a lista de termos). */
  transcribeContext?: string;
  /** Mandar tambem o dicionario canonico no prompt de transcricao. */
  useCanonPrompt?: boolean;

  // --- etapa 2: texto ---
  textOn?: boolean;
  textModel?: string;
  /** Camada A: regras genericas de limpeza de ditado. */
  cleanup?: boolean;
  /** Camada B: instrucao livre (traduzir, formalizar, resumir em topicos...). */
  style?: string;

  // --- saida ---
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
  // Campos onde string vazia e' um valor legitimo (nao deve cair no default).
  for (const k of ["label", "style", "transcribeContext", "historyDir", "language"] as const) {
    if (s[k] !== undefined) (out as any)[k] = s[k];
  }
  return out;
}

/** Modelos sugeridos no painel. O campo aceita qualquer id digitado a mao. */
export const TRANSCRIBE_MODELS = [
  { id: "gpt-4o-mini-transcribe", label: "GPT-4o mini Transcribe (padrao)" },
  { id: "gpt-4o-transcribe", label: "GPT-4o Transcribe (melhor)" },
  { id: "whisper-1", label: "Whisper-1 (legado)" },
];

export const TEXT_MODELS = [
  { id: "gpt-4.1-mini", label: "GPT-4.1 mini (padrao)" },
  { id: "gpt-4.1-nano", label: "GPT-4.1 nano (mais barato)" },
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-4o-mini", label: "GPT-4o mini" },
];

export const LANGUAGES = [
  { code: "", label: "Detectar automaticamente" },
  { code: "pt", label: "Portugues" },
  { code: "en", label: "Ingles" },
  { code: "es", label: "Espanhol" },
  { code: "fr", label: "Frances" },
  { code: "de", label: "Alemao" },
  { code: "it", label: "Italiano" },
  { code: "ja", label: "Japones" },
  { code: "zh", label: "Chines" },
];
