/**
 * @jest-environment node
 */

import {
  buildBestTimeLiveHandoffSteps,
  buildBestTimeMetadataCopy,
  generateMetadata,
} from "@/app/best-time-to-surf/[city]/page";
import { findCityBySlug } from "@/actions/city/city-metadata-actions";
import { getCityEditorialContent } from "@/actions/city/city-editorial-actions";
import { getBestTimeToSurfData } from "@/actions/city/best-time-actions";
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
    (getBestTimeToSurfData as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        totalBeaches: 3,
        topBeaches: [{ bestMonths: [10, 11, 12] }],
      },
    });
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

    expect(metadata.title).toContain(
      "Best San Diego surf window today: tide & wind",
    );
    expect(metadata.description).toContain(
      "San Diego's best surf window today",
    );
    expect(metadata.description).toContain("tide");
    expect(metadata.description).toContain("wind");
    expect(metadata.description).toContain("live conditions");
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

    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });

  it("preserves an unreviewed, data-rich city with checked-in GSC protection", async () => {
    (findCityBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: { cityName: "La Jolla", state: "CA", stateName: "California" },
    });
    (getCityEditorialContent as jest.Mock).mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ city: "la-jolla" }),
    });

    expect((metadata.robots as { index?: boolean } | undefined)?.index).not.toBe(
      false,
    );
  });

  it("keeps an explicitly rejected protected city noindex", async () => {
    (findCityBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: { cityName: "La Jolla", state: "CA", stateName: "California" },
    });
    (getCityEditorialContent as jest.Mock).mockResolvedValue({
      seo_indexable: false,
      editorial_reviewed_at: "2026-07-13T00:00:00.000Z",
      intent: "best-time",
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ city: "la-jolla" }),
    });

    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });

  it.each([
    {
      citySlug: "la-jolla",
      cityName: "La Jolla",
    },
    {
      citySlug: "newport-beach",
      cityName: "Newport Beach",
    },
    {
      citySlug: "malibu",
      cityName: "Malibu",
    },
  ])(
    "uses the shared decision-first metadata for $cityName",
    async ({ citySlug, cityName }) => {
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
      const copy = buildBestTimeMetadataCopy(cityName);

      expect(metadata.title).toBe(copy.title);
      expect(metadata.description).toBe(copy.description);
    },
  );

  it.each([
    "La Jolla",
    "Huntington Beach",
    "Santa Cruz",
    "Laguna Beach",
    "Pacifica",
    "Melbourne Beach",
    "Surfside Beach",
  ])("keeps %s SERP copy direct and within display targets", (cityName) => {
    const copy = buildBestTimeMetadataCopy(cityName);
    const renderedTitle = `${copy.title} | Quiver`;

    expect(renderedTitle.length).toBeLessThanOrEqual(60);
    expect(copy.description.length).toBeGreaterThanOrEqual(150);
    expect(copy.description.length).toBeLessThanOrEqual(160);
    expect(copy.title).toContain(`${cityName} surf window today`);
    expect(copy.title).toContain("tide & wind");
    expect(copy.description).toContain(
      `${cityName}'s best surf window today`,
    );
    expect(copy.description).toContain("wind, swell, and live conditions");
    expect(copy.h1).toBe(
      `Best ${cityName} surf window today: tide and conditions`,
    );
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

    expect(source).toContain(
      "Best ${cityName} surf window today: tide and conditions",
    );
    expect(source).toContain("{liveAnswerCopy.todayAnswer}");
    expect(source).toContain("Surf Score by Month");
    expect(source).toContain("Monthly Breakdown");
    expect(source).toContain("path: `/best-time-to-surf/${citySlug}`");
  });

  it("suppresses immediate-action copy on the seasonal month gauge", () => {
    const source = readFileSync(
      join(process.cwd(), "app/best-time-to-surf/[city]/page.tsx"),
      "utf8"
    );

    const gauges = source.match(/<AnimatedScoreGauge[\s\S]*?\/>/g) ?? [];

    expect(gauges).toHaveLength(1);
    expect(gauges[0]).toContain("showAction={false}");
  });
});
