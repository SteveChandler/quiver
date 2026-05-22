const BROWSER_SESSION_ID_KEY = "__quiver_session_id";

/**
 * Returns a tab-scoped browser session identifier.
 * This is separate from the DB session_id column and from the persistent visitor ID.
 */
export function getBrowserSessionId(): string {
  if (typeof window === "undefined") return "";

  let sessionId = window.sessionStorage.getItem(BROWSER_SESSION_ID_KEY);

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    window.sessionStorage.setItem(BROWSER_SESSION_ID_KEY, sessionId);
  }

  return sessionId;
}
