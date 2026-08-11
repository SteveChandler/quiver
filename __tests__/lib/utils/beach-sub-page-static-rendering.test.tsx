import { headers } from "next/headers";

import { getNearbyBeaches } from "@/actions/beach/beach-location-actions";
import { getTideMetaData } from "@/lib/seo/tide-meta-data";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";
import { renderBeachSubPage } from "@/lib/utils/beach-sub-page-utils";
import { enrichBeachesWithConditions } from "@/lib/utils/nearby-beach-enrichment";
import type { Beach } from "@/types/database";

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
});
