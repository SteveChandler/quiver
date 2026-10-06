// __tests__/lib/services/discovery/swell-tracking.test.ts
import {
  changeFor,
  confidenceFor,
  groupEvents,
} from "@/lib/services/discovery/swell-tracking";
import { beachSwellEvent } from "@/__tests__/helpers/swell-events";
import type { SwellEventSnapshot } from "@/lib/alerts/swell-events";

const NOW = new Date("2026-09-25T15:00:00.000Z");
const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "aaaaaaaa-0000-4000-8000-000000000002";

function at(days: number): string {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function snap(peakAt: string, heightFt: number, detectedAt: string): SwellEventSnapshot {
  return {
    beachId: A, eventKey: `${A}:W:2026-09-28`, detectorVersion: "v", runDate: detectedAt.slice(0, 10), detectedAt,
    directionDeg: 270, directionBand: "W", periodS: 14, peakOffshoreHeightFt: heightFt, peakFaceHeightFt: heightFt,
    exposure: 1, energyRatio: 5, arrivalAt: peakAt, peakAt, fadeAt: null,
    crossingDirectionDeg: null, crossingPeriodS: null, crossingOffshoreHeightFt: null,
  };
}

describe("groupEvents", () => {
  it("has no cap: five swells peaking two days apart are five groups", () => {
    const events = [0, 2, 4, 6, 8].map((days) =>
      beachSwellEvent({ beachId: A, eventKey: `${A}:W:${days}`, peakAt: at(days), directionDeg: 270, periodS: 14 }));
    expect(groupEvents(events)).toHaveLength(5);
  });

  it("merges one swell seen at two beaches", () => {
    const groups = groupEvents([
      beachSwellEvent({ beachId: A, eventKey: `${A}:W:1`, peakAt: at(3), directionDeg: 270, periodS: 14, peakEnergy: 100 }),
      beachSwellEvent({ beachId: B, eventKey: `${B}:W:1`, peakAt: at(3.5), directionDeg: 280, periodS: 15, peakEnergy: 80 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(2);
  });

  it("keeps two trains at one beach apart even when direction and timing agree", () => {
    const groups = groupEvents([
      beachSwellEvent({ beachId: A, eventKey: `${A}:W:1`, peakAt: at(3), directionDeg: 270, periodS: 14, peakEnergy: 100 }),
      beachSwellEvent({ beachId: A, eventKey: `${A}:W:2`, peakAt: at(3.2), directionDeg: 275, periodS: 15, peakEnergy: 90 }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("keeps trains more than 3 s apart in period apart (12 s vs 16 s)", () => {
    const groups = groupEvents([
      beachSwellEvent({ beachId: A, eventKey: `${A}:W:1`, peakAt: at(3), directionDeg: 270, periodS: 12, peakEnergy: 100 }),
      beachSwellEvent({ beachId: B, eventKey: `${B}:W:1`, peakAt: at(3.5), directionDeg: 285, periodS: 16, peakEnergy: 90 }),
    ]);
    expect(groups).toHaveLength(2);
  });
});

describe("confidenceFor", () => {
  it("is locked inside 36 h with a stable earlier run, likely without one", () => {
    const lead = beachSwellEvent({ peakAt: at(1), peakOffshoreHeightFt: 4 });
    const stable = snap(at(1.2), 4.2, at(-3));
    expect(confidenceFor(lead, [stable], NOW)).toBe("locked");
    expect(confidenceFor(lead, [], NOW)).toBe("likely");
  });

  it("is on the radar beyond 120 h", () => {
    expect(confidenceFor(beachSwellEvent({ peakAt: at(7) }), [snap(at(7), 4, at(-3))], NOW)).toBe("on_the_radar");
  });
});

describe("changeFor", () => {
  it("is null when no earlier run exists to prove newness", () => {
    expect(changeFor(beachSwellEvent({ peakAt: at(3) }), [], [], NOW, "America/Los_Angeles")).toBeNull();
  });

  it("reads a 25% rise as upgraded", () => {
    const lead = beachSwellEvent({ peakAt: at(3), peakOffshoreHeightFt: 5 });
    const change = changeFor(lead, [snap(at(3), 4, at(-3))], [], NOW, "America/Los_Angeles");
    expect(change?.kind).toBe("upgraded");
  });
});
