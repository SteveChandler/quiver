/**
 * @jest-environment node
 */

import { renderToStaticMarkup } from "react-dom/server";
import { notFound, redirect } from "next/navigation";
import LocationPage from "@/app/beaches/[country]/[state]/[city]/page";
import LocationNotFound from "@/app/beaches/[country]/[state]/[city]/not-found";
import { getLocationPageData } from "@/actions/beach/beach-location-list-actions";
import { getTopCitiesInState } from "@/actions/beach/beach-location-actions";
import { getCitySurfReport } from "@/actions/city/city-conditions-actions";
import { getCityEditorialPhoto } from "@/lib/data/server/city-editorial-photo";

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw Object.assign(new Error("Not found"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  }),
  redirect: jest.fn(() => {
    throw Object.assign(new Error("Redirect"), { digest: "NEXT_REDIRECT" });
  }),
}));
jest.mock("@/actions/beach/beach-location-list-actions", () => ({
  getLocationPageData: jest.fn(),
}));
jest.mock("@/actions/beach/beach-location-actions", () => ({
  getTopCitiesInState: jest.fn().mockResolvedValue([]),
}));
jest.mock("@/actions/city/city-conditions-actions", () => ({
  getCitySurfReport: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/actions/city/city-editorial-actions", () => ({
  getCityEditorialContent: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/lib/data/server/city-editorial-photo", () => ({
  getCityEditorialPhoto: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/lib/utils/best-time-to-surf-utils", () => ({
  getBestTimeToSurfUrl: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/components/app-store/sticky-install-ask", () => ({
  StickyInstallAsk: () => null,
}));
jest.mock("@/app/beaches/[country]/[state]/[city]/city-page-metadata", () => ({
  generateMetadata: jest.fn(),
}));
jest.mock("@/app/beaches/[country]/[state]/[city]/editorial-layout", () => ({
  EditorialLayout: () => null,
}));
jest.mock("@/app/beaches/[country]/[state]/[city]/standard-layout", () => ({
  StandardLayout: ({ displayCityName }: { displayCityName: string }) => <h1>{displayCityName}</h1>,
}));

const props = {
  params: Promise.resolve({ country: "usa", state: "ca", city: "oceanside" }),
};

describe("city pages without beach data", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(["CITY_EXISTS_NO_DATA", "No beaches found for this location"])(
    "uses the route 404 for %s without redirecting or loading optional sections",
    async (error) => {
      (getLocationPageData as jest.Mock).mockResolvedValue({ success: false, error });

      await expect(LocationPage(props)).rejects.toMatchObject({
        digest: "NEXT_HTTP_ERROR_FALLBACK;404",
      });
      expect(notFound).toHaveBeenCalledTimes(1);
      expect(redirect).not.toHaveBeenCalled();
      expect(getCityEditorialPhoto).not.toHaveBeenCalled();
      expect(getCitySurfReport).not.toHaveBeenCalled();
      // Sibling data is not loaded at this point; keep the existing generic hint.
      expect(getTopCitiesInState).not.toHaveBeenCalled();
    },
  );

  it("also returns 404 for a successful response with no beaches", async () => {
    (getLocationPageData as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        location: { city: "Oceanside", state: "CA", country: "USA" },
        beaches: [],
        stats: {},
      },
    });

    await expect(LocationPage(props)).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
    expect(notFound).toHaveBeenCalledTimes(1);
    expect(redirect).not.toHaveBeenCalled();
    expect(getTopCitiesInState).not.toHaveBeenCalled();
  });

  it("still renders a city with beaches when its optional surf report is unavailable", async () => {
    (getLocationPageData as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        location: { city: "Oceanside", state: "CA", country: "USA" },
        beaches: [{ id: "pier", name: "Oceanside Pier", slug: "oceanside-pier", city: "Oceanside", state: "CA", country: "USA" }],
        stats: {},
      },
    });

    expect(renderToStaticMarkup(await LocationPage(props))).toContain("Oceanside");
    expect(getCitySurfReport).toHaveBeenCalledWith("Oceanside", "ca", undefined, undefined);
    expect(notFound).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("shows the existing route fallback and nearby-city hint", () => {
    const html = renderToStaticMarkup(<LocationNotFound />);

    expect(html).toContain("Location Not Found");
    expect(html).toContain("Try a nearby coastal city or neighborhood");
    expect(html).toContain('href="/beaches"');
  });
});
