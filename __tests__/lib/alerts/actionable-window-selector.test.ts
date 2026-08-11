import {
  ALERT_MIN_ACTIONABLE_LEAD_MINUTES,
  ALERT_SCORE_MATERIAL_MARGIN,
  ALERT_SCORE_TIE_TOLERANCE,
  selectActionableAlertWindow,
} from "@/lib/alerts/actionable-window-selector";
import type { FoundWindow } from "@/lib/alerts/window-finder";

function window(overrides: Partial<FoundWindow> = {}): FoundWindow {
  return {
    window_start: "2026-08-10T15:00:00.000Z",
    window_end: "2026-08-10T16:00:00.000Z",
    best_hour: "2026-08-10T15:00:00.000Z",
    best_score: 0.7,
    conditions_snapshot: {},
    ...overrides,
  } as FoundWindow;
}

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

describe("late-window suppression", () => {
  // Reproduces production 2026-08-10: window_end was 2 minutes away so the old
  // `window_end > now` test passed, but best_hour was already 58 minutes gone.
  it("rejects a window whose best hour has already passed", () => {
    const now = new Date("2026-08-10T15:58:49.000Z");
    expect(selectActionableAlertWindow([window()], now)).toBeNull();
  });

  it("keeps a window whose best hour is still ahead", () => {
    const now = new Date("2026-08-10T13:00:00.000Z");
    expect(selectActionableAlertWindow([window()], now)?.best_hour).toBe(
      "2026-08-10T15:00:00.000Z",
    );
  });

  it("allows a short grace so a just-started session still sends", () => {
    const graceMs = (ALERT_MIN_ACTIONABLE_LEAD_MINUTES - 1) * 60_000;
    const now = new Date(Date.parse("2026-08-10T15:00:00.000Z") + graceMs);
    expect(selectActionableAlertWindow([window()], now)).not.toBeNull();
  });

  it("prefers a later actionable window over a stale earlier one", () => {
    const now = new Date("2026-08-10T15:58:49.000Z");
    const later = window({
      window_start: "2026-08-10T18:00:00.000Z",
      window_end: "2026-08-10T19:00:00.000Z",
      best_hour: "2026-08-10T18:00:00.000Z",
      best_score: 0.5,
    });
    expect(selectActionableAlertWindow([window(), later], now)?.best_hour).toBe(
      "2026-08-10T18:00:00.000Z",
    );
  });
});
