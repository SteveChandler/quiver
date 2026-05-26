/**
 * @jest-environment node
 */

import { redirect } from "next/navigation";
import { renderBeachSubPage } from "@/lib/utils/beach-sub-page-utils";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";
import BeachTidesPage from "@/app/beach/[slug]/tides/page";
import BeachWaterTempPage from "@/app/beach/[slug]/water-temp/page";

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

jest.mock("@/lib/utils/beach-sub-page-utils", () => ({
  renderBeachSubPage: jest.fn(async (input) => ({
    kind: "rendered-subpage",
    input,
  })),
}));

jest.mock("@/lib/utils/timezone-utils.server", () => ({
  getTimezoneFromCoords: jest.fn().mockReturnValue("America/Los_Angeles"),
}));

jest.mock("@/lib/seo/tide-meta-data", () => ({
  getTideMetaData: jest.fn(),
}));

jest.mock("@/lib/seo/water-temp-meta-data", () => ({
  getWaterTempMetaData: jest.fn(),
}));

const incompleteBeach = {
  id: "legacy-beach",
  name: "Legacy Beach",
  slug: "legacy-beach",
  city: null,
  state: null,
  country: "USA",
  lat: 32.7,
  lon: -117.2,
};

describe("legacy /beach/[slug] utility subpages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getBeachBySlugOrId as jest.Mock).mockResolvedValue(incompleteBeach);
  });

  it("routes non-redirecting tide pages through the shared crawlable subpage renderer", async () => {
    await BeachTidesPage({ params: Promise.resolve({ slug: "legacy-beach" }) });

    expect(redirect).not.toHaveBeenCalled();
    expect(renderBeachSubPage).toHaveBeenCalledWith({
      beachSlug: "legacy-beach",
      pageType: "tides",
      beachPath: "/beach/legacy-beach",
    });
  });

  it("routes non-redirecting water-temp pages through the shared crawlable subpage renderer", async () => {
    await BeachWaterTempPage({ params: Promise.resolve({ slug: "legacy-beach" }) });

    expect(redirect).not.toHaveBeenCalled();
    expect(renderBeachSubPage).toHaveBeenCalledWith({
      beachSlug: "legacy-beach",
      pageType: "water-temp",
      beachPath: "/beach/legacy-beach",
    });
  });
});
