import type { FoundWindow } from "@/lib/alerts/window-finder";

export const ALERT_SCORE_TIE_TOLERANCE = 0.04;
export const ALERT_SCORE_MATERIAL_MARGIN = 0.08;

/**
 * Deliver runs at :00. A dawn window's best hour can start on the very tick that picks up
 * its sunrise-clamped send, so a best hour that began within this grace is "now", not past.
 * Short on purpose: a best hour that started 10 minutes ago stays stale (2026-08-10).
 */
const DELIVERY_TICK_GRACE_MS = 5 * 60 * 1000;

export function selectActionableAlertWindow(
  windows: FoundWindow[],
  now: Date = new Date()
): FoundWindow | null {
  const nowMs = now.getTime();
  const futureWindows = windows.filter((window) => {
    const bestHourMs = new Date(window.best_hour).getTime();
    const endMs = new Date(window.window_end).getTime();
    if (!Number.isFinite(bestHourMs) || !Number.isFinite(endMs)) return false;
    return endMs > nowMs && bestHourMs > nowMs - DELIVERY_TICK_GRACE_MS;
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
