/**
 * True for the errors Next throws from notFound(), redirect() and
 * permanentRedirect(). Page-level try/catch blocks must rethrow these before
 * logging, or an expected 404 shows up as a runtime error.
 *
 * Next 15+ throws notFound() with digest "NEXT_HTTP_ERROR_FALLBACK;404"; the
 * older "NEXT_NOT_FOUND" digest is kept for compatibility.
 */
export function isNextRouterSignal(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("digest" in error)) return false;
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest !== "string") return false;
  return (
    digest === "NEXT_NOT_FOUND" ||
    digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") ||
    digest.startsWith("NEXT_REDIRECT")
  );
}
