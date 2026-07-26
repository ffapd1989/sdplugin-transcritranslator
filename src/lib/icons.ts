// A tecla, desenhada como SVG em runtime e pintada com setImage.
//
// DIREÇÃO VISUAL (decidida em 26/07/2026 comparando oito propostas lado a lado —
// ver docs/estilos/): fundo quase-preto e a cor SÓ no que informa. Sobraram três
// direções, e a decisão foi **não eleger uma**: as três viraram opção por tecla.
//
//   neon    contorno aceso com halo de cor        — sintetizador/estúdio
//   aurora  mancha de cor atrás do glifo branco   — macOS moderno
//   ring    arco-medidor na cor em volta do glifo — instrumento/cockpit
//
// UM DESENHO, DOIS MODOS. Os 18 ícones são descritos UMA vez, como lista de formas
// com papéis (corpo, traço, vazado). O neon renderiza essa lista como contorno; a
// aurora e o anel, como silhueta cheia. Desenhar 18 ícones duas vezes seria garantir
// que um dia os dois conjuntos divergissem.
//
// NADA DE <filter>. Todo brilho aqui é gradiente — mesmo mecanismo que a tecla já
// usava. Blur/glow de verdade dependeriam do renderizador do Stream Deck, que não
// temos como testar sem o aparelho na mão.
//
// A waveform da gravação é ROLANTE de propósito: cada barra é um instante dos
// ultimos ~2 s, deslizando da direita para a esquerda. Nove barras pulsando juntas
// enfeitariam; o desenho da voz andando INFORMA — dá para ver na hora se o
// microfone está mudo, se o ganho está baixo ou se a fala está entrando.

import { shade } from "./theme.js";
import type { IconName, KeyStyle } from "./settings.js";

const SIZE = 72;
/** Fundo da tecla. Quase preto, não preto: o preto puro some no corpo do aparelho. */
const BG = "#0C0C10";
/** Borda neutra — quem carrega a cor é o conteúdo, não a moldura. */
const EDGE = "#26262E";
/** Branco levemente frio. Branco puro em fundo escuro "vibra". */
const INK = "#EFF2F7";
/** Altura que a arte central ocupa — usada para calcular o encolhimento. */
const NATURAL = 42;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const f = (n: number): string => n.toFixed(2);

// ---------------------------------------------------------------------------
// O vocabulário de formas
// ---------------------------------------------------------------------------
//
// Todo ícone vive na MESMA grade: caixa de 32x32 centrada em (36,28). Ícone que sai
// da grade estraga o conjunto inteiro — foi o que aconteceu com o primeiro lápis,
// que vazava para fora do desenho.

type Role =
  /** Forma fechada: preenchida no modo cheio, contornada no neon. */
  | "body"
  /** Sempre traço: arcos, setas, o "check" — coisas que não são massa. */
  | "ink"
  /** Detalhe: vazado na cor de trás no modo cheio, traço no neon. */
  | "cut"
  /** Detalhe pequeno e sólido: vazado no modo cheio, tinta no neon. */
  | "cutfill"
  /** Sempre preenchido, nos dois modos (estrelinhas, pontos). */
  | "fill"
  /** A barra do "mudo": vaza por baixo e desenha por cima, senão gruda no glifo. */
  | "slash";

type El = "rect" | "circle" | "ellipse" | "line" | "path";

type Shape = {
  role: Role;
  el: El;
  /** rect [x,y,w,h,rx] · circle [cx,cy,r] · ellipse [cx,cy,rx,ry] · line [x1,y1,x2,y2] */
  a?: number[];
  d?: string;
  /** Multiplicador da espessura, quando esta forma pede mais peso que as outras. */
  w?: number;
};

const body = (el: El, a?: number[], d?: string): Shape => ({ role: "body", el, a, d });
const ink = (el: El, a?: number[], d?: string, w?: number): Shape => ({ role: "ink", el, a, d, w });
const cut = (el: El, a?: number[], d?: string, w?: number): Shape => ({ role: "cut", el, a, d, w });
const cutfill = (el: El, a: number[]): Shape => ({ role: "cutfill", el, a });
const fill = (el: El, a?: number[], d?: string): Shape => ({ role: "fill", el, a, d });

