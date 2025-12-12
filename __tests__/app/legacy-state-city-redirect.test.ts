/**
 * @jest-environment node
 */

import IntentPage from "@/app/[intent]/[city]/page";

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
  notFound: jest.fn(),
}));

describe("legacy state/city URLs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("redirects /ca/:city to map with search filter", () => {
    const { redirect } = require("next/navigation") as { redirect: jest.Mock };

    IntentPage({ params: { intent: "ca", city: "encinitas" } });

    expect(redirect).toHaveBeenCalledWith("/map?search=Encinitas");
  });

  test("does not redirect normal intent pages (non-state intent)", () => {
    const { redirect, notFound } = require("next/navigation") as {
      redirect: jest.Mock;
      notFound: jest.Mock;
    };

    IntentPage({ params: { intent: "surf-forecast", city: "encinitas" } });

    expect(redirect).not.toHaveBeenCalled();
    // We don't assert rendering details here; for unknown intent/city combos this route may 404.
    expect(notFound).toHaveBeenCalled();
  });
});

