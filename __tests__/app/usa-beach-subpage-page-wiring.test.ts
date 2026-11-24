/**
 * @jest-environment node
 */

import UsaBeachTidesPage, {
  generateMetadata as generateTidesMetadata,
} from "@/app/[intent]/[city]/[beachSlug]/tides/page";
import UsaBeachWaterTempPage, {
  generateMetadata as generateWaterTempMetadata,
} from "@/app/[intent]/[city]/[beachSlug]/water-temp/page";
import {
  generateBeachSubPageMetadata,
  renderBeachSubPage,
} from "@/lib/utils/beach-sub-page-utils";

jest.mock("@/lib/utils/beach-sub-page-utils", () => ({
  generateBeachSubPageMetadata: jest.fn(),
  renderBeachSubPage: jest.fn(),
}));

const renderBeachSubPageMock = renderBeachSubPage as jest.MockedFunction<
  typeof renderBeachSubPage
>;
const generateBeachSubPageMetadataMock =
  generateBeachSubPageMetadata as jest.MockedFunction<
    typeof generateBeachSubPageMetadata
  >;

const params = Promise.resolve({
  intent: "hi",
  city: "wai-anae",
  beachSlug: "makua-beach-oahu",
});

describe("US beach subpage route wiring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    renderBeachSubPageMock.mockResolvedValue(null as never);
    generateBeachSubPageMetadataMock.mockResolvedValue({});
  });

  it.each([
    ["tides", UsaBeachTidesPage, generateTidesMetadata],
    ["water-temp", UsaBeachWaterTempPage, generateWaterTempMetadata],
  ] as const)(
    "passes the URL state and city to the %s renderer and metadata",
    async (pageType, renderPage, renderMetadata) => {
      await renderPage({ params });
      await renderMetadata({ params });

      const expected = {
        beachSlug: "makua-beach-oahu",
        pageType,
        beachPath: "/hi/wai-anae/makua-beach-oahu",
        expectedUsaLocation: { state: "hi", city: "wai-anae" },
      };
      expect(renderBeachSubPageMock).toHaveBeenCalledWith(expected);
      expect(generateBeachSubPageMetadataMock).toHaveBeenCalledWith(expected);
    },
  );
});
