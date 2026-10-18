export function importStartedAt(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const start = data.inWaterStart ?? data.startedAt;
  return typeof start === "string" ? start : null;
}
