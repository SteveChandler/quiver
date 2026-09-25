const INSTAGRAM_HANDLE_MAX_LENGTH = 30;
const INSTAGRAM_URL_PREFIX = /^(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am)\//i;

/**
 * Canonical Instagram handle from whatever a surfer typed: "@name",
 * "name", or a profile URL. Returns null when nothing usable remains.
 */
export function normalizeInstagramHandle(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  let value = raw.trim();
  if (INSTAGRAM_URL_PREFIX.test(value)) {
    value = value.replace(INSTAGRAM_URL_PREFIX, '').split(/[/?#]/)[0] ?? '';
  }
  const handle = value
    .replace(/^@+/, '')
    .replace(/[^A-Za-z0-9._]/g, '')
    .slice(0, INSTAGRAM_HANDLE_MAX_LENGTH);
  return handle.length > 0 ? handle : null;
}

export function instagramProfileUrl(handle: string): string {
  return `https://instagram.com/${handle}`;
}
