const MAX_SERIALISED_LENGTH = 500;

/**
 * Message for anything a forecast job can catch.
 *
 * Supabase hands back `{ error }` as a plain object ({ message, code, details,
 * hint }), not an Error, unless `throwOnError()` is set. Code that does
 * `throw result.error` and later checks `instanceof Error` loses the message,
 * which is how statement timeouts (SQLSTATE 57014) were reported as
 * "Unknown error" in cron_runs and Sentry. With `throwOnError()` the same
 * failure arrives as an Error that still carries `code`, so both shapes render
 * the same way: "<message> (<code>)".
 */
export function describeThrownError(error: unknown): string {
  if (error == null) return "Unknown error";
  if (typeof error !== "object") return String(error);

  const { message, code } = error as { message?: unknown; code?: unknown };
  const text = typeof message === "string" && message.length > 0
    ? message
    : error instanceof Error
      ? error.name
      : serialise(error);
  const codeText =
    typeof code === "string" && code.length > 0
      ? code
      : typeof code === "number" && Number.isFinite(code)
        ? String(code)
        : null;

  return codeText && !text.includes(codeText) ? `${text} (${codeText})` : text;
}

function serialise(value: object): string {
  try {
    return JSON.stringify(value)?.slice(0, MAX_SERIALISED_LENGTH) || "Unknown error";
  } catch {
    return "Unknown error";
  }
}
