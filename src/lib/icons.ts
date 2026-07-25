// A tecla, desenhada como SVG em runtime e pintada com setImage.
//
// A waveform da gravação é ROLANTE de propósito: cada barra é um instante dos
// ultimos ~2 s, deslizando da direita para a esquerda. Nove barras pulsando juntas
// enfeitariam; o desenho da voz andando INFORMA — dá para ver na hora se o
// microfone está mudo, se o ganho está baixo ou se a fala está entrando.

import { shade } from "./theme.js";
import type { IconName } from "./settings.js";

const SIZE = 72;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const f = (n: number): string => n.toFixed(2);

/** Glifos desenhados em uma caixa de 32x32 centrada em (36,28). */
function glyph(name: IconName): string {
  const stroke = `stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  switch (name) {
    case "mic":
      return (
        `<rect x="30" y="12" width="12" height="21" rx="6" fill="#ffffff"/>` +
        `<path d="M 25 28 A 11 11 0 0 0 47 28" ${stroke}/>` +
        `<line x1="36" y1="39" x2="36" y2="45" ${stroke}/>` +
        `<line x1="29" y1="45" x2="43" y2="45" ${stroke}/>`
      );
    case "globe":
      return (
        `<circle cx="36" cy="28" r="15" ${stroke}/>` +
        `<ellipse cx="36" cy="28" rx="6.5" ry="15" ${stroke}/>` +
        `<line x1="21" y1="28" x2="51" y2="28" ${stroke}/>` +
        `<path d="M 24 19 Q 36 24 48 19" ${stroke}/>` +
        `<path d="M 24 37 Q 36 32 48 37" ${stroke}/>`
      );
    case "bubble":
      return (
        `<rect x="19" y="14" width="34" height="24" rx="7" ${stroke}/>` +
        `<path d="M 28 38 L 27 46 L 36 38" ${stroke}/>`
      );
    case "pen":
      return (
        `<path d="M 44 14 L 50 20 L 27 43 L 19 45 L 21 37 Z" ${stroke}/>` +
        `<line x1="40" y1="18" x2="46" y2="24" ${stroke}/>`
      );
    default:
      return "";
  }
}

function checkGlyph(): string {
  return (
    `<polyline points="24,28 32,36 49,19" fill="none" stroke="#ffffff" ` +
    `stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

function crossGlyph(): string {
  const s = `stroke="#ffffff" stroke-width="6" stroke-linecap="round"`;
  return `<line x1="26" y1="18" x2="46" y2="38" ${s}/><line x1="46" y1="18" x2="26" y2="38" ${s}/>`;
}

function warnGlyph(): string {
  return (
    `<path d="M 36 14 L 50 39 L 22 39 Z" fill="none" stroke="#ffffff" stroke-width="4" stroke-linejoin="round"/>` +
    `<line x1="36" y1="24" x2="36" y2="31" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>` +
    `<circle cx="36" cy="35.5" r="2" fill="#ffffff"/>`
  );
}

/** Reticencias animadas por fase — dá sensacao de progresso sem custo. */
function dotsGlyph(phase: number): string {
  return [0, 1, 2]
    .map((i) => {
      const on = i === phase % 3;
      return `<circle cx="${24 + i * 12}" cy="28" r="${on ? 5 : 3.5}" fill="#ffffff" opacity="${on ? 1 : 0.55}"/>`;
    })
    .join("");
}

/** Waveform rolante: `levels` em 0..1, do mais antigo ao mais recente. */
function waveGlyph(levels: number[]): string {
  const BARS = 9;
  const w = 4.6;
  const gap = 1.9;
  const total = BARS * w + (BARS - 1) * gap;
  const x0 = (SIZE - total) / 2;
  const cy = 27;
  const maxH = 26;

  const data = levels.slice(-BARS);
  while (data.length < BARS) data.unshift(0);

  return data
    .map((v, i) => {
      const h = Math.max(3, v * maxH);
      const x = x0 + i * (w + gap);
      // Barras mais recentes (a direita) um pouco mais opacas: reforca o sentido
      // da rolagem sem precisar de animacao.
      const op = 0.55 + 0.45 * (i / (BARS - 1));
      return (
        `<rect x="${f(x)}" y="${f(cy - h / 2)}" width="${f(w)}" height="${f(h)}" rx="${f(w / 2)}" ` +
        `fill="#ffffff" opacity="${f(op)}"/>`
      );
    })
    .join("");
}

/** Largura útil para texto dentro da tecla, em px. */
const TEXT_WIDTH = 62;
/** Largura média de um caractere, em fração do corpo da fonte (Segoe UI semibold). */
const CHAR_RATIO = 0.56;

/**
 * Uma linha de texto que CABE.
 *
 * Reduz o corpo da fonte em vez de espremer os glifos com `textLength`: numa tecla de
 * 72 px o texto comprimido fica ilegível bem antes de o texto menor ficar. A quebra em
 * linhas (wrapLabel) resolve a maioria dos casos; isto é a rede para uma palavra única
 * comprida, que não tem onde quebrar.
 */
function textEl(s: string, y: number, size = 14): string {
  const t = esc(s);
  const width = s.length * size * CHAR_RATIO;
  const fitted = width > TEXT_WIDTH ? Math.max(7, (size * TEXT_WIDTH) / width) : size;
  return (
    `<text x="36" y="${f(y)}" text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif" ` +
    `font-size="${f(fitted)}" font-weight="600" fill="#ffffff">${t}</text>`
  );
}

/**
 * Quebra o rótulo em linhas.
 *
 * Respeita a quebra que a pessoa digitou; se não houver, quebra sozinho por palavra
 * quando o texto não cabe. Sem isto, "Petição inicial" viraria uma linha só espremida
 * até ficar ilegível — a tecla tem 72 px.
 */
export function wrapLabel(text: string, size: number, maxLines = 3): string[] {
  const manual = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (manual.length > 1) return manual.slice(0, maxLines);

  const single = manual[0] ?? "";
  const perLine = Math.max(4, Math.floor(62 / (size * 0.56)));
  if (single.length <= perLine) return single ? [single] : [];

  const lines: string[] = [];
  let current = "";
  for (const word of single.split(/\s+/)) {
    if (!current) current = word;
    else if ((current + " " + word).length <= perLine) current += " " + word;
    else { lines.push(current); current = word; }
    if (lines.length === maxLines - 1 && current.length > perLine) break;
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

export type KeySpec = {
  color: string;
  icon?: IconName;
  /** Substitui o glifo do ícone. */
  special?: "check" | "cross" | "warn" | "dots" | "wave";
  levels?: number[];
  phase?: number;
  /** Até três linhas embaixo. */
  lines?: string[];
  /** Corpo da fonte do texto, em px. */
  fontSize?: number;
  /** Espaço extra entre linhas, em px. */
  lineGap?: number;
  /** Sigla no canto (ex.: "EN") — a tecla mostra para qual idioma ela traduz. */
  badge?: string;
};

/**
 * Onde cada linha de texto fica, dado quantas são e o corpo da fonte.
 *
 * O bloco é ancorado pelo RODAPÉ da tecla e cresce para cima: com uma linha o texto
 * fica onde sempre esteve; com duas ou três ele sobe, em vez de vazar para fora.
 */
function textLayout(count: number, size: number, gap: number): number[] {
  if (count <= 0) return [];
  const step = size + gap;
  const bottom = 68 - (size - 14) * 0.25; // corpos maiores respiram um pouco mais
  const first = bottom - (count - 1) * step;
  return Array.from({ length: count }, (_, i) => first + i * step);
}

/** Selo de canto: diz o destino da tradução sem precisar abrir o painel. */
function badgeSvg(text: string): string {
  const t = esc(text.slice(0, 3).toUpperCase());
  const w = t.length <= 2 ? 22 : 27;
  return (
    `<rect x="${69 - w}" y="4" width="${w}" height="16" rx="5" fill="#000000" opacity="0.42"/>` +
    `<text x="${69 - w / 2}" y="16" text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif" ` +
    `font-size="11" font-weight="700" fill="#ffffff">${t}</text>`
  );
}

export function keyImage(spec: KeySpec): string {
  const { lite, base, border } = shade(spec.color);

  let center = "";
  switch (spec.special) {
    case "check": center = checkGlyph(); break;
    case "cross": center = crossGlyph(); break;
    case "warn": center = warnGlyph(); break;
    case "dots": center = dotsGlyph(spec.phase ?? 0); break;
    case "wave": center = waveGlyph(spec.levels ?? []); break;
    default: center = glyph(spec.icon ?? "mic");
  }

  const lines = (spec.lines ?? []).filter((l) => l && l.length).slice(0, 3);
  const gap = spec.lineGap ?? 0;
  // Respeita o corpo escolhido e só encolhe se o bloco não couber na faixa de texto
  // da tecla (~38 px). Assim "fonte grande" continua grande com uma linha.
  const wanted = spec.fontSize ?? 14;
  const height = lines.length * wanted + Math.max(0, lines.length - 1) * gap;
  const size = height > 38 ? Math.max(8, (wanted * 38) / height) : wanted;

  const text = textLayout(lines.length, size, gap)
    .map((y, i) => textEl(lines[i], y, size))
    .join("");

  // O texto manda no espaço: com duas ou três linhas o glifo ENCOLHE e sobe, em vez
  // de ficar por baixo das letras. Sem isto, "Relato de atendimento" imprime as
  // linhas em cima do microfone e nada fica legível.
  const ys = textLayout(lines.length, size, gap);
  const textTop = ys.length ? ys[0] - size : SIZE;
  const boxTop = 5;
  const boxBottom = Math.min(SIZE - 4, textTop - 3);
  const available = boxBottom - boxTop;
  const NATURAL = 42; // altura que os glifos ocupam no desenho original

  let art = "";
  if (available >= 12) {
    const k = Math.min(1, available / NATURAL);
    if (k >= 0.995) {
      art = center;
    } else {
      // Escala em torno do centro natural do glifo (36, 28) e recentraliza na sobra.
      const cy = boxTop + available / 2;
      art =
        `<g transform="translate(36 ${f(cy)}) scale(${f(k)}) translate(-36 -28)">${center}</g>`;
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${lite}"/><stop offset="1" stop-color="${base}"/>` +
    `</linearGradient></defs>` +
    `<rect x="2.5" y="2.5" width="67" height="67" rx="13" fill="url(#g)" stroke="${border}" stroke-width="2.5"/>` +
    art +
    text +
    (spec.badge ? badgeSvg(spec.badge) : "") +
    `</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

/** m:ss */
export function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
