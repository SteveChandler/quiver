/**
 * Shared brand tokens for sticker-style pills on beach detail pages.
 *
 * The watchers badge and share pill need to read as a matched pair in
 * the social-attribution cluster below the beach name. This file is
 * the single source of truth for the asymmetric border-radius,
 * Charming Orange treatment, and compact padding that define both
 * pills visually. If you add a third sticker pill to the cluster,
 * import from here instead of re-expressing the classes inline.
 *
 * Rotations live at the component level — the pills use an
 * opposite-tilt convention (watchers −1°, share +0.75°) so they feel
 * like two separate stickers peeled onto the same surface, not a
 * styled button pair.
 *
 * Plan: abstract-exploring-phoenix (Commit D, D2).
 */

/** Base pill geometry + Charming Orange palette shared by every
 *  sticker pill in the attribution cluster. Rotation is NOT included
 *  — each pill picks its own tilt. */
export const STICKER_PILL_BASE =
  "inline-flex items-center gap-1 px-2 py-0.5 " +
  "rounded-[6px_4px_6px_4px] " +
  "bg-[#F78E42]/10 border border-[#F78E42]/25 " +
  "text-[11px] font-medium text-[#F78E42] " +
  "whitespace-nowrap";

/** Hover treatment applied to interactive pills (the share pill).
 *  Watchers badge is static copy and omits these. */
export const STICKER_PILL_INTERACTIVE =
  "cursor-pointer transition-colors duration-150 " +
  "hover:bg-[#F78E42]/15 hover:border-[#F78E42]/40 " +
  "focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-[#F78E42]/60 focus-visible:ring-offset-1";

/** Rotation conventions — a matched pair of sticker pills should
 *  oppose each other's tilts so they read as independently placed. */
export const STICKER_ROTATIONS = {
  watchers: "rotate-[-1deg]",
  share: "rotate-[0.75deg]",
} as const;
