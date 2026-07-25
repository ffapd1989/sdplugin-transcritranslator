// Montagem do system prompt da etapa de texto, em camadas.
//
//   Camada A — LIMPEZA DE DITADO: regras genéricas de transformar fala em texto.
//              Não muda o que você disse; arruma como ficou escrito.
//   Camada B — ESTILO: traduzir para um idioma, ou a instrução livre da tecla.
//   + grafia canônica  + travas de segurança.
//
// As camadas são independentes: A sozinha dá "ditado limpo"; B sozinha aplica só o
// estilo; A+B faz as duas coisas numa única chamada de API.
//
// Todo o texto vem de prompt-text.ts, no idioma resolvido para aquela tecla. A camada
// A é adaptada do FALA TU, sem nada do domínio jurídico dele — as regras aproveitadas
// (pontuação falada, autocorreção, hesitações, números, datas) valem para qualquer
// ditado, em qualquer idioma.

import { promptText, type Locale } from "./prompt-text.js";
import type { StyleMode } from "./settings.js";

export type TextPromptOptions = {
  locale: Locale;
  cleanup: boolean;
  styleMode: StyleMode;
  /** Código ISO do idioma de destino (ex.: "en"). */
  targetLanguage: string;
  style: string;
  canonTerms: string[];
};

type StyleInput = Pick<TextPromptOptions, "locale" | "styleMode" | "targetLanguage" | "style">;

/** A instrução da camada B, seja qual for o modo. Vazia = não há camada B. */
export function styleInstruction(o: StyleInput): string {
  const T = promptText(o.locale);
  if (o.styleMode === "translate") {
    return T.translate(T.languageNames[o.targetLanguage] ?? o.targetLanguage);
  }
  if (o.styleMode === "custom") return o.style.trim();
  return "";
}

/** true se há alguma coisa para a etapa de texto fazer. */
export function hasTextWork(o: StyleInput & { cleanup: boolean }): boolean {
  return o.cleanup || styleInstruction(o).length > 0;
}

function canonBlock(o: TextPromptOptions): string {
  if (o.canonTerms.length === 0) return "";
  return promptText(o.locale).canon(o.canonTerms.join(", "));
}

function guardsBlock(locale: Locale): string {
  const T = promptText(locale);
  return T.injectionGuard + T.outputRule + T.secrecy;
}

function styleBlock(o: TextPromptOptions): string {
  const style = styleInstruction(o);
  if (!style) return "";
  const T = promptText(o.locale);
  return `${o.cleanup ? T.alsoApply : T.justApply}\n${style}`;
}

/**
 * As peças do system prompt, nomeadas — é exatamente isto que o painel mostra quando
 * você pede para ver o que será enviado. Nada de texto oculto.
 */
export function textPromptParts(o: TextPromptOptions): Array<{ title: string; body: string }> {
  const T = promptText(o.locale);
  const parts: Array<{ title: string; body: string }> = [];

  if (o.cleanup) parts.push({ title: T.partCleanup, body: T.cleanup });

  const block = styleBlock(o);
  if (block) {
    parts.push({
      title:
        o.styleMode === "translate"
          ? T.partTranslate(T.languageNames[o.targetLanguage] ?? o.targetLanguage)
          : T.partCustom,
      body: block,
    });
  }

  if (parts.length === 0) parts.push({ title: T.partNone, body: T.passthrough });

  const canon = canonBlock(o);
  if (canon) parts.push({ title: T.partCanon, body: canon.trim() });

  parts.push({ title: T.partGuards, body: guardsBlock(o.locale).trim() });
  return parts;
}

export function buildTextSystemPrompt(o: TextPromptOptions): string {
  const T = promptText(o.locale);
  const layers: string[] = [];

  if (o.cleanup) layers.push(T.cleanup);

  const block = styleBlock(o);
  if (block) layers.push(block);

  // hasTextWork() barra antes, mas um system prompt vazio seria pior que isto.
  if (layers.length === 0) layers.push(T.passthrough);

  return layers.join("\n\n") + canonBlock(o) + guardsBlock(o.locale);
}
