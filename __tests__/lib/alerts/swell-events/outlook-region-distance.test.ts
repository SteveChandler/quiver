import { filterPulsesByRegionAgreement, type BeachSwellEvent, type PulseRegionCandidate } from "@/lib/alerts/swell-events";
import { calculateDistanceInMiles } from "@/lib/utils/distance-utils";
import { beachSwellEvent } from "@/__tests__/helpers/swell-events";

jest.mock("@/lib/utils/distance-utils", () => {
  const actual = jest.requireActual("@/lib/utils/distance-utils");
  return { ...actual, calculateDistanceInMiles: jest.fn(actual.calculateDistanceInMiles) };
});

function candidate(id: string, pulses: BeachSwellEvent[]): PulseRegionCandidate {
  return { beachId: id, lat: 32.7, lon: -117.25, pulses };
}

describe("regional agreement distance work", () => {
  beforeEach(() => jest.mocked(calculateDistanceInMiles).mockClear());

  it("never distance-checks candidates without pulses", () => {
    const kept = filterPulsesByRegionAgreement([
      candidate("one", [beachSwellEvent({ beachId: "one" })]),
      candidate("empty", []),
    ]);
    expect(kept.size).toBe(0);
    expect(calculateDistanceInMiles).not.toHaveBeenCalled();
  });

  it.each<Partial<BeachSwellEvent>>([
    { directionDeg: 180 }, { periodS: 21 }, { peakAt: "2026-10-01T15:00:00.000Z" },
  ])("checks swell tolerances before distance: %p", (overrides) => {
    const kept = filterPulsesByRegionAgreement([
      candidate("one", [beachSwellEvent({ beachId: "one" })]),
      candidate("different", [beachSwellEvent({ beachId: "different", ...overrides })]),
    ]);
    expect(kept.size).toBe(0);
    expect(calculateDistanceInMiles).not.toHaveBeenCalled();
  });
});
