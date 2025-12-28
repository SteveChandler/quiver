/**
 * @jest-environment node
 */

import BeachDetailBySlugPage from "@/app/beach/[slug]/page";
import { getBeachById, getBeachBySlug } from "@/actions/beach/beach-query-actions";
import { notFound } from "next/navigation";

jest.mock("@/actions/beach/beach-query-actions", () => ({
  getBeachBySlug: jest.fn(),
  getBeachById: jest.fn(),
}));

describe("legacy /beach/[slug] route", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (getBeachBySlug as jest.Mock).mockResolvedValue({
      success: false,
      data: null,
    });
    (getBeachById as jest.Mock).mockResolvedValue({
      success: false,
      data: null,
    });
  });

  it("returns a true 404 (NEXT_NOT_FOUND) when a beach cannot be resolved", async () => {
    await expect(
      BeachDetailBySlugPage({ params: { slug: "does-not-exist" } })
    ).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });

    expect(notFound).toHaveBeenCalled();
  });
});