function emit(sh: Shape, attrs: string): string {
  const a = sh.a ?? [];
  switch (sh.el) {
    case "rect":
      return `<rect x="${f(a[0])}" y="${f(a[1])}" width="${f(a[2])}" height="${f(a[3])}" rx="${f(a[4] ?? 0)}" ${attrs}/>`;
    case "circle":
      return `<circle cx="${f(a[0])}" cy="${f(a[1])}" r="${f(a[2])}" ${attrs}/>`;
    case "ellipse":
      return `<ellipse cx="${f(a[0])}" cy="${f(a[1])}" rx="${f(a[2])}" ry="${f(a[3])}" ${attrs}/>`;
    case "line":
      return `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(a[2])}" y2="${f(a[3])}" ${attrs}/>`;
    case "path":
      return `<path d="${sh.d}" ${attrs}/>`;
  }
}

const strokeAttrs = (c: string, w: number, extra = "") =>
  `fill="none" stroke="${c}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round" ${extra}`;

/** Silhueta cheia — usada por `aurora` e `ring`. */
function renderSolid(shapes: Shape[], tint: string, s: number, behind: string): string {
  return shapes
    .map((sh) => {
      const w = s * (sh.w ?? 1);
      switch (sh.role) {
        case "body":
        case "fill": return emit(sh, `fill="${tint}"`);
        case "ink": return emit(sh, strokeAttrs(tint, w));
        case "cut": return emit(sh, strokeAttrs(behind, w * 0.62));
        case "cutfill": return emit(sh, `fill="${behind}"`);
        case "slash":
          return emit(sh, strokeAttrs(behind, w * 2.1)) + emit(sh, strokeAttrs(tint, w));
      }
    })
    .join("");
}

