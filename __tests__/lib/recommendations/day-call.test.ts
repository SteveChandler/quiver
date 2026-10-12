import { selectDayCall } from "@/lib/recommendations/day-call";
import type {
  WeekScoutDayResponse,
  WeekScoutWindowResponse,
} from "@/lib/services/discovery/week-scout";

const now = new Date("2026-10-11T10:00:00-07:00");

function windowFixture(
  overrides: Partial<WeekScoutWindowResponse> = {},
): WeekScoutWindowResponse {
  return {
    id: "nominated",
    beachId: "pacific-beach",
    start: "2026-10-11T09:00:00-07:00",
    end: "2026-10-11T12:00:00-07:00",
    displayWindowStart: "2026-10-11T09:00:00-07:00",
    displayWindowEnd: "2026-10-11T12:00:00-07:00",
    conditionScore: 80,
    ...overrides,
  } as WeekScoutWindowResponse;
}

function dayFixture(
  windows: WeekScoutWindowResponse[],
  bestWindowId: string | null = "nominated",
): WeekScoutDayResponse {
  return {
    localDate: "2026-10-11",
    windows,
    bestWindowId,
    bestDayWindow: null,
    exclusionReasons: [],
  };
}

describe("selectDayCall", () => {
  it("returns the open nominated window even when another scores higher", () => {
    const nominated = windowFixture();
    const higher = windowFixture({ id: "higher", conditionScore: 95 });
    expect(selectDayCall(dayFixture([higher, nominated]), now, { closeBufferMs: 0 }))
      .toBe(nominated);
  });

  it("falls back to the highest score when the nominated window has closed", () => {
    const nominated = windowFixture({ displayWindowEnd: "2026-10-11T09:30:00-07:00" });
    const lower = windowFixture({ id: "lower", conditionScore: 70 });
    const higher = windowFixture({ id: "higher", conditionScore: 90 });
    expect(selectDayCall(dayFixture([nominated, lower, higher]), now, { closeBufferMs: 0 }))
      .toBe(higher);
  });

  it("falls back when the nominated window closes inside the buffer", () => {
    const nominated = windowFixture({ displayWindowEnd: "2026-10-11T10:20:00-07:00" });
    const fallback = windowFixture({ id: "fallback", conditionScore: 70 });
    expect(selectDayCall(dayFixture([nominated, fallback]), now, { closeBufferMs: 30 * 60_000 }))
      .toBe(fallback);
  });

  it("keeps a window with exactly the required buffer remaining", () => {
    const nominated = windowFixture({ displayWindowEnd: "2026-10-11T10:30:00-07:00" });
    expect(selectDayCall(dayFixture([nominated]), now, { closeBufferMs: 30 * 60_000 }))
      .toBe(nominated);
  });

  it("closes a window ending exactly now with a zero buffer", () => {
    const nominated = windowFixture({ displayWindowEnd: "2026-10-11T10:00:00-07:00" });
    expect(selectDayCall(dayFixture([nominated]), now, { closeBufferMs: 0 })).toBeNull();
  });

  it("breaks score ties by earlier canonical start, then lower id", () => {
    const later = windowFixture({
      id: "a-later",
      start: "2026-10-11T08:00:00-07:00",
      displayWindowStart: "2026-10-11T11:00:00-07:00",
    });
    const earlier = windowFixture({
      id: "z-earlier",
      start: "2026-10-11T10:00:00-07:00",
    });
    expect(selectDayCall(dayFixture([later, earlier], "missing"), now, { closeBufferMs: 0 }))
      .toBe(earlier);

    const lowerId = windowFixture({ id: "a-earlier" });
    expect(selectDayCall(dayFixture([later, earlier, lowerId], "missing"), now, { closeBufferMs: 0 }))
      .toBe(lowerId);
  });

  it("stays open when the raw end has passed but the display end is ahead", () => {
    const nominated = windowFixture({ end: "2026-10-11T09:30:00-07:00" });
    expect(selectDayCall(dayFixture([nominated]), now, { closeBufferMs: 0 })).toBe(nominated);
  });

  it("closes when the display end has passed even if the raw end is ahead", () => {
    const nominated = windowFixture({ displayWindowEnd: "2026-10-11T09:30:00-07:00" });
    expect(selectDayCall(dayFixture([nominated]), now, { closeBufferMs: 0 })).toBeNull();
  });

  it.each([
    ["unparseable start", "invalid", "2026-10-11T09:30:00-07:00"],
    ["unparseable end", "2026-10-11T09:00:00-07:00", "invalid"],
    ["reversed pair", "2026-10-11T09:30:00-07:00", "2026-10-11T09:00:00-07:00"],
    ["equal pair", "2026-10-11T09:00:00-07:00", "2026-10-11T09:00:00-07:00"],
  ])("uses raw bounds for an invalid display pair: %s", (_label, displayWindowStart, displayWindowEnd) => {
    const rawEarlier = windowFixture({ id: "z-raw-earlier", displayWindowStart, displayWindowEnd });
    const later = windowFixture({
      id: "a-later",
      displayWindowStart: "2026-10-11T10:00:00-07:00",
    });
    expect(selectDayCall(dayFixture([rawEarlier]), now, { closeBufferMs: 0 })).toBe(rawEarlier);
    expect(selectDayCall(dayFixture([later, rawEarlier], "missing"), now, { closeBufferMs: 0 }))
      .toBe(rawEarlier);
  });

  it("returns null when no windows exist", () => {
    expect(selectDayCall(dayFixture([]), now, { closeBufferMs: 0 })).toBeNull();
  });

  it("returns null for a null nomination even with open windows", () => {
    expect(selectDayCall(dayFixture([windowFixture()], null), now, { closeBufferMs: 0 })).toBeNull();
  });

  it("returns null when every window is closed", () => {
    const nominated = windowFixture({ displayWindowEnd: "2026-10-11T09:30:00-07:00" });
    const other = windowFixture({ id: "other", displayWindowEnd: "2026-10-11T09:45:00-07:00" });
    expect(selectDayCall(dayFixture([nominated, other]), now, { closeBufferMs: 0 })).toBeNull();
  });
});

