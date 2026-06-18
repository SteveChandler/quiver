/** Shift every row's timestamp field so the max lands on `anchorMs`, preserving relative spacing. */
export function rebaseRows<T extends Record<string, unknown>>(
  rows: T[],
  field: keyof T,
  anchorMs: number
): T[] {
  if (rows.length === 0) return rows;

  const times = rows.map((row) => {
    const timestamp = Date.parse(String(row[field]));
    if (Number.isNaN(timestamp)) {
      throw new Error(`Invalid timestamp for field ${String(field)}`);
    }

    return timestamp;
  });
  const maxMs = times.reduce(
    (currentMax, timestamp) => Math.max(currentMax, timestamp),
    Number.NEGATIVE_INFINITY
  );
  const delta = anchorMs - maxMs;

  return rows.map((row, index) => ({
    ...row,
    [field]: new Date(times[index] + delta).toISOString(),
  }));
}
