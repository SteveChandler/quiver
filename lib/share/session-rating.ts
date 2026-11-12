// Steven, Nov 12 2026. The same table lives in quiver-native `src/lib/share/build-share-card-url.ts`
// (`getRatingLabel`); change both together.
export const SESSION_RATING_LABELS: Readonly<Record<number, string>> = {
  1: "Rough",
  2: "Meh",
  3: "Fun",
  4: "Great",
  5: "Epic",
};

/** Words for stars 1 to 5, in order, for rating pickers. */
export const SESSION_RATING_SCALE: string[] = [1, 2, 3, 4, 5].map(
  (stars) => SESSION_RATING_LABELS[stars],
);

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
