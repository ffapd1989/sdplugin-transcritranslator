// The key, drawn as SVG at runtime and painted with setImage.
//
// VISUAL DIRECTION (decided on 26/07/2026 by comparing eight proposals side by side —
// see docs/estilos/): a near-black background and colour ONLY on what carries
// information. Three directions survived, and the decision was **not to elect one**:
// all three became a per-key option.
//
//   neon    a lit outline with a colour halo        — synthesiser/studio
//   aurora  a smear of colour behind the white glyph — modern macOS
//   ring    a colour meter-arc around the glyph      — instrument/cockpit
//
// ONE DRAWING, TWO MODES. The 18 icons are described ONCE, as a list of shapes with
// roles (body, stroke, cut-out). neon renders that list as an outline; aurora and ring
// render it as a filled silhouette. Drawing 18 icons twice would be a guarantee that the
// two sets diverge one day.
//
// NO <filter>. Every glow here is a gradient — the same mechanism the key already used.
// Real blur/glow would depend on the Stream Deck renderer, which we have no way to test
// without the device in hand.
//
// The recording waveform ROLLS on purpose: each bar is one instant of the last ~2 s,
// sliding from right to left. Nine bars pulsing together would be decoration; the drawing
// of a voice moving INFORMS — you can tell at a glance whether the microphone is muted,
// whether the gain is low or whether speech is coming through.

import { shade } from "./theme.js";
import type { IconName, KeyStyle } from "./settings.js";

const SIZE = 72;
/** Key background. Near-black, not black: pure black disappears into the device body. */
const BG = "#0C0C10";
/** Neutral border — the content carries the colour, not the frame. */
const EDGE = "#26262E";
/** A slightly cool white. Pure white on a dark background "vibrates". */
const INK = "#EFF2F7";
/** Height the central artwork occupies — used to compute the shrinking. */
const NATURAL = 42;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const f = (n: number): string => n.toFixed(2);

// ---------------------------------------------------------------------------
// The vocabulary of shapes
// ---------------------------------------------------------------------------
//
// Every icon lives on the SAME grid: a 32x32 box centred at (36,28). An icon that leaves
// the grid ruins the whole set — which is what happened with the first pencil, which
// spilled out of the drawing.

type Role =
  /** A closed shape: filled in solid mode, outlined in neon. */
  | "body"
  /** Always a stroke: arcs, arrows, the "check" — things that are not mass. */
  | "ink"
  /** Detail: cut out in the background colour in solid mode, a stroke in neon. */
  | "cut"
  /** A small solid detail: cut out in solid mode, ink in neon. */
  | "cutfill"
  /** Always filled, in both modes (sparkles, dots). */
  | "fill"
  /** The "muted" bar: cuts out underneath and draws on top, otherwise it sticks to the glyph. */
  | "slash";

type El = "rect" | "circle" | "ellipse" | "line" | "path";

