import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { render, screen } from "@testing-library/react";
import { headers } from "next/headers";

import { getNearbyBeaches } from "@/actions/beach/beach-location-actions";
import { getTideMetaData } from "@/lib/seo/tide-meta-data";
import { getWaterTempMetaData } from "@/lib/seo/water-temp-meta-data";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";
import { renderBeachSubPage } from "@/lib/utils/beach-sub-page-utils";
import { BeachDetailClient } from "@/app/beach/[slug]/beach-detail-client";
import { WaterTempSummaryHero } from "@/components/beach-detail/water-temp-summary-hero";
import { enrichBeachesWithConditions } from "@/lib/utils/nearby-beach-enrichment";
import type { Beach } from "@/types/database";

type PageTreeElement = ReactElement<{ children?: ReactNode }>;

function getPageChildren(page: PageTreeElement): ReactElement[] {
  return Children.toArray(page.props.children).filter(
    isValidElement,
  ) as ReactElement[];
}

const mockHeadersGet = jest.fn();

jest.mock("next/headers", () => ({
  headers: jest.fn(async () => ({
    get: mockHeadersGet,
  })),
}));

jest.mock("@/lib/utils/beach-lookup-utils", () => ({
  getBeachBySlugOrId: jest.fn(),
}));

jest.mock("@/actions/beach/beach-location-actions", () => ({
  getNearbyBeaches: jest.fn(),
}));

jest.mock("@/lib/seo/tide-meta-data", () => ({
  getTideMetaData: jest.fn(),
}));

jest.mock("@/lib/seo/water-temp-meta-data", () => ({
  getWaterTempMetaData: jest.fn(),
}));

jest.mock("@/lib/utils/nearby-beach-enrichment", () => ({
  enrichBeachesWithConditions: jest.fn(),
}));

jest.mock("@/lib/utils/timezone-utils.server", () => ({
  getTimezoneFromCoords: jest.fn(() => "America/Los_Angeles"),
}));

const beach = {
  id: "beach-1",
  name: "Blacks",
  slug: "blacks",
  city: "San Diego",
  state: "CA",
  country: "USA",
  lat: 32.89,
  lon: -117.25,
} as Beach;

describe("renderBeachSubPage static rendering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getBeachBySlugOrId as jest.MockedFunction<typeof getBeachBySlugOrId>)
      .mockResolvedValue(beach);
    (getNearbyBeaches as jest.MockedFunction<typeof getNearbyBeaches>)
      .mockResolvedValue({ success: true, data: [] });
    (getTideMetaData as jest.MockedFunction<typeof getTideMetaData>)
      .mockResolvedValue({
        nextHighTime: null,
        nextHighHeight: null,
        nextLowTime: null,
        nextLowHeight: null,
      });
    (getWaterTempMetaData as jest.MockedFunction<typeof getWaterTempMetaData>)
      .mockResolvedValue({ tempF: null, wetsuitRec: null });
    (
      enrichBeachesWithConditions as jest.MockedFunction<
        typeof enrichBeachesWithConditions
      >
    ).mockResolvedValue([]);
  });

  it("never reads request headers", async () => {
    // Reading the request's user-agent here makes static routes silently lose
    // their platform decision. Platform must stay inside the client switch.
    mockHeadersGet.mockReturnValue("iPhone Safari");

    await renderBeachSubPage({
      beachSlug: "blacks",
      pageType: "tides",
      beachPath: "/ca/san-diego/blacks",
    });

    expect(headers).not.toHaveBeenCalled();
    expect(mockHeadersGet).not.toHaveBeenCalled();
  });

  it("wires available water-temperature data into the zine hero", async () => {
    (getWaterTempMetaData as jest.MockedFunction<typeof getWaterTempMetaData>)
      .mockResolvedValue({ tempF: 67, wetsuitRec: "3/2mm fullsuit" });

    const page = await renderBeachSubPage({
      beachSlug: "blacks",
      pageType: "water-temp",
      beachPath: "/ca/san-diego/blacks",
    }) as PageTreeElement;
    const children = getPageChildren(page);
    const beachDetail = children.find(
      (child) => child.type === BeachDetailClient,
    );
    const beachDetailProps = beachDetail?.props as {
      heroHeadingLevel?: string;
      heroHeadingSuffix?: string;
      heroSummarySlot?: ReactElement;
    } | undefined;

    expect(beachDetail).toMatchObject({ type: BeachDetailClient });
    expect(beachDetailProps).toMatchObject({
      heroHeadingLevel: "h1",
      heroHeadingSuffix: "Water Temp & Wetsuit Guide",
    });
    expect(beachDetailProps?.heroSummarySlot).toMatchObject({
      type: WaterTempSummaryHero,
      props: {
        beachName: "Blacks",
        seasonalTrendsHref: "/water-temp/san-diego#seasonal-trends",
        seasonalTrendsLocation: "San Diego",
        waterTempData: { tempF: 67, wetsuitRec: "3/2mm fullsuit" },
      },
    });
    expect(children.some((child) => child.type === WaterTempSummaryHero)).toBe(false);
  });

  it("keeps the crawl-copy H1 and tide companion link when temperature is unavailable", async () => {
    const page = await renderBeachSubPage({
      beachSlug: "blacks",
      pageType: "water-temp",
      beachPath: "/ca/san-diego/blacks",
    }) as PageTreeElement;
    const children = getPageChildren(page);
    const crawlIntro = children.find(
      (child) =>
        typeof child.type === "function" &&
        child.type.name === "BeachSubPageCrawlIntro",
    );
    const beachDetail = children.find(
      (child) => child.type === BeachDetailClient,
    );
    const beachDetailProps = beachDetail?.props as {
      heroHeadingLevel?: string;
      heroSummarySlot?: ReactElement;
    } | undefined;

    expect(crawlIntro).toMatchObject({
      props: { copy: expect.objectContaining({ heading: "Blacks Water Temperature" }) },
    });
    if (!crawlIntro) throw new Error("Expected crawl intro");
    render(crawlIntro);
    expect(
      screen.getByRole("heading", { level: 1, name: "Blacks Water Temperature" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /watch the tide window/i }),
    ).toHaveAttribute("href", "/ca/san-diego/blacks/tides");
    expect(beachDetailProps).toMatchObject({ heroHeadingLevel: "h2" });
    expect(beachDetailProps?.heroSummarySlot).toBeUndefined();
  });
});
