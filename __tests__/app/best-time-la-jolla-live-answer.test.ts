import { buildBestTimeTodayAnswerCopy } from "@/app/best-time-to-surf/[city]/page";

describe("best-time La Jolla live answer copy", () => {
  it("frames the page around today's and this week's surf-report intent", () => {
    const copy = buildBestTimeTodayAnswerCopy({
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
    expect(copy.todayAnswer).toContain("2-4 ft");
  });

  it("uses forecast-summary data for today's direct answer when available", () => {
    const copy = buildBestTimeTodayAnswerCopy({
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
      },
    });

    expect(copy.todayAnswer).toContain("6:00 AM-9:00 AM");
    expect(copy.todayAnswer).toContain("incoming tide, light winds");
    expect(copy.todayAnswer).toContain("La Jolla Shores");
    expect(copy.todayAnswer).toContain("2-3 ft");
    expect(copy.surfReportCue).toContain("Rising tide");
    expect(copy.surfReportCue).toContain("light W wind");
  });
});
