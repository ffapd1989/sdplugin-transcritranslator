// Key colours.
//
// The user picks ONE colour per state; the gradient and the border are computed from it.
// That way any hex — including one typed by hand — produces a coherent key, without
// forcing anyone to pick three matching shades.

export type Shade = { lite: string; base: string; border: string };

const FALLBACK = "#404650";

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  const v = m ? m[1] : FALLBACK.slice(1);
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, "0")).join("")}`;
}

function mix(hex: string, factor: number): string {
  const { r, g, b } = parseHex(hex);
  return factor >= 0
    ? toHex(r + (255 - r) * factor, g + (255 - g) * factor, b + (255 - b) * factor)
    : toHex(r * (1 + factor), g * (1 + factor), b * (1 + factor));
}

export function shade(hex: string): Shade {
  return { lite: mix(hex, 0.22), base: hex || FALLBACK, border: mix(hex, -0.42) };
}

/** Palette suggested in the panel — the field accepts any hex beyond these. */
export const SWATCHES = [
  { hex: "#404650", name: "Graphite" },
  { hex: "#3B6FD4", name: "Blue" },
  { hex: "#2E8C3C", name: "Green" },
  { hex: "#2E7D74", name: "Teal" },
  { hex: "#B8791F", name: "Amber" },
  { hex: "#C44040", name: "Red" },
  { hex: "#5A4FCF", name: "Purple" },
  { hex: "#7A4FA8", name: "Violet" },
];
