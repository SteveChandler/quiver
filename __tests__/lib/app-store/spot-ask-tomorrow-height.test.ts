import type { ForecastRecommendationContext } from "@/lib/services/forecast-recommendation-context";
import {
  selectSpotAskTomorrowHeight,
  upperBoundFt,
} from "@/lib/app-store/spot-ask-tomorrow-height";

const NOW = new Date("2026-11-27T20:00:00Z");

// Shaped like a real Blacks Beach hero context (hourly_forecast row, CDIP-fed).
function context(overrides: Partial<ForecastRecommendationContext>): ForecastRecommendationContext {
  return {
    beachId: "b1",
    localDate: "2026-11-27",
    recommendationType: "best_window",
    contextType: "best_window",
    startTime: null,
    endTime: null,
    selectedWindowStart: null,
    selectedWindowEnd: null,
    displayTimeLabel: "Best window: 7-9 AM",
    selectedRowTime: "2026-11-27T15:00:00Z",
    waveHeight: "5.4",
    waveHeightFt: 5.4,
    waveHeightRangeLabel: "5-6 ft",
    swellPeriod: "14s",
    periodSec: 14,
    swellDirection: "W",
    windSpeed: "5",
    windDirection: "E",
    score: 70,
    confidence: 0.8,
    primaryDataSource: "OPEN_METEO",
    sourceDataUpdatedAt: "2026-11-27T18:00:00Z",
    resolverUsed: "surf-call",
    source: "looking_ahead",
    timezone: "America/Los_Angeles",
    ...overrides,
  };
}

const today = context({});
const tomorrowContext = context({
  localDate: "2026-11-28",
  waveHeight: "6.4",
  waveHeightFt: 6.4,
  waveHeightRangeLabel: "6-7 ft",
});

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("selectSpotAskTomorrowHeight", () => {
  it("returns tomorrow's hero-format label when it is bigger and the day card agrees", () => {
    expect(
      selectSpotAskTomorrowHeight({
        today,
        heroIsTomorrow: false,
        tomorrow: { context: tomorrowContext, tableLabel: "5-7ft" },
        now: NOW,
      }),
    ).toBe("6-7 ft");
  });

  it.each([
    ["tomorrow is the same size", { waveHeightRangeLabel: "5-6 ft" }],
    ["tomorrow is smaller", { waveHeightRangeLabel: "3-4 ft" }],
    ["tomorrow has no label", { waveHeightRangeLabel: null }],
    ["tomorrow is not the next day", { localDate: "2026-11-29" }],
    ["tomorrow is stale", { sourceDataUpdatedAt: "2026-11-25T00:00:00Z" }],
    ["tomorrow has no timestamp", { sourceDataUpdatedAt: null }],
    ["tomorrow's timestamp is in the future", { sourceDataUpdatedAt: "2026-11-28T20:00:00Z" }],
  ])("falls back to A when %s", (_case, overrides) => {
    expect(
      selectSpotAskTomorrowHeight({
        today,
        heroIsTomorrow: false,
        tomorrow: { context: { ...tomorrowContext, ...overrides }, tableLabel: "5-7ft" },
        now: NOW,
      }),
    ).toBeNull();
  });

  it.each([
    ["today is stale", { sourceDataUpdatedAt: "2026-11-25T00:00:00Z" }],
    ["today has no label", { waveHeightRangeLabel: null }],
  ])("falls back to A when %s", (_case, overrides) => {
    expect(
      selectSpotAskTomorrowHeight({
        today: { ...today, ...overrides },
        heroIsTomorrow: false,
        tomorrow: { context: tomorrowContext, tableLabel: "5-7ft" },
        now: NOW,
      }),
    ).toBeNull();
  });

  it.each([
    ["the day card disagrees", "5-8ft"],
    ["the day card is missing", null],
    ["the day card is flat", "Flat"],
  ])("falls back to A when %s, so the ask never contradicts the page", (_case, tableLabel) => {
    expect(
      selectSpotAskTomorrowHeight({
        today,
        heroIsTomorrow: false,
        tomorrow: { context: tomorrowContext, tableLabel },
        now: NOW,
      }),
    ).toBeNull();
  });

  it("falls back to A when the hero already shows tomorrow, or there is no data", () => {
    const tomorrow = { context: tomorrowContext, tableLabel: "5-7ft" };
    expect(selectSpotAskTomorrowHeight({ today, heroIsTomorrow: true, tomorrow, now: NOW })).toBeNull();
    expect(selectSpotAskTomorrowHeight({ today: null, heroIsTomorrow: false, tomorrow, now: NOW })).toBeNull();
    expect(selectSpotAskTomorrowHeight({ today, heroIsTomorrow: false, tomorrow: null, now: NOW })).toBeNull();
    expect(
      selectSpotAskTomorrowHeight({ today, heroIsTomorrow: false, tomorrow: { context: null, tableLabel: "5-7ft" }, now: NOW }),
    ).toBeNull();
  });
});

describe("upperBoundFt", () => {
  it.each([
    ["5-6 ft", 6],
    ["6-7ft", 7],
    ["0-1 ft", 1],
    ["Flat", null],
    ["—", null],
    [null, null],
  ])("reads %p as %p", (label, expected) => {
    expect(upperBoundFt(label)).toBe(expected);
  });
});
