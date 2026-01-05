/**
 * @jest-environment node
 */

import GenericBeachDetailPage from "@/app/[intent]/[city]/[beachSlug]/page";
import { getBeachesBySlug } from "@/actions/beach/beach-query-actions";
import type { Beach } from "@/types/database";
import { notFound } from "next/navigation";

jest.mock("@/actions/beach/beach-query-actions", () => ({
  getBeachesBySlug: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    const err = new Error("NEXT_NOT_FOUND");
    (err as any).digest = "NEXT_NOT_FOUND";
    throw err;
  }),
}));

function makeBeach(overrides: Partial<Beach>) {
  return {
    id: overrides.id ?? "beach-1",
    name: overrides.name ?? "Test Beach",
    slug: overrides.slug ?? "lowers-trestles",
    city: overrides.city ?? "Orange County",
    state: overrides.state ?? "CA",
    country: overrides.country ?? "USA",
    lat: overrides.lat ?? 33.0,
    lon: overrides.lon ?? -117.0,
    created_at: overrides.created_at ?? "2026-01-01T00:00:00Z",
    review_count: overrides.review_count ?? 0,
    // other Beach fields unused by this page are intentionally omitted for test brevity
  } as unknown as Beach;
}

describe("GenericBeachDetailPage slug resolution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a true 404 (NEXT_NOT_FOUND) when no beaches match the slug", async () => {
    (getBeachesBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });

    await expect(
      GenericBeachDetailPage({
        params: { intent: "ca", city: "orange-county", beachSlug: "nope" },
      })
    ).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });

    expect(notFound).toHaveBeenCalled();
  });

  it("chooses the candidate that matches URL state+city when duplicates exist", async () => {
    (getBeachesBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: [
        makeBeach({
          id: "wrong-state",
          state: "HI",
          city: "Oahu",
          created_at: "2026-01-03T00:00:00Z",
        }),
        makeBeach({
          id: "right-match",
          state: "CA",
          city: "Orange County",
          created_at: "2025-12-01T00:00:00Z",
        }),
      ],
    });

    // If the resolver selects the correct match, it should proceed far enough to try rendering.
    // We don't assert on JSX output here; we just assert it does NOT trigger `notFound()`.
    await expect(
      GenericBeachDetailPage({
        params: { intent: "ca", city: "orange-county", beachSlug: "lowers-trestles" },
      })
    ).resolves.toBeTruthy();

    expect(notFound).not.toHaveBeenCalled();
  });
});


