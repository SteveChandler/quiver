/**
 * @jest-environment node
 */

import SpotPage, { generateMetadata } from "@/app/spots/[slug]/page";
import { getBeachForecastPreview } from "@/actions/forecast-actions";
import { getSpotDataBySlug } from "@/actions/spot/spot-data-actions";
import { notFound } from "next/navigation";

jest.mock("@/actions/forecast-actions", () => ({
  getBeachForecastPreview: jest.fn().mockResolvedValue({
    success: true,
    data: { wave_height: "2-3 ft" },
  }),
}));

jest.mock("@/actions/spot/spot-data-actions", () => ({
  getSpotDataBySlug: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    const err = new Error("NEXT_NOT_FOUND");
    (err as any).digest = "NEXT_NOT_FOUND";
    throw err;
  }),
}));

const canonicalSpot = {
  id: "beach-1",
  slug: "ocean-beach",
  name: "Ocean Beach",
  city: "San Diego",
  state: "CA",
  country: "USA",
  region: "San Diego, CA",
  description: "A punchy beach break in San Diego.",
  breakType: "beach",
  skillLevel: "Intermediate",
};

describe("legacy /spots/[slug] route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a true 404 (NEXT_NOT_FOUND) for known spots if proxy did not redirect first", async () => {
    (getSpotDataBySlug as jest.Mock).mockResolvedValue({
      data: canonicalSpot,
      dbHasLocation: true,
    });

    expect(() => SpotPage()).toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalled();
    expect(getSpotDataBySlug).not.toHaveBeenCalled();
  });

  it("returns a true 404 (NEXT_NOT_FOUND) for unknown spots", async () => {
    (getSpotDataBySlug as jest.Mock).mockResolvedValue({
      data: null,
      dbHasLocation: false,
    });

    expect(() => SpotPage()).toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalled();
    expect(getSpotDataBySlug).not.toHaveBeenCalled();
  });

  it("generateMetadata noindexes redirecting known spot URLs", async () => {
    (getSpotDataBySlug as jest.Mock).mockResolvedValue({
      data: canonicalSpot,
      dbHasLocation: true,
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "ocean-beach" as any }),
    });

    expect(getBeachForecastPreview).toHaveBeenCalledWith("beach-1");
    expect(metadata.alternates?.canonical).toContain(
      "/ca/san-diego/ocean-beach",
    );
    expect((metadata.robots as any)?.index).toBe(false);
    expect((metadata.robots as any)?.follow).toBe(true);
    expect((metadata.robots as any)?.googleBot?.index).toBe(false);
    expect((metadata.robots as any)?.googleBot?.follow).toBe(true);
  });

  it("generateMetadata noindexes unknown spot URLs", async () => {
    (getSpotDataBySlug as jest.Mock).mockResolvedValue({
      data: null,
      dbHasLocation: false,
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "does-not-exist" as any }),
    });

    expect(metadata.title).toBe("Spot Not Found");
    expect((metadata.robots as any)?.index).toBe(false);
    expect((metadata.robots as any)?.follow).toBe(false);
  });
});
