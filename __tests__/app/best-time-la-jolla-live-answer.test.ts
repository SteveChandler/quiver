import { buildBestTimeTodayAnswerCopy } from "@/app/best-time-to-surf/[city]/page";

describe("best-time La Jolla live answer copy", () => {
  it("frames the page around today's and this week's surf-report intent", () => {
    const copy = buildBestTimeTodayAnswerCopy({
      citySlug: "la-jolla",
      cityName: "La Jolla",
      currentMonthName: "June",
      currentMonthScore: 72,
      currentBestMonthCount: 3,
      totalBeaches: 7,
      peakMonthName: "October",
      waveHeightRange: "2-4 ft",
      waterTempF: 66,
    });

    expect(copy).toMatchObject({
      eyebrow: "Live surf planning",
      heading: "Best time to surf La Jolla today",
      weekHeading: "Best time to surf La Jolla this week",
      thisWeekAnswer: expect.stringContaining("June"),
      surfReportCue: expect.stringContaining("surf report"),
    });
    expect(copy.todayAnswer).toContain("La Jolla");
    expect(copy.todayAnswer).toMatch(
      /^La Jolla's best surf window today starts with the live report:/,
    );
    expect(copy.todayAnswer).toContain("Scripps Pier");
    expect(copy.todayAnswer).toContain("2-4 ft");
    expect(copy.surfReportCue).toBe(
      "Open the La Jolla surf report first for the city-level call, then compare Scripps Pier or Tourmaline as secondary spot reads before using this seasonal guide.",
    );
  });

  it("uses forecast-summary data for today's direct answer when available", () => {
    const copy = buildBestTimeTodayAnswerCopy({
      citySlug: "la-jolla",
      cityName: "La Jolla",
      currentMonthName: "June",
      currentMonthScore: 72,
      currentBestMonthCount: 3,
      totalBeaches: 7,
      peakMonthName: "October",
      forecastSummary: {
        bestWindow: {
          start: "6:00 AM",
          end: "9:00 AM",
          reason: "incoming tide, light winds",
        },
        topPicks: [
          {
            beachId: "11111111-1111-4111-8111-111111111111",
            name: "La Jolla Shores",
            slug: "la-jolla-shores",
            waveHeight: "2-3 ft",
            windDirection: "light W",
            score: 82,
          },
        ],
        conditions: {
          tide: "Rising",
          wind: "light W",
          swell: "2-3 ft",
        },
        isTomorrow: false,
        recommendationAvailability: {
          state: "available",
          holdEpoch: "test-epoch",
        },
      },
    });

    expect(copy.todayAnswer).toMatch(
      /^La Jolla's best surf window today is 6:00 AM-9:00 AM; incoming tide, light winds\./,
    );
    expect(copy.todayAnswer).not.toContain("rising tide");
    expect(copy.todayAnswer).toContain("La Jolla Shores");
    expect(copy.todayAnswer).toContain("2-3 ft");
    expect(copy.surfReportCue).toBe(
      "Open the La Jolla surf report first for the city-level call, then compare Scripps Pier or Tourmaline as secondary spot reads before using this seasonal guide.",
    );
  });

  it("describes the window with the window's conditions and labels current conditions as now", () => {
    const copy = buildBestTimeTodayAnswerCopy({
      citySlug: "cocoa-beach",
      cityName: "Cocoa Beach",
      currentMonthName: "September",
      currentMonthScore: 55,
      currentBestMonthCount: 1,
      totalBeaches: 1,
      peakMonthName: "October",
      weekAnswerOverride: "September scores 55/100 on the Cape Canaveral Nearshore buoy record.",
      forecastSummary: {
        bestWindow: {
          start: "2:30 PM",
          end: "3:30 PM",
          reason: "tide in range, good swell angle",
          conditions: { tide: "Rising", wind: "12 mph", swell: "1.4 ft" },
        },
        topPicks: [],
        conditions: { tide: "Falling", wind: "20 mph", swell: "1.2 ft" },
        isTomorrow: false,
        recommendationAvailability: { state: "available", holdEpoch: "test-epoch" },
      },
    });

    expect(copy.todayAnswer).toBe(
      "Cocoa Beach's best surf window today is 2:30 PM-3:30 PM, with rising tide, 12 mph wind, and 1.4 ft swell; tide in range, good swell angle. Check the live report before you drive.",
    );
    expect(copy.surfReportCue).toBe(
      "Now: falling tide, 20 mph wind, and 1.2 ft swell. Confirm them in the live surf report first.",
    );
    expect(copy.thisWeekAnswer).toBe(
      "September scores 55/100 on the Cape Canaveral Nearshore buoy record.",
    );
  });
});
