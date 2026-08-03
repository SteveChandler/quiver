/**
 * @jest-environment node
 */

import MexicoBeachTidesPage, {
  generateMetadata as generateTidesMetadata,
} from "@/app/mexico/[region]/[city]/[beachSlug]/tides/page";
import MexicoBeachWaterTempPage, {
  generateMetadata as generateWaterTempMetadata,
} from "@/app/mexico/[region]/[city]/[beachSlug]/water-temp/page";
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
  region: "baja-california",
  city: "puerto-nuevo",
  beachSlug: "k-40-puerto-nuevo",
});

describe("Mexico beach subpage route wiring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    renderBeachSubPageMock.mockResolvedValue(null as never);
    generateBeachSubPageMetadataMock.mockResolvedValue({});
  });

  it("passes the route location to the tides renderer and metadata", async () => {
    await MexicoBeachTidesPage({ params });
    await generateTidesMetadata({ params });

    expect(renderBeachSubPageMock).toHaveBeenCalledWith({
      beachSlug: "k-40-puerto-nuevo",
      pageType: "tides",
      beachPath:
        "/mexico/baja-california/puerto-nuevo/k-40-puerto-nuevo",
      expectedMexicoLocation: {
        region: "baja-california",
        city: "puerto-nuevo",
      },
    });
    expect(generateBeachSubPageMetadataMock).toHaveBeenCalledWith({
      beachSlug: "k-40-puerto-nuevo",
      pageType: "tides",
      beachPath:
        "/mexico/baja-california/puerto-nuevo/k-40-puerto-nuevo",
      expectedMexicoLocation: {
        region: "baja-california",
        city: "puerto-nuevo",
      },
    });
  });

  it("passes the route location to the water-temperature renderer and metadata", async () => {
    await MexicoBeachWaterTempPage({ params });
    await generateWaterTempMetadata({ params });

    expect(renderBeachSubPageMock).toHaveBeenCalledWith({
      beachSlug: "k-40-puerto-nuevo",
      pageType: "water-temp",
      beachPath:
        "/mexico/baja-california/puerto-nuevo/k-40-puerto-nuevo",
      expectedMexicoLocation: {
        region: "baja-california",
        city: "puerto-nuevo",
      },
    });
    expect(generateBeachSubPageMetadataMock).toHaveBeenCalledWith({
      beachSlug: "k-40-puerto-nuevo",
      pageType: "water-temp",
      beachPath:
        "/mexico/baja-california/puerto-nuevo/k-40-puerto-nuevo",
      expectedMexicoLocation: {
        region: "baja-california",
        city: "puerto-nuevo",
      },
    });
  });
});
