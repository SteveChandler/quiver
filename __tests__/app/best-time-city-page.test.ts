/**
 * @jest-environment node
 */

import {
  buildBestTimeLiveHandoffSteps,
  generateMetadata,
} from "@/app/best-time-to-surf/[city]/page";
import { findCityBySlug } from "@/actions/city/city-metadata-actions";

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

    expect(metadata.title).toContain("Best Time to Surf in San Diego");
    expect(metadata.description).toContain("today's surf report");
    expect(metadata.description).toContain("best current window");
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
});
