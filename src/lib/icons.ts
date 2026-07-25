// A tecla, desenhada como SVG em runtime e pintada com setImage.
//
// A waveform da gravacao e' ROLANTE de proposito: cada barra e' um instante dos
// ultimos ~2 s, deslizando da direita para a esquerda. Nove barras pulsando juntas
// enfeitariam; o desenho da voz andando INFORMA — da' para ver na hora se o
// microfone esta' mudo, se o ganho esta' baixo ou se a fala esta' entrando.

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

/** Reticencias animadas por fase — da' sensacao de progresso sem custo. */
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

function textEl(s: string, y: number, size = 14): string {
  const t = esc(s);
  // Texto longo e' comprimido em vez de vazar da tecla.
  const fit = t.length > 9 ? ` textLength="62" lengthAdjust="spacingAndGlyphs"` : "";
  return (
    `<text x="36" y="${y}" text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif" ` +
    `font-size="${size}" font-weight="600" fill="#ffffff"${fit}>${t}</text>`
  );
}

export type KeySpec = {
  color: string;
  icon?: IconName;
  /** Substitui o glifo do icone. */
  special?: "check" | "cross" | "warn" | "dots" | "wave";
  levels?: number[];
  phase?: number;
  /** Uma ou duas linhas embaixo. */
  lines?: string[];
};

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

  const lines = (spec.lines ?? []).filter((l) => l && l.length);
  let text = "";
  if (lines.length === 1) text = textEl(lines[0], 62);
  else if (lines.length >= 2) text = textEl(lines[0], 55, 12) + textEl(lines[1], 67, 12);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${lite}"/><stop offset="1" stop-color="${base}"/>` +
    `</linearGradient></defs>` +
    `<rect x="2.5" y="2.5" width="67" height="67" rx="13" fill="url(#g)" stroke="${border}" stroke-width="2.5"/>` +
    center +
    text +
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
