/**
 * Message for anything a forecast job can catch.
 *
 * Supabase hands back `{ error }` as a plain object ({ message, code, details,
 * hint }), not an Error, unless `throwOnError()` is set. Code that does
 * `throw result.error` and later checks `instanceof Error` loses the message,
 * which is how statement timeouts (SQLSTATE 57014) were reported as
 * "Unknown error" in cron_runs and Sentry.
 */
export function describeThrownError(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (error == null) return "Unknown error";
  if (typeof error === "object") {
    const { message, code } = error as { message?: unknown; code?: unknown };
    if (typeof message === "string" && message.length > 0) {
      return typeof code === "string" && code.length > 0
        ? `${message} (${code})`
        : message;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown error";
    }
  }
  return String(error);
}
