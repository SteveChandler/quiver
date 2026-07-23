/**
 * @jest-environment node
 */

import { readFileSync } from "fs";
import { join } from "path";

import {
  buildBestTimeLiveHandoffSteps,
  buildBestTimeTodayAnswerCopy,
  generateMetadata,
} from "@/app/best-time-to-surf/[city]/page";
import { getCityEditorialContent } from "@/actions/city/city-editorial-actions";
import { findCityBySlug } from "@/actions/city/city-metadata-actions";

jest.mock("@/actions/city/city-metadata-actions", () => ({
  findCityBySlug: jest.fn(),
  getCityExcludeIntents: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/actions/city/best-time-actions", () => ({
  getBestTimeToSurfData: jest.fn(),
}));

jest.mock("@/actions/city/city-editorial-actions", () => ({
  getCityEditorialContent: jest.fn(),
}));

describe("best-time Santa Cruz CTR treatment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (findCityBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        cityName: "Santa Cruz",
        state: "CA",
        stateName: "California",
      },
    });
    (getCityEditorialContent as jest.Mock).mockResolvedValue({
      seo_indexable: true,
      editorial_reviewed_at: "2026-07-13T00:00:00.000Z",
      editorial_sources: [
        {
          url: "https://www.noaa.gov/example",
          publisher: "NOAA",
          retrievedAt: "2026-07-13T00:00:00.000Z",
        },
      ],
      intent: "best-time",
      description: ["Reviewed Santa Cruz guidance."],
      seo_intro: "Reviewed local introduction.",
      seo_local_guidance: "Reviewed seasonal guidance.",
    });
  });

  it("serves Santa Cruz-specific metadata, H1, and hero copy", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ city: "santa-cruz" }),
    });

    expect(metadata.title).toContain(
      "Best Time to Surf Santa Cruz: Wind, Tide & Season",
    );
    expect(metadata.description).toContain("Steamer Lane");
    expect(metadata.description).toContain("Cowell's and Capitola");
    expect(metadata.description).toContain("water temperature");

    const source = readFileSync(
      join(process.cwd(), "app/best-time-to-surf/[city]/page.tsx"),
      "utf8",
    );

    expect(source).toContain('h1: "Best Time to Surf Santa Cruz Today"');
    expect(source).toContain(
      'heroDek:\n      "Steamer Lane, Cowell\'s and Capitola windows, wind, tide, cold water, and season"',
    );
  });

  it("opens with local spot, wind, tide, water, and seasonal judgment", () => {
    const copy = buildBestTimeTodayAnswerCopy({
      citySlug: "santa-cruz",
      cityName: "Santa Cruz",
      currentMonthName: "July",
      currentMonthScore: 58,
      currentBestMonthCount: 2,
      totalBeaches: 8,
      peakMonthName: "November",
      waveHeightRange: "2-4 ft",
      waterTempF: 57,
    });

    expect(copy.todayAnswer).toContain("Steamer Lane");
    expect(copy.todayAnswer).toContain("Cowell's");
    expect(copy.todayAnswer).toContain("Capitola");
    expect(copy.todayAnswer).toContain("wind");
    expect(copy.todayAnswer).toContain("tide");
    expect(copy.todayAnswer).toContain("57°F water");
    expect(copy.thisWeekAnswer).toContain("fall and winter NW swell");
    expect(copy.surfReportCue).toContain("water temperature");
  });

  it("hands live conditions to the canonical Steamer Lane route", () => {
    const steps = buildBestTimeLiveHandoffSteps({
      cityName: "Santa Cruz",
      citySlug: "santa-cruz",
      path: "/best-time-to-surf/santa-cruz",
      stateSlug: "ca",
      topBeaches: [
        {
          name: "Steamer Lane",
          slug: "steamer-lane-santa-cruz-ca",
          city: "Santa Cruz",
          state: "CA",
          country: "USA",
        },
      ],
    });

    expect(steps[0]).toEqual({
      label: "Open live Steamer Lane conditions",
      href: "/ca/santa-cruz/steamer-lane-santa-cruz-ca",
      description:
        "Check Steamer Lane's live wave height, wind, tide, and swell before applying the Santa Cruz season guide.",
    });
    expect(steps.map((step) => step.href)).toContain("/ca/santa-cruz");
  });
});
