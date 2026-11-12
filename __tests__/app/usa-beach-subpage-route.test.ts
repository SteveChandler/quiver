/**
 * @jest-environment node
 */

import { notFound, redirect } from "next/navigation";
import {
  generateBeachSubPageMetadata,
  renderBeachSubPage,
} from "@/lib/utils/beach-sub-page-utils";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";
import { getTideMetaData } from "@/lib/seo/tide-meta-data";
import { getWaterTempMetaData } from "@/lib/seo/water-temp-meta-data";
import { getForecastIndexabilityForBeaches } from "@/lib/seo/forecast-indexability";

jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn() }));

jest.mock("next/cache", () => ({
  unstable_cache: jest.fn((fn: unknown) => fn),
}));

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    const error = new Error("NEXT_NOT_FOUND");
    (error as { digest?: string }).digest = "NEXT_NOT_FOUND";
    throw error;
  }),
  redirect: jest.fn((url: string) => {
    const error = new Error(`NEXT_REDIRECT:${url}`);
    (error as { digest?: string }).digest = "NEXT_REDIRECT";
    throw error;
  }),
}));

jest.mock("@/lib/utils/beach-lookup-utils", () => ({
  getBeachBySlugOrId: jest.fn(),
}));

jest.mock("@/lib/seo/tide-meta-data", () => ({
  getTideMetaData: jest.fn(),
}));

jest.mock("@/lib/seo/water-temp-meta-data", () => ({
  getWaterTempMetaData: jest.fn(),
}));

jest.mock("@/lib/seo/forecast-indexability", () => ({
  ...jest.requireActual("@/lib/seo/forecast-indexability"),
  getForecastIndexabilityForBeaches: jest.fn(),
}));

jest.mock("@/lib/utils/timezone-utils.server", () => ({
  getTimezoneFromCoords: jest.fn(() => "Pacific/Honolulu"),
}));

const makuaBeach = {
  id: "makua",
  name: "Makua Beach",
  slug: "makua-beach-oahu",
  city: "Waianae",
  state: "HI",
  country: "USA",
  timezone: "Pacific/Honolulu",
  lat: 21.53,
  lon: -158.23,
};

const pageTypes = ["tides", "water-temp"] as const;

function argsFor(
  pageType: (typeof pageTypes)[number],
  state: string,
  city: string,
) {
  return {
    beachSlug: makuaBeach.slug,
    pageType,
    beachPath: `/${state}/${city}/${makuaBeach.slug}`,
    expectedUsaLocation: { state, city },
  };
}

describe("US beach subpage location validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getBeachBySlugOrId as jest.Mock).mockResolvedValue(makuaBeach);
    (getTideMetaData as jest.Mock).mockResolvedValue({
      nextHighTime: null,
      nextHighHeight: null,
      nextLowTime: null,
      nextLowHeight: null,
    });
    (getWaterTempMetaData as jest.Mock).mockResolvedValue({
      tempF: null,
      wetsuitRec: null,
    });
    (getForecastIndexabilityForBeaches as jest.Mock).mockResolvedValue(new Map());
  });

  describe.each(pageTypes)("%s", (pageType) => {
    it("renders the canonical state and city without redirecting", async () => {
      await expect(
        renderBeachSubPage(argsFor(pageType, "hi", "waianae")),
      ).resolves.toBeTruthy();

      expect(redirect).not.toHaveBeenCalled();
      expect(notFound).not.toHaveBeenCalled();
    });

    it("keeps the canonical metadata path for the canonical state and city", async () => {
      const metadata = await generateBeachSubPageMetadata(
        argsFor(pageType, "hi", "waianae"),
      );

      expect(String(metadata.alternates?.canonical)).toMatch(
        new RegExp(`/hi/waianae/makua-beach-oahu/${pageType}$`),
      );
      expect(redirect).not.toHaveBeenCalled();
      expect(notFound).not.toHaveBeenCalled();
    });

    it("redirects a wrong city to the canonical sub-page URL", async () => {
      await expect(
        renderBeachSubPage(argsFor(pageType, "hi", "wai-anae")),
      ).rejects.toMatchObject({ digest: "NEXT_REDIRECT" });

      expect(redirect).toHaveBeenCalledWith(
        `/hi/waianae/makua-beach-oahu/${pageType}`,
      );
    });

    it("gives a wrong city the canonical metadata path, as the beach page does", async () => {
      const metadata = await generateBeachSubPageMetadata(
        argsFor(pageType, "hi", "wai-anae"),
      );

      const canonical = String(metadata.alternates?.canonical);
      expect(canonical).toMatch(
        new RegExp(`/hi/waianae/makua-beach-oahu/${pageType}$`),
      );
      expect(canonical).not.toContain("wai-anae");
    });

    it("404s a wrong state", async () => {
      await expect(
        renderBeachSubPage(argsFor(pageType, "ca", "waianae")),
      ).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });
      await expect(
        generateBeachSubPageMetadata(argsFor(pageType, "ca", "waianae")),
      ).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });

      expect(redirect).not.toHaveBeenCalled();
    });

    it("404s a beach with no city", async () => {
      (getBeachBySlugOrId as jest.Mock).mockResolvedValue({
        ...makuaBeach,
        city: null,
      });

      await expect(
        renderBeachSubPage(argsFor(pageType, "hi", "waianae")),
      ).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });
      await expect(
        generateBeachSubPageMetadata(argsFor(pageType, "hi", "waianae")),
      ).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });

      expect(redirect).not.toHaveBeenCalled();
    });

    it("redirects a wrong city before the sub-page data read", async () => {
      await expect(
        renderBeachSubPage(argsFor(pageType, "hi", "wai-anae")),
      ).rejects.toMatchObject({ digest: "NEXT_REDIRECT" });

      expect(getTideMetaData).not.toHaveBeenCalled();
      expect(getWaterTempMetaData).not.toHaveBeenCalled();
    });
  });
});
