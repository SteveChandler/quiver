jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  permanentRedirect: jest.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT 308 ${path}`);
  }),
}));
jest.mock("@/components/tide-stations/nearby-buoys-slot", () => ({ NearbyBuoysSlot: () => null }));
jest.mock("@/lib/tide-stations/page-data", () => ({ getStationAccess: jest.fn(), getStationPageData: jest.fn() }));
jest.mock("@/lib/tide-stations/queries", () => ({
  getNearbyBeachLinks: jest.fn().mockResolvedValue([]),
  getNearbyTideStations: jest.fn().mockResolvedValue([]),
}));

import { permanentRedirect } from "next/navigation";

import TideStationPage, { generateMetadata } from "@/app/tides/station/[slug]/page";
import { getStationAccess, getStationPageData } from "@/lib/tide-stations/page-data";

const props = { params: Promise.resolve({ slug: "antioch-ca-9415064" }) };

beforeEach(() => jest.clearAllMocks());

describe("closed tide station page", () => {
  it("redirects permanently to the hub from the page body, before any prediction read", async () => {
    jest.mocked(getStationAccess).mockResolvedValue({ kind: "closed", redirectPath: "/tides/usa/ca" });
    await expect(TideStationPage(props)).rejects.toThrow("NEXT_REDIRECT 308 /tides/usa/ca");
    expect(permanentRedirect).toHaveBeenCalledWith("/tides/usa/ca");
    expect(getStationPageData).not.toHaveBeenCalled();
  });

  it("redirects from generateMetadata too, so metadata never fetches predictions", async () => {
    jest.mocked(getStationAccess).mockResolvedValue({ kind: "closed", redirectPath: "/tides/japan" });
    await expect(generateMetadata(props)).rejects.toThrow("NEXT_REDIRECT 308 /tides/japan");
    expect(getStationPageData).not.toHaveBeenCalled();
  });

  it("keeps an unknown station a 404", async () => {
    jest.mocked(getStationAccess).mockResolvedValue({ kind: "not-found" });
    await expect(TideStationPage(props)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(permanentRedirect).not.toHaveBeenCalled();
  });
});
