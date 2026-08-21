// Names and instructions of the built-in presets, in three languages.
//
// They live here, and not in the panel's i18n, because the INSTRUCTION is written into
// the key's settings when you apply the preset — it becomes a real prompt, sent to the
// API. The panel only displays what the plugin has already resolved, so there is no text
// duplicated on both sides and no risk of drifting out of sync.

import type { Locale } from "./prompt-text.js";

export type PresetTextKey = "raw" | "clean" | "translate" | "email" | "topics" | "proofread";

export type PresetText = {
  name: string;
  /** The style layer's instruction. Absent in presets that do not use one. */
  style?: string;
};

export const PRESET_TEXT: Record<Locale, Record<PresetTextKey, PresetText>> = {
  pt: {
    raw: { name: "Ditado cru" },
    clean: { name: "Ditado limpo" },
    translate: { name: "Traduzir" },
    email: {
      name: "E-mail formal",
      style:
        "Reescreva como um e-mail profissional: saudação breve, corpo objetivo em parágrafos curtos e fecho cordial. " +
        "Não invente destinatário, assunto, prazos nem informações que não estejam no texto.",
    },
    topics: {
      name: "Tópicos",
      style:
        "Reorganize o conteúdo em tópicos com marcadores, um item por ideia, na ordem em que foram ditas. " +
        "Não acrescente itens, não agrupe ideias distintas e não crie títulos.",
    },
    proofread: {
      name: "Só revisar a seleção",
      style:
        "Revise o texto: corrija ortografia, acentuação, pontuação e concordância. " +
        "Não altere o conteúdo, o estilo nem a ordem das ideias, e não acrescente nada.",
    },
  },

  en: {
    raw: { name: "Raw dictation" },
    clean: { name: "Clean dictation" },
    translate: { name: "Translate" },
    email: {
      name: "Formal email",
      style:
        "Rewrite as a professional email: brief greeting, focused body in short paragraphs and a courteous sign-off. " +
        "Do not invent a recipient, subject, deadlines or any information that is not in the text.",
    },
    topics: {
      name: "Bullet points",
      style:
        "Reorganise the content into bullet points, one item per idea, in the order they were said. " +
        "Do not add items, do not merge distinct ideas and do not create headings.",
    },
    proofread: {
      name: "Proofread selection only",
      style:
        "Proofread the text: fix spelling, accents, punctuation and agreement. " +
        "Do not change the content, the style or the order of ideas, and do not add anything.",
    },
  },

  es: {
    raw: { name: "Dictado crudo" },
    clean: { name: "Dictado limpio" },
    translate: { name: "Traducir" },
    email: {
      name: "Correo formal",
      style:
        "Reescribe como un correo profesional: saludo breve, cuerpo directo en párrafos cortos y despedida cordial. " +
        "No inventes destinatario, asunto, plazos ni información que no esté en el texto.",
    },
    topics: {
      name: "Viñetas",
      style:
        "Reorganiza el contenido en viñetas, un ítem por idea, en el orden en que se dijeron. " +
        "No agregues ítems, no juntes ideas distintas y no crees títulos.",
    },
    proofread: {
      name: "Solo corregir la selección",
      style:
        "Corrige el texto: ortografía, acentuación, puntuación y concordancia. " +
        "No cambies el contenido, el estilo ni el orden de las ideas, y no agregues nada.",
    },
  },
};

export function presetText(locale: Locale, key: PresetTextKey): PresetText {
  return PRESET_TEXT[locale]?.[key] ?? PRESET_TEXT.en[key];
}
