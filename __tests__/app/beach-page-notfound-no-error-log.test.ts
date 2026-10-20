/**
 * @jest-environment node
 */

import MexicoBeachDetailPage from "@/app/mexico/[region]/[city]/[beachSlug]/page";
import InternationalBeachDetailPage from "@/app/[intent]/[city]/[beachSlug]/[intlBeachSlug]/page";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";
import { getBeachesBySlug } from "@/actions/beach/beach-query-actions";

// The digest Next 16 puts on notFound(); the old NEXT_NOT_FOUND check missed it.
const NOT_FOUND_DIGEST = "NEXT_HTTP_ERROR_FALLBACK;404";

jest.mock("@/lib/utils/beach-lookup-utils", () => ({
  getBeachBySlugOrId: jest.fn(),
}));
jest.mock("@/actions/beach/beach-query-actions", () => ({
  getBeachesBySlug: jest.fn(),
}));
jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    const error = new Error("NEXT_HTTP_ERROR_FALLBACK;404");
    (error as { digest?: string }).digest = "NEXT_HTTP_ERROR_FALLBACK;404";
    throw error;
  }),
  redirect: jest.fn(),
}));

describe("beach pages treat notFound() as a 404, not a runtime error", () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => errorSpy.mockRestore());

  it("Mexico page rethrows notFound() without logging", async () => {
    (getBeachBySlugOrId as jest.Mock).mockResolvedValue(null);

    await expect(
      MexicoBeachDetailPage({
        params: Promise.resolve({ region: "baja-california", city: "rosarito", beachSlug: "null" }),
      }),
    ).rejects.toMatchObject({ digest: NOT_FOUND_DIGEST });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("International page rethrows notFound() without logging", async () => {
    (getBeachesBySlug as jest.Mock).mockResolvedValue({ success: true, data: [] });

    await expect(
      InternationalBeachDetailPage({
        params: Promise.resolve({
          intent: "mexico",
          city: "baja-california",
          beachSlug: "rosarito",
          intlBeachSlug: "nope",
        }),
      }),
    ).rejects.toMatchObject({ digest: NOT_FOUND_DIGEST });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("International page 404s a stray /api/v1/watch/spots without touching the database", async () => {
    await expect(
      InternationalBeachDetailPage({
        params: Promise.resolve({
          intent: "api",
          city: "v1",
          beachSlug: "watch",
          intlBeachSlug: "spots",
        }),
      }),
    ).rejects.toMatchObject({ digest: NOT_FOUND_DIGEST });
    expect(getBeachesBySlug).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
