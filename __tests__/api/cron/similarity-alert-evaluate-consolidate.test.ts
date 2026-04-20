import { consolidateMatchedHours } from "@/app/api/cron/similarity-alert-evaluate/route";
import type { ForecastHour } from "@/lib/alerts/types";

function hour(ts: string, overrides: Partial<ForecastHour> = {}): ForecastHour {
  return {
    forecast_at: ts,
    wave_height: 3,
    wave_period: 12,
    swell_1_height: 3,
    swell_1_period: 12,
    swell_1_direction: 270,
    wind_speed: 5,
    wind_direction_deg: 45,
    tide_height: 3,
    tide_status: "rising",
    ...overrides,
  };
}

function rpc(score: number) {
  return {
    score,
    match_percent: Math.round(score * 10),
    label: "Good match",
    reason_bullets: [`Score ${score}`],
    board_tip: null,
  };
}

describe("consolidateMatchedHours", () => {
  it("returns [] for empty input", () => {
    expect(consolidateMatchedHours([])).toEqual([]);
  });

  it("collapses three consecutive hours into one window", () => {
    const matched = [
      { hour: hour("2026-04-21T14:00:00Z"), result: rpc(7.5) },
      { hour: hour("2026-04-21T15:00:00Z"), result: rpc(8.2) },
      { hour: hour("2026-04-21T16:00:00Z"), result: rpc(7.8) },
    ];
    const windows = consolidateMatchedHours(matched);
    expect(windows).toHaveLength(1);
    expect(windows[0].window_start).toBe("2026-04-21T14:00:00Z");
    // window_end is +1h past the last matched hour
    expect(windows[0].window_end).toBe("2026-04-21T17:00:00.000Z");
    // best_hour is the peak score hour
    expect(windows[0].best_hour).toBe("2026-04-21T15:00:00Z");
    expect(windows[0].conditions_snapshot.similarity_score).toBe(8.2);
  });

  it("splits on >1-hour gap into two windows", () => {
    const matched = [
      { hour: hour("2026-04-21T14:00:00Z"), result: rpc(7.9) },
      { hour: hour("2026-04-21T15:00:00Z"), result: rpc(8.0) },
      // 3-hour gap
      { hour: hour("2026-04-21T18:00:00Z"), result: rpc(7.7) },
      { hour: hour("2026-04-21T19:00:00Z"), result: rpc(7.6) },
    ];
    const windows = consolidateMatchedHours(matched);
    expect(windows).toHaveLength(2);
    expect(windows[0].window_start).toBe("2026-04-21T14:00:00Z");
    expect(windows[0].best_hour).toBe("2026-04-21T15:00:00Z");
    expect(windows[1].window_start).toBe("2026-04-21T18:00:00Z");
    expect(windows[1].best_hour).toBe("2026-04-21T18:00:00Z");
  });

  it("emits a single-hour window for an isolated match", () => {
    const matched = [{ hour: hour("2026-04-21T09:00:00Z"), result: rpc(7.5) }];
    const windows = consolidateMatchedHours(matched);
    expect(windows).toHaveLength(1);
    expect(windows[0].window_start).toBe("2026-04-21T09:00:00Z");
    expect(windows[0].window_end).toBe("2026-04-21T10:00:00.000Z");
    expect(windows[0].best_hour).toBe("2026-04-21T09:00:00Z");
  });

  it("orders input chronologically before consolidation (resilient to caller ordering)", () => {
    const matched = [
      { hour: hour("2026-04-21T16:00:00Z"), result: rpc(7.8) },
      { hour: hour("2026-04-21T14:00:00Z"), result: rpc(7.5) },
      { hour: hour("2026-04-21T15:00:00Z"), result: rpc(8.2) },
    ];
    const windows = consolidateMatchedHours(matched);
    expect(windows).toHaveLength(1);
    expect(windows[0].window_start).toBe("2026-04-21T14:00:00Z");
    expect(windows[0].best_hour).toBe("2026-04-21T15:00:00Z");
  });

  it("carries RPC reason_bullets + board_tip + conditions onto the snapshot", () => {
    const matched = [
      {
        hour: hour("2026-04-21T14:00:00Z", { wave_height: 4.2, wave_period: 14 }),
        result: {
          score: 9.1,
          match_percent: 91,
          label: "Great match",
          reason_bullets: ["Wave height matches", "Period matches"],
          board_tip: "Bring the 5'10",
        },
      },
    ];
    const windows = consolidateMatchedHours(matched);
    const snap = windows[0].conditions_snapshot;
    expect(snap.similarity_score).toBe(9.1);
    expect(snap.match_percent).toBe(91);
    expect(snap.label).toBe("Great match");
    expect(snap.reason_bullets).toEqual([
      "Wave height matches",
      "Period matches",
    ]);
    expect(snap.board_tip).toBe("Bring the 5'10");
    expect(snap.wave_height).toBe(4.2);
    expect(snap.wave_period).toBe(14);
  });
});
