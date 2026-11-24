// Each new Intl.DateTimeFormat with a time zone holds ~25 KB of native ICU memory that V8 frees
// only when GC collects its small JS wrapper. A station render formats ~900 times, so a crawl of
// station pages took one instance past its memory limit (Nov 13–19 2026: OOM kills, 300 s stalls).
// Keys are a locale, a station zone and a few fixed option sets, so the map stays small; the cap
// only guards against an unexpected stream of keys.
const MAX_FORMATTERS = 2_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

export function getDateTimeFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  const cached = formatters.get(key);
  if (cached) return cached;
  // Construct before caching so an unknown zone throws every time and is never stored.
  const formatter = new Intl.DateTimeFormat(locale, options);
  if (formatters.size >= MAX_FORMATTERS) formatters.clear();
  formatters.set(key, formatter);
  return formatter;
}
