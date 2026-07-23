export const FIGURE_KEYS = [
  "swell-period-morph",
  "swell-origin-fetch",
  "wave-height-reference",
  "tide-window",
] as const;

export type FigureKey = (typeof FIGURE_KEYS)[number];

export function isFigureKey(value: unknown): value is FigureKey {
  return typeof value === "string" && (FIGURE_KEYS as readonly string[]).includes(value);
}
