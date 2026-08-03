/**
 * @jest-environment node
 */

import { notFound } from "next/navigation";
import {
  generateBeachSubPageMetadata,
  renderBeachSubPage,
} from "@/lib/utils/beach-sub-page-utils";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    const error = new Error("NEXT_NOT_FOUND");
    (error as { digest?: string }).digest = "NEXT_NOT_FOUND";
    throw error;
  }),
}));

jest.mock("@/lib/utils/beach-lookup-utils", () => ({
  getBeachBySlugOrId: jest.fn(),
}));

const mexicoBeach = {
  id: "k-40",
  name: "K-40",
  slug: "k-40-puerto-nuevo",
  city: "Puerto Nuevo",
  state: "Baja California",
  country: "Mexico",
  lat: 32.2,
  lon: -117.1,
  seo_indexable: true,
  editorial_reviewed_at: "2026-01-01T00:00:00Z",
  editorial_sources: [],
  description: "A locally reviewed surf break.",
  crowd_tips: "Arrive early.",
  wave_tips: "Best on a south swell.",
  best_conditions_prose: "Works on a clean swell.",
};

describe("Mexico beach subpage route validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getBeachBySlugOrId as jest.Mock).mockResolvedValue(mexicoBeach);
  });

  it("404s a valid beach slug paired with the wrong region or city", async () => {
    await expect(
      renderBeachSubPage({
        beachSlug: "k-40-puerto-nuevo",
        pageType: "tides",
        beachPath: "/mexico/wrong-region/wrong-city/k-40-puerto-nuevo",
        expectedMexicoLocation: {
          region: "wrong-region",
          city: "wrong-city",
        },
      }),
    ).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });

    expect(notFound).toHaveBeenCalled();
  });

  it("404s malformed metadata requests instead of returning an indexable canonical", async () => {
    await expect(
      generateBeachSubPageMetadata({
        beachSlug: "k-40-puerto-nuevo",
        pageType: "tides",
        beachPath: "/mexico/wrong-region/wrong-city/k-40-puerto-nuevo",
        expectedMexicoLocation: {
          region: "wrong-region",
          city: "wrong-city",
        },
      }),
    ).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });

    expect(notFound).toHaveBeenCalled();
  });
});
