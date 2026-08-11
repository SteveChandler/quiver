import type { FoundWindow } from "@/lib/alerts/window-finder";

export const ALERT_SCORE_TIE_TOLERANCE = 0.04;
export const ALERT_SCORE_MATERIAL_MARGIN = 0.08;

/**
 * How far past `best_hour` a window may still be sent. A surfer who gets the alert a
 * few minutes into the best hour can still act on it; an hour late they cannot.
 * Production 2026-08-10 sent 11 alerts up to 58 minutes after best_hour because the
 * only guard was `window_end > now`, and a 15:00-16:00 window is still "unfinished"
 * at 15:58.
 */
export const ALERT_MIN_ACTIONABLE_LEAD_MINUTES = 15;

export function selectActionableAlertWindow(
  windows: FoundWindow[],
  now: Date = new Date()
): FoundWindow | null {
  const nowMs = now.getTime();
  const futureWindows = windows.filter((window) => {
    const bestHourMs = new Date(window.best_hour).getTime();
    const endMs = new Date(window.window_end).getTime();
    if (!Number.isFinite(bestHourMs) || !Number.isFinite(endMs)) return false;
    // The window must not be over AND the best hour must still be reachable.
    return (
      endMs > nowMs &&
      bestHourMs + ALERT_MIN_ACTIONABLE_LEAD_MINUTES * 60_000 > nowMs
    );
  });

  if (futureWindows.length === 0) return null;

  const byStart = [...futureWindows].sort(
    (a, b) =>
      new Date(a.window_start).getTime() -
      new Date(b.window_start).getTime()
  );
  const earliest = byStart[0];
  const top = [...futureWindows].sort((a, b) => {
    if (b.best_score !== a.best_score) return b.best_score - a.best_score;
    return (
      new Date(a.window_start).getTime() -
      new Date(b.window_start).getTime()
    );
  })[0];

  const scoreDelta = top.best_score - earliest.best_score;
  if (scoreDelta >= ALERT_SCORE_MATERIAL_MARGIN) return top;
  if (scoreDelta <= ALERT_SCORE_TIE_TOLERANCE) return earliest;

  return earliest;
}
