export function isRemoteImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function remoteImageUrlOrUndefined(value: unknown): string | undefined {
  return isRemoteImageUrl(value) ? value.trim() : undefined;
}

export function remoteImageUrlOrFallback(value: unknown, fallback: string): string {
  return remoteImageUrlOrUndefined(value) ?? fallback;
}
