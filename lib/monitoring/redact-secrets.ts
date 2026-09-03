const CREDENTIAL_MARKER = /access[_-]?token|refresh[_-]?token|provider[_-]?token|authorization|\bbearer\s|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|[?&](?:token|code|key)=/i;
const SECRET_KEY = /^(?:.*token|authorization|cookie|set-cookie|password|secret|api[_-]?key)$/i;

/** Scrub whole credential-bearing strings: SDK exceptions can embed serialized sessions. */
export function redactSecrets<T>(value: T): T {
  const seen = new WeakSet<object>();
  function scrub(input: unknown, depth: number): unknown {
    if (typeof input === "string") {
      return CREDENTIAL_MARKER.test(input) ? "[REDACTED]" : input;
    }
    if (!input || typeof input !== "object") return input;
    if (depth > 20 || seen.has(input)) return "[REDACTED]";
    seen.add(input);
    if (Array.isArray(input)) return input.map((item) => scrub(item, depth + 1));
    return Object.fromEntries(
      Object.entries(input).map(([key, item]) => [
        key,
        SECRET_KEY.test(key) ? "[REDACTED]" : scrub(item, depth + 1),
      ])
    );
  }
  return scrub(value, 0) as T;
}
