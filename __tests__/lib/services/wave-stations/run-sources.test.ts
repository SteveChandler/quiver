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

  it.each(["TimeoutError", "AbortError"])("keeps a %s in the outcome as a warning", async (name) => {
    const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const runs = await runPerSource([adapter("aodn"), adapter("ndbc")], async (one) => {
        if (one.source === "aodn") throw new DOMException("The operation was aborted due to timeout", name);
        return { rowsSent: 5 };
      });

      expect(runs[0]).toEqual({ source: "aodn", ok: false, error: "The operation was aborted due to timeout", timedOut: true });
      expect(failedSources(runs)).toBeNull();
      expect(warning).toHaveBeenCalledWith("[WaveStations] aodn timed out:", "The operation was aborted due to timeout");
      expect(error).not.toHaveBeenCalled();
    } finally {
      warning.mockRestore();
      error.mockRestore();
    }
  });

  it("keeps an unrelated error with timeout text as a failure", async () => {
    const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const runs = await runPerSource([adapter("aodn")], async () => {
        throw new Error("timeout configuration is invalid");
      });

      expect(runs[0]).toEqual({ source: "aodn", ok: false, error: "timeout configuration is invalid" });
      expect(failedSources(runs)).toBe("aodn: timeout configuration is invalid");
      expect(error).toHaveBeenCalledWith("[WaveStations] aodn failed:", "timeout configuration is invalid");
      expect(warning).not.toHaveBeenCalled();
    } finally {
      warning.mockRestore();
      error.mockRestore();
    }
  });

  it("still fails a run with a non-timeout source error beside a timeout", async () => {
    const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const runs = await runPerSource([adapter("aodn"), adapter("marine_ie")], async (one) => {
        if (one.source === "aodn") throw new DOMException("deadline elapsed", "TimeoutError");
        throw new Error("HTTP 503");
      });

      expect(failedSources(runs)).toBe("marine_ie: HTTP 503");
      expect(warning).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledTimes(1);
    } finally {
      warning.mockRestore();
      error.mockRestore();
    }
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
