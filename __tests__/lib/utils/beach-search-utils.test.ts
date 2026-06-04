import {
  searchBeachesByName,
  searchBeachesMultiple,
  searchBeachWithForecast,
} from "@/lib/utils/beach-search-utils";
import { normalizeSearchText } from "@/lib/utils/text-normalization";
import { beachesSearchFixture } from "../../fixtures/beach-search-fixtures";

jest.mock("@/lib/services/beach-query-service", () => ({
  getBeachesFromDb: jest.fn(),
}));

import { getBeachesFromDb } from "@/lib/services/beach-query-service";

const getBeachesMock = getBeachesFromDb as unknown as jest.Mock;

describe("beach-search-utils", () => {
  const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    getBeachesMock.mockReset();
  });

  afterAll(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe("searchBeachesMultiple", () => {
    it("returns empty array when getBeachesFromDb fails", async () => {
      getBeachesMock.mockResolvedValue({
        success: false,
        data: null,
        error: "boom",
      });

      await expect(searchBeachesMultiple("blacks")).resolves.toEqual([]);
    });

    it("returns empty array when getBeachesFromDb throws", async () => {
      getBeachesMock.mockRejectedValue(new Error("boom"));
      await expect(searchBeachesMultiple("blacks")).resolves.toEqual([]);
    });

    it("orders matches by strategy priority + scorer tie-breaks (exact beats substring/word)", async () => {
      getBeachesMock.mockResolvedValue({
        success: true,
        data: beachesSearchFixture,
        error: null,
      });

      const results = await searchBeachesMultiple("Black's   Beach");
      expect(results.length).toBeGreaterThan(0);

      // Expect best match to be an exact name match (punctuation-insensitive)
      expect(normalizeSearchText(results[0].name)).toBe("blacks beach");
    });

    it("supports alias searches (pb → pacific beach) and ranks alias matches highly", async () => {
      getBeachesMock.mockResolvedValue({
        success: true,
        data: beachesSearchFixture,
        error: null,
      });

      const results = await searchBeachesMultiple("pb");
      expect(results.length).toBeGreaterThan(0);
      expect(normalizeSearchText(results[0].name)).toBe("pacific beach");
    });

    it("supports Jack's aliases and ranks 38th Avenue first", async () => {
      getBeachesMock.mockResolvedValue({
        success: true,
        data: beachesSearchFixture,
        error: null,
      });

      const asciiResults = await searchBeachesMultiple("jacks");
      const curlyResults = await searchBeachesMultiple("Jack’s");
      const santaCruzResults = await searchBeachesMultiple("jacks santa cruz");

      expect(normalizeSearchText(asciiResults[0].name)).toBe(
        "38th avenue santa cruz"
      );
      expect(normalizeSearchText(curlyResults[0].name)).toBe(
        "38th avenue santa cruz"
      );
      expect(normalizeSearchText(santaCruzResults[0].name)).toBe(
        "38th avenue santa cruz"
      );
    });

    it("supports Hook aliases and ranks The Hook ahead of Sandy Hook", async () => {
      getBeachesMock.mockResolvedValue({
        success: true,
        data: beachesSearchFixture,
        error: null,
      });

      const hookResults = await searchBeachesMultiple("hook");
      const rockviewResults = await searchBeachesMultiple("rockview");

      expect(hookResults.map((beach) => beach.name).slice(0, 2)).toEqual([
        "The Hook",
        "Sandy Hook",
      ]);
      expect(rockviewResults[0].name).toBe("The Hook");
    });

    it("is deterministic: same input yields same ordered results", async () => {
      getBeachesMock.mockResolvedValue({
        success: true,
        data: beachesSearchFixture,
        error: null,
      });

      const a = await searchBeachesMultiple("la jolla");
      const b = await searchBeachesMultiple("la jolla");

      expect(a.map((beach) => beach.id)).toEqual(b.map((beach) => beach.id));
    });
  });

  describe("searchBeachesByName", () => {
    it("returns the best match (or null)", async () => {
      getBeachesMock.mockResolvedValue({
        success: true,
        data: beachesSearchFixture,
        error: null,
      });

      await expect(searchBeachesByName("scripps")).resolves.toMatchObject({
        name: "Scripps Pier",
      });
    });

    it("returns null when no matches", async () => {
      getBeachesMock.mockResolvedValue({
        success: true,
        data: [],
        error: null,
      });

      await expect(searchBeachesByName("does not exist")).resolves.toBeNull();
    });
  });

  describe("searchBeachWithForecast (no-beach-found path)", () => {
    const originalFetch = globalThis.fetch;

    beforeAll(() => {
      globalThis.fetch = (jest.fn(() => {
        throw new Error("fetch should not be called in no-beach-found tests");
      }) as unknown) as typeof fetch;
    });

    afterAll(() => {
      globalThis.fetch = originalFetch;
    });

    it("returns structured error + metadata for out-of-area searches", async () => {
      getBeachesMock.mockResolvedValue({
        success: true,
        data: [],
        error: null,
      });

      const result = await searchBeachWithForecast("bali");

      expect(result.success).toBe(false);
      expect(result.error).toContain('No beach found matching "bali"');
      expect(result.searchMetadata.isOutOfAreaSearch).toBe(true);
      expect(result.searchMetadata.suggestedMessage).toContain("Bali, Indonesia");
    });

    it("returns structured error with no out-of-area metadata when not detected", async () => {
      getBeachesMock.mockResolvedValue({
        success: true,
        data: [],
        error: null,
      });

      const result = await searchBeachWithForecast("totally unknown place");

      expect(result.success).toBe(false);
      expect(result.searchMetadata.isOutOfAreaSearch).toBe(false);
      expect(result.searchMetadata.suggestedMessage).toBeUndefined();
      expect(result.searchMetadata.detectedLocation).toBeUndefined();
    });
  });
});

