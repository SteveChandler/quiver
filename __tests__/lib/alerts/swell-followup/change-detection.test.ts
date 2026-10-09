/**
 * @jest-environment node
 */

import {
  SWELL_FOLLOWUP_THRESHOLDS,
  detectSwellFollowupKind,
  isSwellFollowupExpired,
  isSwellFollowupWindowOpen,
  swellMoveDirection,
  type SwellCurrentForecast,
  type SwellToldSnapshot,
} from "@/lib/alerts/swell-followup/change-detection";

const TIMEZONE = "America/Los_Angeles";
/** Thursday 2026-09-24, 10:00 PDT. */
const NOW = new Date("2026-09-24T17:00:00.000Z");
/** Saturday 2026-09-26, 09:00 PDT. */
const TOLD_PEAK = "2026-09-26T16:00:00.000Z";

function told(overrides: Partial<SwellToldSnapshot> = {}): SwellToldSnapshot {
  return {
    peakAt: TOLD_PEAK,
    faceHeightFt: 5,
    toldKinds: ["coming"],
    lastFollowupAt: null,
    status: "active",
    ...overrides,
  };
}

function current(overrides: Partial<SwellCurrentForecast> = {}): SwellCurrentForecast {
  return { peakAt: TOLD_PEAK, faceHeightFt: 5, exposure: 1, ...overrides };
}

function detect(args: {
  told?: Partial<SwellToldSnapshot>;
  current?: Partial<SwellCurrentForecast> | null;
  now?: Date;
  previous?: { event: SwellCurrentForecast | null } | null;
}) {
  return detectSwellFollowupKind({
    told: told(args.told),
    current: args.current === null ? null : current(args.current ?? {}),
    now: args.now ?? NOW,
    timezone: TIMEZONE,
    previous: args.previous ?? null,
  });
}

describe("swell follow-up thresholds", () => {
  it("names the contract thresholds", () => {
    expect(SWELL_FOLLOWUP_THRESHOLDS).toMatchObject({
      confirmLeadHours: 48,
      movedMinHours: 12,
      sizeMinDeltaFt: 1.5,
      sizeMinDeltaRatio: 0.3,
      minHoursBetweenFollowups: 24,
    });
  });
});

