import { describe, expect, it } from "@jest/globals";

import workerFixture from "./fixtures/python-worker-artifact.json";
import { briefingForReader, canonicalInstant, freshnessFor } from "../swell-briefing-serve";
import type { SwellBriefing } from "../swell-briefing-types";

describe("canonicalInstant", () => {
  it("rewrites the worker's isoformat into toISOString form", () => {
    // Exactly what worker.run() stamps: six fractional digits, +00:00.
    expect(canonicalInstant("2026-10-26T12:31:07.123456+00:00")).toBe("2026-10-26T12:31:07.123Z");
  });

  it("converts an offset to UTC rather than dropping it", () => {
    expect(canonicalInstant("2026-10-26T05:31:07-07:00")).toBe("2026-10-26T12:31:07.000Z");
  });

  it("leaves an already-canonical instant unchanged", () => {
    expect(canonicalInstant("2026-10-26T12:00:00.000Z")).toBe("2026-10-26T12:00:00.000Z");
  });

  it("passes an unreadable value through for the client to reject", () => {
    expect(canonicalInstant("not a time")).toBe("not a time");
  });
});

describe("briefingForReader", () => {
  const stored = (workerFixture as unknown as { artifact: { briefing: SwellBriefing } }).artifact.briefing;

  it("serves canonical instants without touching the stored briefing", () => {
    const served = briefingForReader(stored, new Date("2026-10-26T12:32:00.000Z"));
    expect(served.generatedAt).toBe("2026-10-26T12:31:07.123Z");
    expect(served.dataAt).toBe("2026-10-26T11:50:00.000Z");
    // The readback route returns the stored copy; it must not have been mutated.
    expect(stored.generatedAt).toBe("2026-10-26T12:31:07.123456+00:00");
  });

  it("recomputes freshness from the data time, never the generation time", () => {
    const later = new Date("2026-10-28T12:00:00.000Z");
    expect(briefingForReader(stored, later).freshness).toBe(freshnessFor(stored.dataAt, later));
    expect(briefingForReader(stored, later).freshness).toBe("stale");
  });

  it("changes nothing a reader measures", () => {
    const served = briefingForReader(stored, new Date("2026-10-26T12:32:00.000Z"));
    expect(served.today).toEqual(stored.today);
    expect(served.next48).toEqual(stored.next48);
    expect(served.week).toEqual(stored.week);
  });
});