/** Contorno — usado por `neon`, que empilha três passadas desta função. */
function renderOutline(shapes: Shape[], tint: string, s: number, extra = ""): string {
  return shapes
    .map((sh) => {
      const w = s * (sh.w ?? 1);
      switch (sh.role) {
        case "fill":
        case "cutfill": return emit(sh, `fill="${tint}" ${extra}`);
        case "slash":
          return emit(sh, strokeAttrs(BG, w * 2.1)) + emit(sh, strokeAttrs(tint, w, extra));
        default: return emit(sh, strokeAttrs(tint, w, extra));
      }
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Os 18 ícones
// ---------------------------------------------------------------------------

function star(cx: number, cy: number, r: number): Shape {
  const m = r * 0.42;
  return fill("path", undefined,
    `M ${cx} ${cy - r} L ${cx + m} ${cy - m} L ${cx + r} ${cy} L ${cx + m} ${cy + m} ` +
    `L ${cx} ${cy + r} L ${cx - m} ${cy + m} L ${cx - r} ${cy} L ${cx - m} ${cy - m} Z`);
}

const MIC: Shape[] = [
  body("rect", [30.5, 12, 11, 18, 5.5]),
  ink("path", undefined, "M 26 26 A 10 10 0 0 0 46 26"),
  ink("line", [36, 36, 36, 42]),
  ink("line", [30, 42, 42, 42]),
];

const GLYPHS: Record<Exclude<IconName, "none">, Shape[]> = {
  mic: MIC,

  micOff: [...MIC, { role: "slash", el: "line", a: [22.5, 14.5, 49.5, 41.5] }],

  waves: [10, 20, 28, 20, 10].map((h, i) =>
    body("rect", [23 + i * 5.6, 28 - h / 2, 4, h, 2])),

  headset: [
    ink("path", undefined, "M 23 33 A 13 13 0 0 1 49 33", 1.25),
    body("rect", [20, 30, 7, 13, 3.5]),
    body("rect", [45, 30, 7, 13, 3.5]),
  ],

  globe: [
    body("circle", [36, 28, 15]),
    cut("ellipse", [36, 28, 6.4, 15]),
    cut("line", [21.5, 28, 50.5, 28]),
  ],

  // Duas setas opostas dizem "troca de idioma" sem depender de fonte com CJK.
  translate: [
    ink("path", undefined, "M 22 22 H 47", 1.15),
    ink("path", undefined, "M 41 16.5 L 47 22 L 41 27.5", 1.15),
    ink("path", undefined, "M 50 34 H 25", 1.15),
    ink("path", undefined, "M 31 28.5 L 25 34 L 31 39.5", 1.15),
  ],

  bubble: [
    body("rect", [21, 14, 30, 21, 7]),
    body("path", undefined, "M 28 34 L 27 42 L 36 34 Z"),
  ],

  quote: [24, 38].flatMap((x) => [
    body("rect", [x, 17, 10, 10, 3.5]),
    body("path", undefined, `M ${x} 26 L ${x} 32 L ${x + 7} 26 Z`),
  ]),

  doc: [
    body("path", undefined, "M 25 13 H 40 L 47 20 V 43 H 25 Z"),
    cut("path", undefined, "M 40 13 V 20 H 47"),
    cut("line", [30, 28, 42, 28]),
    cut("line", [30, 35, 42, 35]),
  ],

  list: [18, 27, 36].flatMap((y) => [
    body("circle", [24, y, 2.4]),
    body("rect", [31, y - 2, 18, 4, 2]),
  ]),

  keyboard: [
    body("rect", [20, 17, 32, 22, 4.5]),
    ...[0, 1].flatMap((row) =>
      [0, 1, 2, 3, 4].map((col) => cutfill("rect", [24 + col * 5.4, 21.5 + row * 5.4, 3.4, 3.4, 1]))),
    cutfill("rect", [27, 32.3, 18, 3.4, 1.5]),
  ],

  code: [
    ink("path", undefined, "M 29 17 L 20 28 L 29 39", 1.25),
    ink("path", undefined, "M 43 17 L 52 28 L 43 39", 1.25),
  ],

  pen: [
    body("path", undefined, "M 43 16 L 48 21 L 31 38 L 24 40 L 26 33 Z"),
    cut("line", [39.5, 19.5, 44.5, 24.5]),
  ],

  wand: [
    ink("line", [25, 41, 41, 25], undefined, 2),
    cut("line", [34, 32, 38, 36]),
    star(46, 17, 4.5),
    star(44, 29, 3),
    star(31, 19, 3.2),
  ],

  bolt: [body("path", undefined, "M 39 12 L 26 31 H 34 L 32 44 L 46 24 H 37 Z")],

  check: [ink("path", undefined, "M 24 28.5 L 32.5 37 L 48 19", 1.9)],

  mail: [
    body("rect", [21, 16, 30, 23, 4.5]),
    cut("path", undefined, "M 24 21 L 36 30.5 L 48 21"),
  ],

  calendar: [
    ink("line", [28, 12, 28, 19]),
    ink("line", [44, 12, 44, 19]),
    body("rect", [21, 16, 30, 26, 4.5]),
    cut("line", [21, 24.5, 51, 24.5]),
    ...[0, 1].flatMap((row) =>
      [0, 1, 2].map((col) => cutfill("circle", [28 + col * 8, 30.5 + row * 7, 1.9]))),
  ],
};

/** Aviso — não é escolhível no painel, mas passa pelo mesmo pipeline de estilo. */
const WARN: Shape[] = [
  body("path", undefined, "M 36 10.5 L 54 41.5 L 18 41.5 Z"),
  cut("line", [36, 22, 36, 31], undefined, 1.3),
  cutfill("circle", [36, 36.5, 2.2]),
];

/** Todos os ícones oferecidos, na ordem em que o painel os mostra. */
export const ICON_NAMES: IconName[] = [
  "mic", "micOff", "waves", "headset",
  "globe", "translate", "bubble", "quote",
  "doc", "list", "keyboard", "code",
  "pen", "wand", "bolt", "check",
  "mail", "calendar",
  "none",
];

export const KEY_STYLES: KeyStyle[] = ["neon", "aurora", "ring"];

// ---------------------------------------------------------------------------
// As três direções
// ---------------------------------------------------------------------------

/**
 * O traço, compensado pelo encolhimento — parcialmente.
 *
 * MEDIDO, não estimado: com o rótulo em três linhas o glifo cai para k ≈ 0,4, e um
 * traço de 3,1 px vira 1,2 px e some. Compensar por inteiro (1/k, que é o que
 * `vector-effect="non-scaling-stroke"` faria) devolve os 3,1 px — mas num glifo
 * reduzido a 40% isso fica proporcionalmente enorme e o microfone vira uma mancha.
 * A raiz fica no meio: ~2,0 px efetivos, visível sem engordar.
 */
function strokeFor(k: number): number {
  return 3.1 / Math.sqrt(k);
}

type Art = {
  /** Vai atrás de tudo e NÃO encolhe com o glifo — atmosfera da tecla inteira. */
  backdrop: string;
  /** Encolhe junto com o glifo quando o rótulo ocupa espaço. */
  glyph: string;
  defs: string;
};

function styleArt(style: KeyStyle, shapes: Shape[], color: string, k: number): Art {
  const { lite, base } = shade(color);
  const s = strokeFor(k);

  switch (style) {
    case "neon": {
      // Três passadas: eco largo e apagado, traço na cor, filete branco no miolo.
      // É o que dá a impressão de luz sem um único filtro.
      return {
        defs:
          `<radialGradient id="h" cx="0.5" cy="0.5" r="0.5">` +
          `<stop offset="0" stop-color="${lite}" stop-opacity="0.34"/>` +
          `<stop offset="0.55" stop-color="${base}" stop-opacity="0.13"/>` +
          `<stop offset="1" stop-color="${base}" stop-opacity="0"/>` +
          `</radialGradient>`,
        backdrop: "",
        glyph:
          `<circle cx="36" cy="28" r="31" fill="url(#h)"/>` +
          renderOutline(shapes, base, s * 2.6, `opacity="0.30"`) +
          renderOutline(shapes, lite, s * 1.05) +
          renderOutline(shapes, "#FFFFFF", s * 0.4, `opacity="0.85"`),
      };
    }

    case "aurora": {
      // A mancha é da TECLA, não do glifo: fica fora do grupo que encolhe, e o raio
      // acompanha o da tecla — sem isso ela vaza pelos cantos arredondados.
      return {
        defs:
          `<radialGradient id="h" cx="0.38" cy="0.30" r="0.75">` +
          `<stop offset="0" stop-color="${lite}" stop-opacity="0.55"/>` +
          `<stop offset="0.5" stop-color="${base}" stop-opacity="0.22"/>` +
          `<stop offset="1" stop-color="${base}" stop-opacity="0"/>` +
          `</radialGradient>`,
        backdrop: `<rect x="2.5" y="2.5" width="67" height="67" rx="13.5" fill="url(#h)"/>`,
        glyph: renderSolid(shapes, INK, s, BG),
      };
    }

    case "ring": {
      // Arco de ~300°, aberto embaixo. O glifo entra reduzido para caber dentro.
      return {
        defs:
          `<linearGradient id="h" x1="0" y1="0" x2="0" y2="1">` +
          `<stop offset="0" stop-color="${lite}"/><stop offset="1" stop-color="${base}"/>` +
          `</linearGradient>`,
        backdrop: "",
        glyph:
          `<circle cx="36" cy="28" r="21" fill="${base}" opacity="0.10"/>` +
          `<path d="M 25.5 46.2 A 21 21 0 1 1 46.5 46.2" fill="none" stroke="url(#h)" ` +
          `stroke-width="${f(s * 0.85)}" stroke-linecap="round"/>` +
          `<g transform="translate(36 28) scale(0.72) translate(-36 -28)">` +
          renderSolid(shapes, INK, s * 1.2, BG) +
          `</g>`,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Estados animados — iguais nas três direções, porque já são cor pura sobre escuro
// ---------------------------------------------------------------------------

/** Reticencias animadas por fase — dá sensacao de progresso sem custo. */
function dotsGlyph(color: string, phase: number): string {
  const { lite } = shade(color);
  return [0, 1, 2]
    .map((i) => {
      const on = i === phase % 3;
      return `<circle cx="${24 + i * 12}" cy="28" r="${on ? 5.5 : 3.8}" fill="${lite}" opacity="${on ? 1 : 0.5}"/>`;
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
  const maxH = 28;

  const data = levels.slice(-BARS);
  while (data.length < BARS) data.unshift(0);

  return data
    .map((v, i) => {
      const h = Math.max(3, v * maxH);
      const x = x0 + i * (w + gap);
      // Barras mais recentes (a direita) um pouco mais opacas: reforca o sentido
      // da rolagem sem precisar de animacao.
      const op = 0.5 + 0.5 * (i / (BARS - 1));
      return (
        `<rect x="${f(x)}" y="${f(cy - h / 2)}" width="${f(w)}" height="${f(h)}" rx="${f(w / 2)}" ` +
        `fill="url(#h)" opacity="${f(op)}"/>`
      );
    })
    .join("");
}

const waveDefs = (color: string): string => {
  const { lite, base } = shade(color);
  return (
    `<linearGradient id="h" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${lite}"/><stop offset="1" stop-color="${base}"/>` +
    `</linearGradient>`
  );
};

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

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
function textEl(s: string, y: number, size: number): string {
  const t = esc(s);
  const width = s.length * size * CHAR_RATIO;
  const fitted = width > TEXT_WIDTH ? Math.max(7, (size * TEXT_WIDTH) / width) : size;
  return (
    `<text x="36" y="${f(y)}" text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif" ` +
    `font-size="${f(fitted)}" font-weight="600" fill="${INK}">${t}</text>`
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

/**
 * A linha de base de cada linha de texto, dado o corpo de fonte de cada uma.
 *
 * O bloco é ancorado pelo RODAPÉ da tecla e cresce para cima: com uma linha o texto
 * fica onde sempre esteve; com duas ou três ele sobe, em vez de vazar para fora.
 *
 * O passo entre duas linhas soma a ascendente da de baixo com a descendente da de
 * cima — com corpos iguais dá exatamente `corpo + gap`, o mesmo espaçamento de antes.
 */
function textLayout(sizes: number[], gap: number): number[] {
  const n = sizes.length;
  if (n <= 0) return [];
  const ys = new Array<number>(n);
  ys[n - 1] = 68 - (sizes[n - 1] - 14) * 0.25; // corpos maiores respiram um pouco mais
  for (let i = n - 2; i >= 0; i--) {
    ys[i] = ys[i + 1] - (0.75 * sizes[i + 1] + 0.25 * sizes[i] + gap);
  }
  return ys;
}

// ---------------------------------------------------------------------------
// A tecla
// ---------------------------------------------------------------------------

export type KeySpec = {
  color: string;
  /** Direção visual. Sem isto, `neon`. */
  style?: KeyStyle;
  icon?: IconName;
  /** Substitui o glifo do ícone. */
  special?: "check" | "cross" | "warn" | "dots" | "wave";
  levels?: number[];
  phase?: number;
  /** Até três linhas embaixo. */
  lines?: string[];
  /** Corpo da fonte do texto, em px. */
  fontSize?: number;
  /**
   * Corpo de CADA linha, quando elas não são iguais — é o que permite "142" grande
   * sobre "palavras" pequeno na confirmação. Cada posição sem valor cai em `fontSize`.
   */
  fontSizes?: number[];
  /** Espaço extra entre linhas, em px. */
  lineGap?: number;
  /** Sigla no canto (ex.: "EN") — a tecla mostra para qual idioma ela traduz. */
  badge?: string;
};

function shapesFor(spec: KeySpec): Shape[] | null {
  switch (spec.special) {
    case "check": return GLYPHS.check;
    case "cross": return GLYPHS.micOff;
    case "warn": return WARN;
    case "dots":
    case "wave": return null; // têm desenho próprio
    default: {
      const icon = spec.icon ?? "mic";
      return icon === "none" ? [] : GLYPHS[icon] ?? GLYPHS.mic;
    }
  }
}

export function keyImage(spec: KeySpec): string {
  const style = spec.style ?? "neon";

  const lines = (spec.lines ?? []).filter((l) => l && l.length).slice(0, 3);
  const gap = spec.lineGap ?? 0;
  // Respeita o corpo escolhido e só encolhe se o bloco não couber na faixa de texto
  // da tecla (~38 px). Assim "fonte grande" continua grande com uma linha. Quando as
  // linhas têm corpos diferentes, todas encolhem na mesma proporção.
  const wanted = lines.map((_, i) => spec.fontSizes?.[i] ?? spec.fontSize ?? 14);
  const height = wanted.reduce((a, b) => a + b, 0) + Math.max(0, lines.length - 1) * gap;
  const sizes = height > 38 ? wanted.map((s) => Math.max(8, (s * 38) / height)) : wanted;

  const ys = textLayout(sizes, gap);
  const text = ys.map((y, i) => textEl(lines[i], y, sizes[i])).join("");

  // O texto manda no espaço: com duas ou três linhas o glifo ENCOLHE e sobe, em vez
  // de ficar por baixo das letras. Sem isto, "Relato de atendimento" imprime as
  // linhas em cima do microfone e nada fica legível.
  const textTop = ys.length ? ys[0] - sizes[0] : SIZE;
  const boxTop = 5;
  const boxBottom = Math.min(SIZE - 4, textTop - 3);
  const available = boxBottom - boxTop;

  let defs = "";
  let backdrop = "";
  let art = "";

  if (available >= 12) {
    const k = Math.min(1, available / NATURAL);
    const shapes = shapesFor(spec);

    let center: string;
    if (spec.special === "dots") {
      center = dotsGlyph(spec.color, spec.phase ?? 0);
    } else if (spec.special === "wave") {
      defs = waveDefs(spec.color);
      center = waveGlyph(spec.levels ?? []);
    } else if (shapes && shapes.length) {
      const a = styleArt(style, shapes, spec.color, k);
      defs = a.defs;
      backdrop = a.backdrop;
      center = a.glyph;
    } else {
      center = ""; // ícone "none": só o rótulo
    }

    if (k >= 0.995) {
      art = center;
    } else if (center) {
      // Escala em torno do centro natural do glifo (36, 28) e recentraliza na sobra.
      const cy = boxTop + available / 2;
      art = `<g transform="translate(36 ${f(cy)}) scale(${f(k)}) translate(-36 -28)">${center}</g>`;
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
    (defs ? `<defs>${defs}</defs>` : "") +
    `<rect x="1.5" y="1.5" width="69" height="69" rx="14" fill="${BG}" stroke="${EDGE}" stroke-width="1.5"/>` +
    backdrop +
    art +
    text +
    (spec.badge ? badgeSvg(spec.badge) : "") +
    `</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

/** Selo de canto: diz o destino da tradução sem precisar abrir o painel. */
function badgeSvg(text: string): string {
  const t = esc(text.slice(0, 3).toUpperCase());
  const w = t.length <= 2 ? 22 : 27;
  return (
    `<rect x="${68 - w}" y="4" width="${w}" height="16" rx="5" fill="#1A1A22" stroke="${EDGE}" stroke-width="1"/>` +
    `<text x="${68 - w / 2}" y="16" text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif" ` +
    `font-size="11" font-weight="700" fill="${INK}">${t}</text>`
  );
}

/**
 * O ícone sozinho, para as grades de escolha do painel.
 *
 * Sai do MESMO desenho da tecla — a grade mostra o que a tecla vai mostrar, não uma
 * ilustração parecida feita à parte.
 */
export function iconThumb(icon: IconName, style: KeyStyle, color: string): string {
  if (icon === "none") {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="8 0 56 56">` +
      `<circle cx="36" cy="28" r="19" fill="none" stroke="${EDGE}" stroke-width="2"/>` +
      `<line x1="24" y1="16" x2="48" y2="40" ${strokeAttrs(EDGE, 2.6)}/>` +
      `</svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
  }
  const a = styleArt(style, GLYPHS[icon] ?? GLYPHS.mic, color, 1);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="8 0 56 56">` +
    `<defs>${a.defs}</defs>` +
    (a.backdrop ? `<rect x="8" y="0" width="56" height="56" fill="url(#h)"/>` : "") +
    a.glyph +
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
