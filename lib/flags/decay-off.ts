import type { Beach } from "@/types/database";

export function isDecayOffEnabled(): boolean {
  return process.env.DECAY_OFF_ENABLED === "true";
}

export const DECAY_OFF_BEACH_ALLOWLIST: ReadonlySet<string> = new Set([
  "malibu-first-point-surfrider",
]);

export const DECAY_OFF_BAND = { min: 0.5, max: 0.8 } as const;

export function shouldForceNoDecay(
  beach: Pick<Beach, "slug" | "deepwater_decay_factor">,
): boolean {
  if (!isDecayOffEnabled()) return false;
  if (!beach.slug || !DECAY_OFF_BEACH_ALLOWLIST.has(beach.slug)) return false;

  const decay = beach.deepwater_decay_factor;
  if (decay == null) return false;

  return decay >= DECAY_OFF_BAND.min && decay <= DECAY_OFF_BAND.max;
}
