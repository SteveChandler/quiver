import {
  ALERT_SCORE_MATERIAL_MARGIN,
  ALERT_SCORE_TIE_TOLERANCE,
  selectActionableAlertWindow,
} from "@/lib/alerts/actionable-window-selector";
import type { FoundWindow } from "@/lib/alerts/window-finder";

function windowAt(
  hour: number,
  bestScore: number,
  overrides: Partial<FoundWindow> = {}
): FoundWindow {
  const start = new Date(Date.UTC(2026, 5, 20, hour, 0, 0));
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    window_start: start.toISOString(),
    window_end: end.toISOString(),
    best_hour: start.toISOString(),
    best_score: bestScore,
    conditions_snapshot: { wave_height: 2 },
    ...overrides,
  };
}

describe("selectActionableAlertWindow", () => {
  it("pins alert score thresholds to the normalized rule-alert score scale", () => {
    expect(ALERT_SCORE_TIE_TOLERANCE).toBe(0.04);
    expect(ALERT_SCORE_MATERIAL_MARGIN).toBe(0.08);
  });

  it("selects the earliest future comparable window", () => {
    const selected = selectActionableAlertWindow(
      [
        windowAt(15, 0.74),
        windowAt(20, 0.77),
      ],
      new Date("2026-06-20T13:00:00Z")
    );

    expect(selected?.window_start).toBe("2026-06-20T15:00:00.000Z");
  });

  it("lets a later window win only when it clears the material margin", () => {
    const selected = selectActionableAlertWindow(
      [
        windowAt(15, 0.70),
        windowAt(20, 0.79),
      ],
      new Date("2026-06-20T13:00:00Z")
    );

    expect(selected?.window_start).toBe("2026-06-20T20:00:00.000Z");
  });

  it("ignores stale windows whose end time is already past", () => {
    const selected = selectActionableAlertWindow(
      [
        windowAt(10, 0.95),
        windowAt(15, 0.70),
      ],
      new Date("2026-06-20T13:00:00Z")
    );

    expect(selected?.window_start).toBe("2026-06-20T15:00:00.000Z");
  });
});