describe("detectSwellFollowupKind", () => {
  it("returns null when nothing changed materially", () => {
    expect(detect({})).toBeNull();
    expect(detect({ current: { faceHeightFt: 6, peakAt: "2026-09-26T22:00:00.000Z" } })).toBeNull();
  });

  it("reports moved when the peak shifts by at least 12 hours", () => {
    expect(detect({ current: { peakAt: "2026-09-27T03:59:00.000Z" } })).toBeNull();
    expect(detect({ current: { peakAt: "2026-09-27T04:00:00.000Z" } })).toBe("moved");
    expect(detect({ current: { peakAt: "2026-09-26T04:00:00.000Z" } })).toBe("moved");
  });

  it("reports bigger on 1.5 ft or 30 percent growth", () => {
    expect(detect({ current: { faceHeightFt: 6.5 } })).toBe("bigger");
    // 30 percent of 3 ft is under 1.5 ft but still material.
    expect(detect({ told: { faceHeightFt: 3 }, current: { faceHeightFt: 3.9 } })).toBe("bigger");
    expect(detect({ told: { faceHeightFt: 3 }, current: { faceHeightFt: 3.8 } })).toBeNull();
  });

  it("reports smaller on 1.5 ft or 30 percent loss", () => {
    expect(detect({ current: { faceHeightFt: 3.5 } })).toBe("smaller");
    expect(detect({ told: { faceHeightFt: 10 }, current: { faceHeightFt: 8.5 } })).toBe("smaller");
    expect(detect({ told: { faceHeightFt: 10 }, current: { faceHeightFt: 8.6 } })).toBeNull();
  });

  it("reports dropped when the event is no longer detected at the beach", () => {
    expect(detect({ current: null })).toBe("dropped");
  });

  it("reports dropped when the direction swings out of the beach's swell window", () => {
    expect(detect({ current: { exposure: 0.24 } })).toBe("dropped");
    expect(detect({ current: { exposure: 0.25 } })).toBeNull();
  });

  it("does not call a swell dropped once its told peak has passed", () => {
    expect(detect({ current: null, now: new Date("2026-09-26T17:00:00.000Z") })).toBeNull();
  });

  it("reports arrived when the peak's local date is today", () => {
    expect(detect({ now: new Date("2026-09-26T14:00:00.000Z") })).toBe("arrived");
  });

  it("uses the local date, not the UTC date, for arrived", () => {
    // 2026-09-26T02:00Z is still Friday evening in Los Angeles.
    expect(detect({
      current: { peakAt: "2026-09-26T02:00:00.000Z" },
      told: { peakAt: "2026-09-26T02:00:00.000Z" },
      now: new Date("2026-09-25T17:00:00.000Z"),
    })).toBe("arrived");
  });

  it("says nothing about a peak whose local date is already behind", () => {
    expect(detect({
      current: { peakAt: "2026-09-23T17:00:00.000Z", faceHeightFt: 9 },
    })).toBeNull();
  });

  describe("priority: dropped, arrived, moved, bigger / smaller", () => {
    const peakDay = new Date("2026-09-26T14:00:00.000Z");

    it("prefers dropped over everything", () => {
      expect(detect({
        current: { exposure: 0, faceHeightFt: 9, peakAt: "2026-09-25T20:00:00.000Z" },
        now: new Date("2026-09-25T15:00:00.000Z"),
      })).toBe("dropped");
    });

    it("prefers arrived over moved and size changes", () => {
      expect(detect({
        told: { peakAt: "2026-09-27T16:00:00.000Z" },
        current: { peakAt: TOLD_PEAK, faceHeightFt: 9 },
        now: peakDay,
      })).toBe("arrived");
    });

    it("prefers moved over a size change", () => {
      expect(detect({
        current: { peakAt: "2026-09-27T16:00:00.000Z", faceHeightFt: 9 },
      })).toBe("moved");
    });
  });

  describe("independent-run confirmation at long lead", () => {
    const longPeak = "2026-09-28T16:00:00.000Z";
    const shifted = current({ peakAt: "2026-09-29T16:00:00.000Z" });

    it.each([
      ["moved", shifted],
      ["bigger", current({ peakAt: longPeak, faceHeightFt: 7 })],
      ["smaller", current({ peakAt: longPeak, faceHeightFt: 3 })],
      ["dropped", null],
    ] as const)("requires the previous run to also report %s", (kind, forecast) => {
      const input = { told: { peakAt: longPeak }, current: forecast };
      expect(detect({ ...input, previous: null })).toBeNull();
      expect(detect({ ...input, previous: { event: current({ peakAt: longPeak }) } })).toBeNull();
      expect(detect({ ...input, previous: { event: forecast } })).toBe(kind);
    });

    it("does not confirm a move with a previous size change", () => {
      expect(detect({ told: { peakAt: longPeak }, current: shifted,
        previous: { event: current({ peakAt: longPeak, faceHeightFt: 7 }) } })).toBeNull();
    });

    it("sends immediately at 30 hours and exactly 48 hours without a previous run", () => {
      for (const hours of [30, 48]) {
        const peakAt = new Date(NOW.getTime() + hours * 3_600_000).toISOString();
        expect(detect({ told: { peakAt }, current: shifted, previous: null })).toBe("moved");
        expect(detect({ told: { peakAt }, current: null, previous: null })).toBe("dropped");
      }
    });

    it("never gates arrived even when the told peak is far off", () => {
      expect(detect({ told: { peakAt: longPeak }, current: { peakAt: NOW.toISOString() },
        previous: null })).toBe("arrived");
    });
  });

  describe("caps", () => {
    it("sends each kind once per event, falling through to the next that applies", () => {
      const bothChanged = { peakAt: "2026-09-27T16:00:00.000Z", faceHeightFt: 9 };
      expect(detect({ told: { toldKinds: ["coming", "moved"] }, current: bothChanged })).toBe("bigger");
      expect(detect({ told: { toldKinds: ["coming", "moved", "bigger"] }, current: bothChanged })).toBeNull();
      expect(detect({ told: { toldKinds: ["coming", "smaller"] }, current: { faceHeightFt: 3 } })).toBeNull();
    });

    it("sends at most one follow-up per 24 hours", () => {
      const change = { faceHeightFt: 9 };
      expect(detect({ told: { lastFollowupAt: "2026-09-23T17:00:01.000Z" }, current: change })).toBeNull();
      expect(detect({ told: { lastFollowupAt: "2026-09-23T17:00:00.000Z" }, current: change })).toBe("bigger");
      // The first alert is not a follow-up, so it does not start the 24 h clock.
      expect(detect({ told: { lastFollowupAt: null }, current: change })).toBe("bigger");
    });

    it("holds even dropped and arrived inside the 24 hour spacing", () => {
      expect(detect({ told: { lastFollowupAt: "2026-09-24T00:00:00.000Z" }, current: null })).toBeNull();
    });

    it.each(["arrived", "dropped"] as const)("sends nothing after %s", (terminal) => {
      expect(detect({ told: { toldKinds: ["coming", terminal] }, current: { faceHeightFt: 9 } })).toBeNull();
      expect(detect({ told: { status: terminal }, current: { faceHeightFt: 9 } })).toBeNull();
    });

    it("sends nothing for a closed event", () => {
      expect(detect({ told: { status: "passed" }, current: null })).toBeNull();
    });

    it("only evaluates between 06:00 and 21:59 local", () => {
      const change = { faceHeightFt: 9 };
      expect(detect({ current: change, now: new Date("2026-09-24T12:59:00.000Z") })).toBeNull();
      expect(detect({ current: change, previous: { event: current(change) }, now: new Date("2026-09-24T13:00:00.000Z") })).toBe("bigger");
      expect(detect({ current: change, now: new Date("2026-09-25T04:59:00.000Z") })).toBe("bigger");
      expect(detect({ current: change, now: new Date("2026-09-25T05:00:00.000Z") })).toBeNull();
    });
  });
});

describe("follow-up window helpers", () => {
  it("expires an event a day after its told peak", () => {
    expect(isSwellFollowupExpired({ peakAt: TOLD_PEAK }, new Date("2026-09-27T16:00:00.000Z"))).toBe(false);
    expect(isSwellFollowupExpired({ peakAt: TOLD_PEAK }, new Date("2026-09-27T16:00:01.000Z"))).toBe(true);
  });

  it("closes the window without needing a forecast", () => {
    expect(isSwellFollowupWindowOpen(told(), NOW, TIMEZONE)).toBe(true);
    expect(isSwellFollowupWindowOpen(told({ status: "dropped" }), NOW, TIMEZONE)).toBe(false);
  });

  it("names which way the peak moved", () => {
    expect(swellMoveDirection(TOLD_PEAK, "2026-09-27T16:00:00.000Z")).toBe("later");
    expect(swellMoveDirection(TOLD_PEAK, "2026-09-25T16:00:00.000Z")).toBe("earlier");
  });
});