type Shape = {
  role: Role;
  el: El;
  /** rect [x,y,w,h,rx] · circle [cx,cy,r] · ellipse [cx,cy,rx,ry] · line [x1,y1,x2,y2] */
  a?: number[];
  d?: string;
  /** Thickness multiplier, for when this shape asks for more weight than the others. */
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

/** Filled silhouette — used by `aurora` and `ring`. */
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

/** Outline — used by `neon`, which stacks three passes of this function. */
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
// The 18 icons
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

  // Two opposing arrows say "language swap" without depending on a CJK-capable font.
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

/** Warning — not selectable in the panel, but it goes through the same style pipeline. */
const WARN: Shape[] = [
  body("path", undefined, "M 36 10.5 L 54 41.5 L 18 41.5 Z"),
  cut("line", [36, 22, 36, 31], undefined, 1.3),
  cutfill("circle", [36, 36.5, 2.2]),
];

/** Every icon on offer, in the order the panel shows them. */
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
// The three directions
// ---------------------------------------------------------------------------

/**
 * The stroke, compensated for the shrinking — partially.
 *
 * MEASURED, not estimated: with a three-line label the glyph drops to k ~ 0.4, and a
 * 3.1 px stroke becomes 1.2 px and disappears. Compensating in full (1/k, which is what
 * `vector-effect="non-scaling-stroke"` would do) gives back the 3.1 px — but on a glyph
 * reduced to 40% that is proportionally enormous and the microphone turns into a blob.
 * The square root sits in the middle: ~2.0 px effective, visible without fattening up.
 */
function strokeFor(k: number): number {
  return 3.1 / Math.sqrt(k);
}

type Art = {
  /** Goes behind everything and does NOT shrink with the glyph — atmosphere for the whole key. */
  backdrop: string;
  /** Shrinks along with the glyph when the label takes up space. */
  glyph: string;
  defs: string;
};

function styleArt(style: KeyStyle, shapes: Shape[], color: string, k: number): Art {
  const { lite, base } = shade(color);
  const s = strokeFor(k);

  switch (style) {
    case "neon": {
      // Three passes: a wide faint echo, a stroke in the colour, a white hairline in the
      // middle. That is what gives the impression of light without a single filter.
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
      // The smear belongs to the KEY, not to the glyph: it sits outside the group that
      // shrinks, and its radius follows the key's — without that it leaks out of the
      // rounded corners.
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
      // A ~300 degree arc, open at the bottom. The glyph goes in reduced so it fits inside.
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
// Animated states — identical across the three directions, because they are already
// pure colour on dark
// ---------------------------------------------------------------------------

/** Ellipsis animated by phase — gives a sense of progress at no cost. */
function dotsGlyph(color: string, phase: number): string {
  const { lite } = shade(color);
  return [0, 1, 2]
    .map((i) => {
      const on = i === phase % 3;
      return `<circle cx="${24 + i * 12}" cy="28" r="${on ? 5.5 : 3.8}" fill="${lite}" opacity="${on ? 1 : 0.5}"/>`;
    })
    .join("");
}

/** Rolling waveform: `levels` in 0..1, oldest to most recent. */
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
      // The most recent bars (on the right) are slightly more opaque: it reinforces the
      // direction of the roll without needing animation.
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
// Text
// ---------------------------------------------------------------------------

/** Usable width for text inside the key, in px. */
const TEXT_WIDTH = 62;
/** Average character width, as a fraction of the font size (Segoe UI semibold). */
const CHAR_RATIO = 0.56;

/**
 * A line of text that FITS.
 *
 * Reduces the font size instead of squeezing the glyphs with `textLength`: on a 72 px key
 * compressed text becomes illegible well before smaller text does. Wrapping into lines
 * (wrapLabel) handles most cases; this is the net for a single long word with nowhere to
 * break.
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
 * Wraps the label into lines.
 *
 * Honours the break the person typed; if there is none, it breaks by word on its own when
 * the text does not fit. Without this, "Petição inicial" would become a single line
 * squeezed until illegible — the key is 72 px.
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
 * The baseline of each line of text, given each one's font size.
 *
 * The block is anchored to the key's FOOTER and grows upwards: with one line the text
 * stays where it always was; with two or three it rises, instead of spilling out.
 *
 * The step between two lines adds the ascender of the lower one to the descender of the
 * upper one — with equal sizes that comes to exactly `size + gap`, the same spacing as
 * before.
 */
function textLayout(sizes: number[], gap: number): number[] {
  const n = sizes.length;
  if (n <= 0) return [];
  const ys = new Array<number>(n);
  ys[n - 1] = 68 - (sizes[n - 1] - 14) * 0.25; // bigger sizes breathe a little more
  for (let i = n - 2; i >= 0; i--) {
    ys[i] = ys[i + 1] - (0.75 * sizes[i + 1] + 0.25 * sizes[i] + gap);
  }
  return ys;
}

// ---------------------------------------------------------------------------
// The key
// ---------------------------------------------------------------------------

export type KeySpec = {
  color: string;
  /** Visual direction. Without this, `neon`. */
  style?: KeyStyle;
  icon?: IconName;
  /** Replaces the icon's glyph. */
  special?: "check" | "cross" | "warn" | "dots" | "wave";
  levels?: number[];
  phase?: number;
  /** Up to three lines at the bottom. */
  lines?: string[];
  /** Text font size, in px. */
  fontSize?: number;
  /**
   * The size of EACH line, when they are not equal — this is what allows a big "142"
   * over a small "words" in the confirmation. Any position with no value falls back to
   * `fontSize`.
   */
  fontSizes?: number[];
  /** Extra space between lines, in px. */
  lineGap?: number;
  /** Code in the corner (e.g. "EN") — the key shows which language it translates into. */
  badge?: string;
};

function shapesFor(spec: KeySpec): Shape[] | null {
  switch (spec.special) {
    case "check": return GLYPHS.check;
    case "cross": return GLYPHS.micOff;
    case "warn": return WARN;
    case "dots":
    case "wave": return null; // these have a drawing of their own
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
  // Honours the chosen size and only shrinks if the block does not fit the key's text
  // band (~38 px). That way "big font" stays big with one line. When the lines have
  // different sizes, they all shrink by the same proportion.
  const wanted = lines.map((_, i) => spec.fontSizes?.[i] ?? spec.fontSize ?? 14);
  const height = wanted.reduce((a, b) => a + b, 0) + Math.max(0, lines.length - 1) * gap;
  const sizes = height > 38 ? wanted.map((s) => Math.max(8, (s * 38) / height)) : wanted;

  const ys = textLayout(sizes, gap);
  const text = ys.map((y, i) => textEl(lines[i], y, sizes[i])).join("");

  // The text owns the space: with two or three lines the glyph SHRINKS and moves up,
  // instead of ending up underneath the letters. Without this, "Attendance report" prints
  // its lines on top of the microphone and nothing is legible.
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
      center = ""; // icon "none": label only
    }

    if (k >= 0.995) {
      art = center;
    } else if (center) {
      // Scales around the glyph's natural centre (36, 28) and recentres in the leftover.
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

/** Corner badge: tells you the translation target without opening the panel. */
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
 * The icon on its own, for the panel's selection grids.
 *
 * It comes out of the SAME drawing as the key — the grid shows what the key will show,
 * not a similar illustration made separately.
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