// Mirrored in quiver-native src/__tests__/day-call-parity.test.ts; change both together.
describe("parity fixtures shared with quiver-native", () => {
  const now = new Date("2026-10-11T10:00:00-07:00");

  it("day A: picks the open nominated window", () => {
    const day = {
      localDate: "2026-10-11",
      bestWindowId: "a-pacific-morning",
      windows: [
        {
          beachId: "pacific-beach",
          id: "a-pacific-morning",
          start: "2026-10-11T08:00:00-07:00",
          end: "2026-10-11T09:30:00-07:00",
          displayWindowStart: "2026-10-11T09:00:00-07:00",
          displayWindowEnd: "2026-10-11T11:00:00-07:00",
          conditionScore: 80,
        },
        {
          beachId: "scripps",
          id: "a-scripps-midday",
          start: "2026-10-11T11:00:00-07:00",
          end: "2026-10-11T14:00:00-07:00",
          displayWindowStart: "2026-10-11T11:15:00-07:00",
          displayWindowEnd: "2026-10-11T13:45:00-07:00",
          conditionScore: 92,
        },
      ],
    } as WeekScoutDayResponse;
    const picked = selectDayCall(day, now, { closeBufferMs: 0 });
    expect(picked && { beachId: picked.beachId, id: picked.id }).toEqual({
      beachId: "pacific-beach",
      id: "a-pacific-morning",
    });
  });

  it("day B: falls back after the nominated display end", () => {
    const day = {
      localDate: "2026-10-11",
      bestWindowId: "b-pacific-morning",
      windows: [
        {
          beachId: "pacific-beach",
          id: "b-pacific-morning",
          start: "2026-10-11T08:00:00-07:00",
          end: "2026-10-11T12:00:00-07:00",
          displayWindowStart: "2026-10-11T08:15:00-07:00",
          displayWindowEnd: "2026-10-11T09:30:00-07:00",
          conditionScore: 95,
        },
        {
          beachId: "ocean-beach",
          id: "b-ocean-midday",
          start: "2026-10-11T10:00:00-07:00",
          end: "2026-10-11T13:00:00-07:00",
          displayWindowStart: "2026-10-11T10:15:00-07:00",
          displayWindowEnd: "2026-10-11T12:45:00-07:00",
          conditionScore: 72,
        },
        {
          beachId: "scripps",
          id: "b-scripps-midday",
          start: "2026-10-11T11:00:00-07:00",
          end: "2026-10-11T14:00:00-07:00",
          displayWindowStart: "2026-10-11T11:15:00-07:00",
          displayWindowEnd: "2026-10-11T13:45:00-07:00",
          conditionScore: 88,
        },
      ],
    } as WeekScoutDayResponse;
    const picked = selectDayCall(day, now, { closeBufferMs: 0 });
    expect(picked && { beachId: picked.beachId, id: picked.id }).toEqual({
      beachId: "scripps",
      id: "b-scripps-midday",
    });
  });

  it("day C: returns null when every display window has closed", () => {
    const day = {
      localDate: "2026-10-11",
      bestWindowId: "c-pacific-morning",
      windows: [
        {
          beachId: "pacific-beach",
          id: "c-pacific-morning",
          start: "2026-10-11T07:00:00-07:00",
          end: "2026-10-11T11:00:00-07:00",
          displayWindowStart: "2026-10-11T07:15:00-07:00",
          displayWindowEnd: "2026-10-11T09:30:00-07:00",
          conditionScore: 90,
        },
        {
          beachId: "scripps",
          id: "c-scripps-morning",
          start: "2026-10-11T08:00:00-07:00",
          end: "2026-10-11T12:00:00-07:00",
          displayWindowStart: "2026-10-11T08:15:00-07:00",
          displayWindowEnd: "2026-10-11T10:00:00-07:00",
          conditionScore: 85,
        },
      ],
    } as WeekScoutDayResponse;
    expect(selectDayCall(day, now, { closeBufferMs: 0 })).toBeNull();
  });
});
