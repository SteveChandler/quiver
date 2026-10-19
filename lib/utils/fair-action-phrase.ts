export const FAIR_ACTION_PHRASES = ["Could be fun", "Fair shot", "Decent shot"] as const;

export interface FairActionIdentity {
  beachId?: string | null;
  instantIso?: string | null;
}

/** The surf day rolls over at 11 UTC, after the overnight windows close. */
export function fairActionPhrase({ beachId, instantIso }: FairActionIdentity = {}): string {
  const instantMs = Date.parse(instantIso ?? "");
  if (!beachId || !Number.isFinite(instantMs)) return FAIR_ACTION_PHRASES[0];

  const surfDate = new Date(instantMs - 11 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const bytes = new TextEncoder().encode(`${beachId}|${surfDate}`);
  let hash = 2166136261;
  for (const byte of bytes) {
    hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  }
  return FAIR_ACTION_PHRASES[hash % FAIR_ACTION_PHRASES.length];
}
