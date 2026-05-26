/**
 * @jest-environment node
 */

jest.mock("@/actions/city/city-metadata-actions", () => ({
  findCityBySlug: jest.fn(),
  findCitiesMatchingPattern: jest.fn(),
  getCityMetadata: jest.fn(),
  getCityBeachEditorialData: jest.fn(),
  getCityExcludeIntents: jest.fn(),
}));

import IntentPage, { generateMetadata } from "@/app/[intent]/[city]/page";
import {
  findCitiesMatchingPattern,
  findCityBySlug,
} from "@/actions/city/city-metadata-actions";

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
  notFound: jest.fn(),
}));

describe("legacy state/city URLs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (findCityBySlug as jest.Mock).mockResolvedValue({
      success: false,
      data: null,
    });
    (findCitiesMatchingPattern as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });
  });

  test("redirects /ca/:city to map with search filter", async () => {
    const { redirect } = require("next/navigation") as { redirect: jest.Mock };

    await IntentPage({ params: Promise.resolve({ intent: "ca", city: "encinitas" }) });

    expect(redirect).toHaveBeenCalledWith("/map?search=Encinitas");
  });

  test("does not redirect normal intent pages (non-state intent)", async () => {
    const { redirect, notFound } = require("next/navigation") as {
      redirect: jest.Mock;
      notFound: jest.Mock;
    };

    await IntentPage({ params: Promise.resolve({ intent: "surf-forecast", city: "encinitas" }) });

    expect(redirect).not.toHaveBeenCalled();
    // We don't assert rendering details here; for unknown intent/city combos this route may 404.
    expect(notFound).toHaveBeenCalled();
  });

  test("returns explicit not-found metadata for missing intent cities", async () => {
    (findCityBySlug as jest.Mock).mockResolvedValue({
      success: false,
      data: null,
    });
    (findCitiesMatchingPattern as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({
        intent: "beginner",
        city: "long-island-does-not-exist",
      }),
    });

    expect(metadata.title).toBe("Page Not Found");
    expect(metadata.description).toBe("This page could not be found.");
    expect(metadata.alternates?.canonical).toContain(
      "/beginner/long-island-does-not-exist",
    );
    expect((metadata.robots as any)?.index).toBe(false);
    expect((metadata.robots as any)?.follow).toBe(true);
  });
});
