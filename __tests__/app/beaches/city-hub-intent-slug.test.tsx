/**
 * @jest-environment node
 */

// City names that exist in more than one state have their intent pages at a
// state-suffixed slug (/tide/long-beach-ca). City hubs linked the bare slug,
// which 404s. Metros that are not themselves a city have no intent pages.

import { renderToStaticMarkup } from "react-dom/server";
import LocationPage from "@/app/beaches/[country]/[state]/[city]/page";
import { resolveIntentCitySlug } from "@/app/beaches/[country]/[state]/[city]/city-page-utils";
import { getLocationPageData } from "@/actions/beach/beach-location-list-actions";
import { getCityEditorialContent } from "@/actions/city/city-editorial-actions";
import { getBestTimeToSurfUrl } from "@/lib/utils/best-time-to-surf-utils";
import { getMetroConfig } from "@/lib/constants/metro-areas";
import { mockSanDiegoEditorial } from "@/__tests__/fixtures/city-editorial";

const standardLayoutProps = jest.fn();
const editorialLayoutProps = jest.fn();

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("Not found");
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
  getCityEditorialContent: jest.fn(),
}));
jest.mock("@/lib/data/server/city-editorial-photo", () => ({
  getCityEditorialPhoto: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/lib/utils/best-time-to-surf-utils", () => ({
  getBestTimeToSurfUrl: jest.fn(),
}));
jest.mock("@/components/app-store/sticky-install-ask", () => ({
  StickyInstallAsk: () => null,
}));
jest.mock("@/app/beaches/[country]/[state]/[city]/city-page-metadata", () => ({
  generateMetadata: jest.fn(),
}));
jest.mock("@/app/beaches/[country]/[state]/[city]/editorial-layout", () => ({
  EditorialLayout: (props: unknown) => {
    editorialLayoutProps(props);
    return null;
  },
}));
jest.mock("@/app/beaches/[country]/[state]/[city]/standard-layout", () => ({
  StandardLayout: (props: unknown) => {
    standardLayoutProps(props);
    return null;
  },
}));

describe("resolveIntentCitySlug", () => {
  it.each([
    [{ country: "usa", state: "ca", city: "long-beach" }, { state: "CA", city: "Long Beach" }, "long-beach-ca"],
    [{ country: "usa", state: "ny", city: "long-beach" }, { state: "NY", city: "Long Beach" }, "long-beach-ny"],
    [{ country: "usa", state: "fl", city: "atlantic-beach" }, { state: "FL", city: "Atlantic Beach" }, "atlantic-beach-fl"],
    [{ country: "usa", state: "md", city: "ocean-city" }, { state: "MD", city: "Ocean City" }, "ocean-city-md"],
    [{ country: "usa", state: "hi", city: "koloa" }, { state: "HI", city: "Koloa" }, "koloa-hi"],
  ])("suffixes the state for collision city %o", (params, location, expected) => {
    expect(resolveIntentCitySlug(params, { country: "USA", ...location }, null)).toBe(expected);
  });

  it.each([
    [{ country: "usa", state: "ca", city: "encinitas" }, "Encinitas", "encinitas"],
    [{ country: "usa", state: "ca", city: "santa-cruz" }, "Santa Cruz", "santa-cruz"],
    // Island-suffixed HI hub slugs differ from slugifyAscii(city); keep the route slug.
    [{ country: "usa", state: "hi", city: "waimea-big-island" }, "Waimea", "waimea-big-island"],
    [{ country: "mexico", state: "baja-california", city: "camalu" }, "Camalú", "camalu"],
  ])("keeps the route slug for non-collision hub %o", (params, city, expected) => {
    expect(resolveIntentCitySlug(params, { country: "USA", state: "CA", city }, null)).toBe(expected);
  });

  it("returns null for a metro that is not one of its own cities", () => {
    expect(
      resolveIntentCitySlug(
        { country: "usa", state: "ca", city: "orange-county" },
        { country: "USA", state: "CA", city: "Orange County" },
        getMetroConfig("orange-county"),
      ),
    ).toBeNull();
  });

  it("keeps the metro slug when the metro is also one of its cities", () => {
    expect(
      resolveIntentCitySlug(
        { country: "usa", state: "ca", city: "san-diego" },
        { country: "USA", state: "CA", city: "San Diego" },
        getMetroConfig("san-diego"),
      ),
    ).toBe("san-diego");
  });
});

describe("city hub page intent slug wiring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getBestTimeToSurfUrl as jest.Mock).mockResolvedValue("/best-time-to-surf/long-beach-ca");
    (getLocationPageData as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        location: { city: "Long Beach", state: "CA", country: "USA" },
        beaches: [{ id: "lb", name: "Long Beach", slug: "long-beach", city: "Long Beach", state: "CA", country: "USA" }],
        stats: {},
      },
    });
  });

  const props = {
    params: Promise.resolve({ country: "usa", state: "ca", city: "long-beach" }),
  };

  it("passes the suffixed slug to the best-time lookup and the standard layout", async () => {
    (getCityEditorialContent as jest.Mock).mockResolvedValue(null);

    renderToStaticMarkup(await LocationPage(props));

    expect(getBestTimeToSurfUrl).toHaveBeenCalledWith("long-beach-ca", "Long Beach", "CA", undefined);
    expect(standardLayoutProps).toHaveBeenCalledWith(
      expect.objectContaining({ intentCitySlug: "long-beach-ca" }),
    );
  });

  it("passes a null intent slug for the Orange County metro", async () => {
    (getCityEditorialContent as jest.Mock).mockResolvedValue(null);
    (getBestTimeToSurfUrl as jest.Mock).mockResolvedValue(undefined);
    (getLocationPageData as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        location: { city: "Orange County", state: "CA", country: "USA" },
        beaches: [{ id: "hb", name: "HB Pier", slug: "hb-pier", city: "Huntington Beach", state: "CA", country: "USA" }],
        stats: {},
      },
    });

    renderToStaticMarkup(
      await LocationPage({
        params: Promise.resolve({ country: "usa", state: "ca", city: "orange-county" }),
      }),
    );

    expect(standardLayoutProps).toHaveBeenCalledWith(
      expect.objectContaining({ intentCitySlug: null }),
    );
  });

  it("passes the suffixed slug to the editorial layout", async () => {
    (getCityEditorialContent as jest.Mock).mockResolvedValue(mockSanDiegoEditorial);

    renderToStaticMarkup(await LocationPage(props));

    expect(editorialLayoutProps).toHaveBeenCalledWith(
      expect.objectContaining({ intentCitySlug: "long-beach-ca" }),
    );
  });
});
