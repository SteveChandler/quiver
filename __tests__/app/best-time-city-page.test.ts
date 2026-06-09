/**
 * @jest-environment node
 */

import {
  buildBestTimeLiveHandoffSteps,
  generateMetadata,
} from "@/app/best-time-to-surf/[city]/page";
import { findCityBySlug } from "@/actions/city/city-metadata-actions";
import { readFileSync } from "fs";
import { join } from "path";

jest.mock("@/actions/city/city-metadata-actions", () => ({
  findCityBySlug: jest.fn(),
  getCityExcludeIntents: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/actions/city/best-time-actions", () => ({
  getBestTimeToSurfData: jest.fn(),
}));

describe("best-time city SEO page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("positions city metadata as a feeder into today's live surf report", async () => {
    (findCityBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        cityName: "San Diego",
        state: "CA",
        stateName: "California",
      },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ city: "san-diego" }),
    });

    expect(metadata.title).toContain("Best Time to Surf San Diego Today & This Week");
    expect(metadata.description).toContain("today and this week");
    expect(metadata.description).toContain("live surf report");
    expect(metadata.description).toContain("tides");
    expect(metadata.description).toContain("wind");
    expect(metadata.description).toContain("nearby spots");
  });

  it("builds live surf report handoff steps from the city's top spots", () => {
    const steps = buildBestTimeLiveHandoffSteps({
      cityName: "San Diego",
      citySlug: "san-diego",
      stateSlug: "ca",
      topBeaches: [
        {
          name: "Tourmaline Surf Park",
          slug: "tourmaline-surf-park",
          city: "San Diego",
          state: "CA",
          country: "USA",
        },
        {
          name: "La Jolla Shores",
          slug: "la-jolla-shores",
          city: "La Jolla",
          state: "CA",
          country: "USA",
        },
      ],
    });

    expect(steps).toEqual([
      {
        label: "Check today's Tourmaline Surf Park surf report",
        href: "/ca/san-diego/tourmaline-surf-park",
        description:
          "Start with the live wave height, wind, tide, and board call before committing.",
      },
      {
        label: "Find the best current San Diego window",
        href: "/ca/san-diego",
        description:
          "Compare the city's current forecast and spot list against the seasonal pattern.",
      },
      {
        label: "Compare nearby San Diego spots",
        href: "/map?search=San%20Diego",
        description:
          "Use the map to switch beaches when crowd, wind, or tide changes the call.",
      },
    ]);
  });

  it.each([
    {
      cityName: "La Jolla",
      citySlug: "la-jolla",
      stateSlug: "ca",
      spotName: "La Jolla Shores",
      spotSlug: "la-jolla-shores",
      spotHref: "/ca/la-jolla/la-jolla-shores",
      state: "CA",
    },
    {
      cityName: "Westport",
      citySlug: "westport",
      stateSlug: "wa",
      spotName: "Westport Jetty",
      spotSlug: "westport-jetty",
      spotHref: "/wa/westport/westport-jetty",
      state: "WA",
    },
    {
      cityName: "Cocoa Beach",
      citySlug: "cocoa-beach",
      stateSlug: "fl",
      spotName: "Cocoa Beach Pier",
      spotSlug: "cocoa-beach-pier",
      spotHref: "/fl/cocoa-beach/cocoa-beach-pier",
      state: "FL",
    },
  ])(
    "builds Phase 18 live-condition handoff steps for $cityName",
    ({ cityName, citySlug, stateSlug, spotName, spotSlug, spotHref, state }) => {
      const steps = buildBestTimeLiveHandoffSteps({
        cityName,
        citySlug,
        path: `/best-time-to-surf/${citySlug}`,
        stateSlug,
        topBeaches: [
          {
            name: spotName,
            slug: spotSlug,
            city: cityName,
            state,
            country: "USA",
          },
        ],
      });

      expect(steps).toEqual([
        {
          label: `Open live ${spotName} conditions`,
          href: spotHref,
          description:
            "Use the current wave height, wind, tide, and local call before applying the seasonal pattern.",
        },
        {
          label: `Check today's ${cityName} surf hub`,
          href: `/${stateSlug}/${citySlug}`,
          description:
            "Compare live spots in this city before picking the window that fits your plan.",
        },
        {
          label: "Scan the 7-day regional forecast",
          href: "/forecast",
          description:
            "Use the forecast hub to confirm whether this seasonal setup is building or fading.",
        },
      ]);
    }
  );

  it("keeps the best-time page source anchored to seasonal intent", () => {
    const source = readFileSync(
      join(process.cwd(), "app/best-time-to-surf/[city]/page.tsx"),
      "utf8"
    );

    expect(source).toContain("Best Time to Surf {cityName}");
    expect(source).toContain("Surf Score by Month");
    expect(source).toContain("Monthly Breakdown");
    expect(source).toContain("path: `/best-time-to-surf/${citySlug}`");
  });
});
