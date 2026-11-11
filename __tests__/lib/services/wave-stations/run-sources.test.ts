/**
 * @jest-environment node
 */

import {
  failedSources,
  isLatestDue,
  runPerSource,
  sumOk,
} from "@/lib/services/wave-stations/run-sources";
import type { WaveStationSourceAdapter } from "@/lib/services/wave-stations/types";

const adapter = (source: WaveStationSourceAdapter["source"], every: 15 | 30 | 60 = 15): WaveStationSourceAdapter => ({
  source,
  latestEveryMinutes: every,
  fetchStations: async () => [],
  fetchLatestObservations: async () => [],
});

describe("runPerSource", () => {
  it("keeps going when one source fails and names the failure", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const runs = await runPerSource([adapter("ndbc"), adapter("marine_ie"), adapter("aodn")], async (one) => {
      if (one.source === "marine_ie") throw new Error("HTTP 503");
      return { rowsSent: one.source === "ndbc" ? 5 : 2 };
    });
    error.mockRestore();
    expect(runs.map((run) => [run.source, run.ok])).toEqual([["ndbc", true], ["marine_ie", false], ["aodn", true]]);
    expect(sumOk(runs, (value) => value.rowsSent)).toBe(7);
    expect(failedSources(runs)).toBe("marine_ie: HTTP 503");
    expect(failedSources(runs.filter((run) => run.ok))).toBeNull();
  });
});

describe("isLatestDue", () => {
  const at = (minute: number) => Date.parse(`2026-11-11T04:${String(minute).padStart(2, "0")}:00Z`);

  it("runs 15-minute sources every quarter, 30-minute ones at :00/:30 and hourly ones at :00", () => {
    // The cron fires at :04, :19, :34 and :49.
    expect([4, 19, 34, 49].map((m) => isLatestDue(adapter("ndbc", 15), at(m)))).toEqual([true, true, true, true]);
    expect([4, 19, 34, 49].map((m) => isLatestDue(adapter("aodn", 30), at(m)))).toEqual([true, false, true, false]);
    expect([4, 19, 34, 49].map((m) => isLatestDue(adapter("marine_ie", 60), at(m)))).toEqual([true, false, false, false]);
  });
});
