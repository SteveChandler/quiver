export interface BeachForWaterQualityFilter {
  id: string;
}

/** Returns null for malformed hold data so callers can fail closed. */
export function filterBeachesByWaterQualityHolds<
  T extends BeachForWaterQualityFilter,
>(beaches: readonly T[], heldRows: unknown): T[] | null {
  if (!Array.isArray(heldRows)) return null;

  const heldBeachIds = new Set<string>();
  for (const row of heldRows) {
    if (
      typeof row !== "object" ||
      row === null ||
      typeof (row as { beach_id?: unknown }).beach_id !== "string"
    ) {
      return null;
    }
    heldBeachIds.add((row as { beach_id: string }).beach_id.toLowerCase());
  }

  return beaches.filter(
    (beach) => !heldBeachIds.has(beach.id.toLowerCase()),
  );
}
