import type { FoundWindow } from "@/lib/alerts/window-finder";

export const ALERT_SCORE_TIE_TOLERANCE = 0.04;
export const ALERT_SCORE_MATERIAL_MARGIN = 0.08;

export function selectActionableAlertWindow(
  windows: FoundWindow[],
  now: Date = new Date()
): FoundWindow | null {
  const nowMs = now.getTime();
  const futureWindows = windows.filter((window) => {
    const endMs = new Date(window.window_end).getTime();
    return Number.isFinite(endMs) && endMs > nowMs;
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
