/** @jest-environment node */

import { groupGoForecasts } from "@/lib/cron/daily-call-runner";
import type { ForecastVerdict } from "@/lib/alerts/canonical-forecast-verdict";
import type { CanonicalSessionDecision } from "@/lib/recommendations/canonical-decision";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { boardReadMismatch, parseReplayArgs, summarizeReplay, type ReplayRow } from "@/scripts/replay-go-checks";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";

type Verdict = ForecastVerdict["verdict"];

function verdict(value: Verdict, forecastAt: string, beachId: string): ForecastVerdict {
  return {
    forecast: { id: `${beachId}:${forecastAt}`, beach_id: beachId, forecast_at: forecastAt } as EnhancedForecastEntity,
    score: value === "go" ? 75 : 50,
    verdict: value,
    decision: {} as CanonicalSessionDecision,
  };
}

function row(date: string, off: Verdict, on: Verdict, hour = 0, beachId = "beach-a"): ReplayRow {
  const forecastAt = `${date}T${15 + hour}:00:00.000Z`;
  return {
    userId: A,
    localDate: date,
    beachId,
    beachName: beachId,
    forecastAt,
    waveHeightFt: 2,
    wavePeriodS: 8,
    windMph: 5,
    windDeg: 270,
    boardClass: null,
    off: verdict(off, forecastAt, beachId),
    on: verdict(on, forecastAt, beachId),
  };
}

describe("replay-go-checks", () => {
  it("parses users, sample and days", () => {
    expect(parseReplayArgs(["--users", `${A},${B}`])).toEqual({ userIds: [A, B], beginnerSample: 20, days: 7 });
    expect(() => parseReplayArgs(["--users", "nope"])).toThrow("--users must be UUIDs");
    expect(() => parseReplayArgs(["--users", A, "--days", "8"])).toThrow("--days must be 1-7");
  });

  it("lowercases users and rejects a repeated user", () => {
    expect(parseReplayArgs(["--users", `${A.toUpperCase()},${B}`]).userIds).toEqual([A, B]);
    expect(() => parseReplayArgs(["--users", `${A},${B},${A}`])).toThrow(`Duplicate user in --users: ${A}`);
    expect(() => parseReplayArgs(["--users", `${A},${A.toUpperCase()}`])).toThrow(`Duplicate user in --users: ${A}`);
  });

  it("flags a board read that disagrees with the boards table", () => {
    expect(boardReadMismatch(0, [], [])).toBeNull();
    expect(boardReadMismatch(2, ["shortboard", "longboard"], ["shortboard", "longboard"])).toBeNull();
    expect(boardReadMismatch(3, ["longboard"], [])).toBe(
      "boards table has 3 active rows (longboard), but fetchBoardClassesByUser returned none",
    );
    expect(boardReadMismatch(2, ["shortboard", "longboard"], ["longboard", "shortboard"])).not.toBeNull();
    // Rows with no known class give no classes on both sides; the row count tells this apart from no boards.
    expect(boardReadMismatch(1, [], [])).toBeNull();
  });

  it("counts go windows and days per side and lists changed rows", () => {
    const [summary] = summarizeReplay([
      row("2026-11-10", "no", "go"),
      row("2026-11-10", "no", "go", 1),
      row("2026-11-11", "go", "go"),
    ], groupGoForecasts);
    expect(summary.goWindowsPerDay["2026-11-10"]).toEqual({ off: 0, on: 1 });
    expect(summary.goDays).toEqual({ off: 1, on: 2 });
    expect(summary.changed).toHaveLength(2);
  });

  it("counts windows per beach when two beaches interleave on one day", () => {
    const [summary] = summarizeReplay([
      row("2026-11-10", "no", "go", 2, "beach-a"),
      row("2026-11-10", "no", "go", 0, "beach-b"),
      row("2026-11-10", "no", "go", 0, "beach-a"),
    ], groupGoForecasts);
    expect(summary.goWindowsPerDay["2026-11-10"]).toEqual({ off: 0, on: 2 });
  });
});

it("imports without fetching, installing guards or running main", () => {
  const fetchSpy = jest.spyOn(globalThis, "fetch");
  const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  const originalExitCode = process.exitCode;
  try {
    jest.isolateModules(() => {
      const imported = require("@/scripts/replay-go-checks") as typeof import("@/scripts/replay-go-checks");
      expect(imported.parseReplayArgs(["--users", A])).toEqual({ userIds: [A], beginnerSample: 20, days: 7 });
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(globalThis.fetch).toBe(fetchSpy);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(originalExitCode);
  } finally {
    fetchSpy.mockRestore();
    errorSpy.mockRestore();
  }
});
