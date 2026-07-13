/**
 * @jest-environment node
 */

import {
  buildBestTimeLiveHandoffSteps,
  generateMetadata,
} from "@/app/best-time-to-surf/[city]/page";
import { findCityBySlug } from "@/actions/city/city-metadata-actions";
import { getCityEditorialContent } from "@/actions/city/city-editorial-actions";
import { readFileSync } from "fs";
import { join } from "path";

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

describe("best-time city SEO page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCityEditorialContent as jest.Mock).mockResolvedValue({
      seo_indexable: true,
      editorial_reviewed_at: "2026-07-13T00:00:00.000Z",
      editorial_sources: [{
        url: "https://www.noaa.gov/example",
        publisher: "NOAA",
        retrievedAt: "2026-07-13T00:00:00.000Z",
      }],
      intent: "best-time",
      description: ["Reviewed city guidance."],
      seo_intro: "Reviewed local introduction.",
      seo_local_guidance: "Reviewed seasonal guidance.",
    });
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

  it("noindexes a city without approved best-time editorial", async () => {
    (findCityBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: { cityName: "San Diego", state: "CA", stateName: "California" },
    });
    (getCityEditorialContent as jest.Mock).mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ city: "san-diego" }),
    });

    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it.each([
    {
      citySlug: "la-jolla",
      cityName: "La Jolla",
      title: "Best Time to Surf La Jolla: Shores, Scripps & Wind",
      descriptionNeedle: "Scripps Pier, Shores, Tourmaline",
    },
    {
      citySlug: "newport-beach",
      cityName: "Newport Beach",
      title: "Best Time to Surf Newport Beach: Season & Today",
      descriptionNeedle: "live Newport Beach surf report",
    },
    {
      citySlug: "malibu",
      cityName: "Malibu",
      title: "Best Time to Surf Malibu: Tide, Season & Crowd",
      descriptionNeedle: "live Malibu surf report",
    },
  ])(
    "uses scoped CTR metadata for $cityName without changing the generic template",
    async ({ citySlug, cityName, title, descriptionNeedle }) => {
      (findCityBySlug as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          cityName,
          state: "CA",
          stateName: "California",
        },
      });

      const metadata = await generateMetadata({
        params: Promise.resolve({ city: citySlug }),
      });

      expect(metadata.title).toContain(title);
      expect(metadata.description).toContain(descriptionNeedle);
    },
  );

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

  it("prefixes the La Jolla Phase 18 handoff with the Scripps surf-report owner", () => {
    const steps = buildBestTimeLiveHandoffSteps({
      cityName: "La Jolla",
      citySlug: "la-jolla",
      path: "/best-time-to-surf/la-jolla",
      stateSlug: "ca",
      topBeaches: [
        {
          name: "La Jolla Shores",
          slug: "la-jolla-shores",
          city: "La Jolla",
          state: "CA",
          country: "USA",
        },
      ],
    });

    expect(steps[0]).toEqual({
      label: "Open today's Scripps Pier surf report",
      href: "/surf-report/scripps-pier-today",
      description:
        "Use the spot-specific wave height, wind, tide, and backup notes before applying the La Jolla season guide.",
    });
    expect(steps[1]).toEqual({
      label: "Open live La Jolla Shores conditions",
      href: "/ca/la-jolla/la-jolla-shores",
      description:
        "Use the current wave height, wind, tide, and local call before applying the seasonal pattern.",
    });
  });

  it.each([
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

  it.each([
    {
      cityName: "Newport Beach",
      citySlug: "newport-beach",
      stateSlug: "ca",
      spotName: "Blackies",
      spotSlug: "blackies",
      state: "CA",
      ownerHref: "/surf-report/newport-beach-today",
      ownerLabel: "Open today's Newport Beach surf report",
    },
    {
      cityName: "Malibu",
      citySlug: "malibu",
      stateSlug: "ca",
      spotName: "Malibu First Point",
      spotSlug: "malibu-first-point-surfrider",
      state: "CA",
      ownerHref: "/surf-report/malibu-today",
      ownerLabel: "Open today's Malibu surf report",
    },
  ])(
    "prefixes $cityName best-time handoff with its surf-report owner",
    ({
      cityName,
      citySlug,
      stateSlug,
      spotName,
      spotSlug,
      state,
      ownerHref,
      ownerLabel,
    }) => {
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

      expect(steps[0]).toMatchObject({
        label: ownerLabel,
        href: ownerHref,
      });
      expect(steps.map((step) => step.href)).toContain(
        `/${stateSlug}/${citySlug}/${spotSlug}`,
      );
    },
  );

  it("keeps the best-time page source anchored to seasonal intent", () => {
    const source = readFileSync(
      join(process.cwd(), "app/best-time-to-surf/[city]/page.tsx"),
      "utf8"
    );

    expect(source).toContain("Best Time to Surf ${cityName} Today");
    expect(source).toContain("Surf Score by Month");
    expect(source).toContain("Monthly Breakdown");
    expect(source).toContain("path: `/best-time-to-surf/${citySlug}`");
  });
});
