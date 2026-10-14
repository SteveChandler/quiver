jest.mock("@/lib/services/beach-query-service", () => ({
  getBeachesBySlugFromDb: jest.fn(),
  getBeachByIdFromDb: jest.fn(),
}));

import {
  getBeachByIdFromDb,
  getBeachesBySlugFromDb,
} from "@/lib/services/beach-query-service";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";

const bySlug = getBeachesBySlugFromDb as jest.Mock;
const byId = getBeachByIdFromDb as jest.Mock;

describe("getBeachBySlugOrId", () => {
  beforeEach(() => {
    bySlug.mockReset();
    byId.mockReset();
  });

  it("throws when the slug query fails instead of reporting a missing beach", async () => {
    bySlug.mockResolvedValue({ success: false, error: "canceling statement due to statement timeout" });

    await expect(getBeachBySlugOrId("bandon")).rejects.toThrow("statement timeout");
    expect(byId).not.toHaveBeenCalled();
  });

  it("returns null when the slug and id lookups find nothing", async () => {
    bySlug.mockResolvedValue({ success: true, data: [] });
    byId.mockResolvedValue({ success: false, error: "invalid input syntax for type uuid" });

    await expect(getBeachBySlugOrId("no-such-beach")).resolves.toBeNull();
  });

  it("returns the slug match", async () => {
    const beach = { id: "b1", slug: "bandon", lat: 43.1, lon: -124.4 };
    bySlug.mockResolvedValue({ success: true, data: [beach] });

    await expect(getBeachBySlugOrId("bandon")).resolves.toEqual(beach);
  });
});
