// Same scale as quiver-native `getRatingLabel`, so one session reads the same on both apps.
const SESSION_RATING_LABELS: Record<number, string> = {
  1: "Rough",
  2: "Poor",
  3: "Fair",
  4: "Good",
  5: "Epic",
};

/** The surfer's own 1-5 rating, or null when they gave none. Never a stand-in value. */
export function sessionRatingStars(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const stars = Math.round(n);
  return stars >= 1 && stars <= 5 ? stars : null;
}

export function sessionRatingLabel(stars: number): string {
  return SESSION_RATING_LABELS[stars] ?? "";
}
