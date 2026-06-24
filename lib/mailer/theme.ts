/**
 * Shared brand tokens for Quiver email templates.
 *
 * Single source of truth for palette, fonts, and the zine sticker recipe so
 * the templates can't drift. Values come from the Brand Vault
 * (Brand-Vault/style-guide/source-docs/DESIGN_SYSTEM.md + colors_and_type.css).
 *
 * Email clients ignore CSS variables, so everything here is plain inline
 * values. Web fonts only load in clients that respect <style> (Apple Mail,
 * iOS Mail); FONT_IMPORT covers those and the FONT_* stacks fall back cleanly
 * everywhere else (Gmail strips <style>).
 */

import * as React from "react";

// ── Palette ────────────────────────────────────────────────────────────────
export const CANVAS = "#252D6B"; // Deep Twilight — outer canvas + hero
export const MAST = "#1A1F4D"; // darker twilight — masthead bar
export const CARD = "#2D357D"; // card surface
export const SURFACE = "#354090"; // elevated surface / cells
export const SURFACE_HIGH = "#3A4896"; // higher elevation
export const ROW = "#2F3880"; // list-row surface
export const BORDER = "#404C92"; // card borders / dividers

export const ORANGE = "#F78E42"; // Charming Orange — CTA / actions only
export const ORANGE_INK = "#3A1C02"; // dark text on orange
export const GOLD = "#FDB84B"; // Paradise Gold — achievement / best-of flags
export const GOLD_INK = "#3A2A06"; // dark text on gold
export const TEAL = "#00D4AA"; // Pacific Teal — data highlights / "worth it"
export const CORAL = "#FF6B5C"; // danger / high rip risk / closure
export const GRAY = "#888780"; // muted verdict (RIDEABLE / MEH)

export const CREAM = "#F5EEDC"; // hero / display text
export const CREAM_MUTED = "rgba(245,238,220,0.62)";
export const TEXT = "#F0F0F0"; // primary body text
export const MUTED = "#B8C7E0"; // secondary text
export const INK = "#0F1330"; // dark text on bright chips

// Cut-paper zine panels (cream on twilight). Text on cream uses dark twilight
// ink, never the cream/muted text colors above.
export const PAPER = CREAM; // cream panel surface
export const PAPER_INK = "#1A2150"; // primary text on cream
export const PAPER_MUTED = "#3A4170"; // secondary text on cream

// ── Fonts ────────────────────────────────────────────────────────────────
export const FONT_DISPLAY =
  "'Space Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif";
export const FONT_MONO =
  "'Space Mono','SFMono-Regular',Menlo,Consolas,'Courier New',monospace";
export const FONT_BODY = "'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif";

export const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap');";

// ── Sticker recipe (Brand Vault: asymmetric, hard offset shadow, never 0°) ──
export const STICKER_RADIUS = "12px 4px 14px 6px";
export const STICKER_SHADOW = "2px 3px 0 rgba(0,0,0,0.35)";
export const STICKER_ROTATIONS = {
  softNeg: "-0.8deg",
  soft: "1.4deg",
  hardNeg: "-3deg",
  hard: "3deg",
} as const;

/**
 * The `bgcolor` HTML attribute is the most reliable way to paint a solid
 * background on a table cell in Outlook (it ignores `background` on divs).
 * React's DOM typings omit `bgcolor`, so this helper applies it (plus the
 * matching inline-style background for every other client) in a typed way.
 */
export function cellBg(
  color: string,
  style: React.CSSProperties = {}
): React.TdHTMLAttributes<HTMLTableCellElement> {
  return {
    ...({ bgcolor: color } as React.TdHTMLAttributes<HTMLTableCellElement>),
    style: { backgroundColor: color, ...style },
  };
}
