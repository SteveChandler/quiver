import { readFileSync } from "fs";
import { join } from "path";
import { unstable_cache } from "next/cache";

/**
 * Tests for City Editorial Actions
 *
 * Tests the server actions for fetching city editorial content from Supabase.
 * Priority 1 test coverage for San Diego page redesign.
 */

import {
  getCityEditorialContent,
  getReviewedCityEditorialContent,
} from "@/actions/city/city-editorial-actions";
import { createPublicReadClient } from "@/lib/supabase/server";
import {
  mockSanDiegoEditorial,
  mockOrangeCountyEditorial,
  mockMinimalEditorial,
  mockEditorialWithStringJsonb,
  mockRpcSuccessResponse,
  mockRpcNotFoundResponse,
  mockRpcErrorResponse,
  mockTableExistsResponse,
  mockTableNotExistsResponse,
} from "@/__tests__/fixtures/city-editorial";

// Mock the Supabase server client
jest.mock("@/lib/supabase/server", () => ({
  __esModule: true,
  createPublicReadClient: jest.fn(),
}));

const mockRenderMemo = new Map<string, unknown>();
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  cache: (load: (...args: unknown[]) => unknown) => (...args: unknown[]) => {
    const key = JSON.stringify(args);
    if (!mockRenderMemo.has(key)) mockRenderMemo.set(key, load(...args));
    return mockRenderMemo.get(key);
  },
}));
jest.mock("next/cache", () => ({ unstable_cache: jest.fn() }));

const nextCache = jest.mocked(unstable_cache);
const normalizedSanDiegoEditorial = { ...mockSanDiegoEditorial, editorial_sources: [] };

// Chain builder for Supabase query mocking
const makeChain = () => {
  const obj: Record<string, jest.Mock> = {};
  obj.select = jest.fn(() => obj);
  obj.eq = jest.fn(() => obj);
  obj.maybeSingle = jest.fn();
  return obj;
};

describe("City Editorial Actions", () => {
  let mockSupabaseClient: {
    rpc: jest.Mock;
    from: jest.Mock;
  };
  let tableChain: ReturnType<typeof makeChain>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRenderMemo.clear();
    const entries = new Map<string, unknown>();
    nextCache.mockReset().mockImplementation((load, keyParts) => async (...args) => {
      const key = JSON.stringify([keyParts, args]);
      if (entries.has(key)) return entries.get(key);
      const value = await load(...args);
      entries.set(key, JSON.parse(JSON.stringify(value)));
      return value;
    });
    tableChain = makeChain();

    mockSupabaseClient = {
      rpc: jest.fn(),
      from: jest.fn(() => tableChain),
    };

    (createPublicReadClient as jest.Mock).mockReturnValue(
      mockSupabaseClient
    );
  });

  it("does not export types as server actions", () => {
    const source = readFileSync(
      join(process.cwd(), "actions/city/city-editorial-actions.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/^export type /m);
  });

  describe("getCityEditorialContent", () => {
    describe("caching", () => {
      beforeEach(() => {
        jest.replaceProperty(process, "env", { ...process.env });
        delete process.env.PUBLIC_CITY_EDITORIAL_CACHE;
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      it("shares metadata and body reads with the persistent cache off", async () => {
        process.env.PUBLIC_CITY_EDITORIAL_CACHE = "false";
        mockSupabaseClient.rpc.mockResolvedValue(mockRpcSuccessResponse);

        const [metadata, body] = await Promise.all([
          getCityEditorialContent("san-diego"),
          getCityEditorialContent("san-diego", "ca", "usa", null, true),
        ]);

        expect(body).toBe(metadata);
        expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(1);
        expect(nextCache).not.toHaveBeenCalled();

        mockRenderMemo.clear();
        await getCityEditorialContent("san-diego");
        expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(2);
      });

      it("keys both caches by city, state, country, intent, and fallback policy", async () => {
        mockSupabaseClient.rpc.mockResolvedValue(mockRpcSuccessResponse);
        const render = async (): Promise<void> => {
          await getCityEditorialContent("waimea-kauai", "hi", "usa", "tide", true);
          await getCityEditorialContent("waimea-big-island", "hi", "usa", "tide", true);
          await getCityEditorialContent("waimea-kauai", "ca", "usa", "tide", true);
          await getCityEditorialContent("waimea-kauai", "hi", "mexico", "tide", true);
          await getCityEditorialContent("waimea-kauai", "hi", "usa", "sunset", true);
          await getCityEditorialContent("waimea-kauai", "hi", "usa", "tide", false);
        };

        await render();
        expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(6);
        mockRenderMemo.clear();
        await render();
        expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(6);
      });

      it("runs the Hawaii fallback once for concurrent reads of the same intent", async () => {
        mockSupabaseClient.rpc.mockImplementation((_name, { p_city }) =>
          p_city === "waimea-kauai" ? mockRpcNotFoundResponse : mockRpcSuccessResponse,
        );

        const [metadata, body] = await Promise.all([
          getCityEditorialContent("waimea-kauai", "hi", "usa", "tide"),
          getCityEditorialContent("waimea-kauai", "hi", "usa", "tide"),
        ]);

        expect(metadata).toEqual(normalizedSanDiegoEditorial);
        expect(body).toBe(metadata);
        expect(mockSupabaseClient.rpc.mock.calls).toEqual([
          ["get_city_editorial", { p_city: "waimea-kauai", p_state: "hi", p_country: "usa", p_intent: "tide" }],
          ["get_city_editorial", { p_city: "waimea", p_state: "hi", p_country: "usa", p_intent: "tide" }],
        ]);
      });

      it.each([
        ["editorial", mockRpcSuccessResponse, normalizedSanDiegoEditorial],
        ["a successful miss", mockRpcNotFoundResponse, null],
      ])("shares %s across renders and reads again in the next daily window", async (_label, response, editorial) => {
        const clock = jest.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 10, 26));
        mockSupabaseClient.rpc.mockResolvedValue(response);
        const read = () => getCityEditorialContent("san-diego", "ca", "usa", "tide");

        expect(await read()).toEqual(editorial);
        mockRenderMemo.clear();
        clock.mockReturnValue(Date.UTC(2026, 10, 27) - 1);
        expect(await read()).toEqual(editorial);
        expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(1);
        expect(nextCache).toHaveBeenCalledWith(expect.any(Function), expect.any(Array), {
          revalidate: 86_400,
          tags: ["city-editorial"],
        });

        mockRenderMemo.clear();
        clock.mockReturnValue(Date.UTC(2026, 10, 27));
        expect(await read()).toEqual(editorial);
        expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(2);
      });

      it.each([
        ["the primary RPC", [mockRpcErrorResponse], null],
        ["the general fallback", [mockRpcNotFoundResponse, mockRpcErrorResponse, mockRpcSuccessResponse], normalizedSanDiegoEditorial],
        ["the Hawaii fallback", [mockRpcNotFoundResponse, mockRpcNotFoundResponse, mockRpcErrorResponse], null],
      ])("preserves the result when %s fails and retries the same lookup", async (_label, responses, editorial) => {
        const logError = jest.spyOn(console, "error").mockImplementation(() => {});
        for (const response of responses) {
          mockSupabaseClient.rpc.mockResolvedValueOnce(response);
        }
        mockSupabaseClient.rpc.mockResolvedValue(mockRpcSuccessResponse);
        const read = () => getCityEditorialContent("waimea-kauai", "hi", "usa");

        expect(await read()).toEqual(editorial);
        expect(logError).toHaveBeenCalledTimes(responses.length === 1 ? 1 : 0);
        expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(responses.length);
        expect(await read()).toEqual(normalizedSanDiegoEditorial);

        mockRenderMemo.clear();
        expect(await read()).toEqual(normalizedSanDiegoEditorial);
        expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(responses.length + 1);
      });

      it("propagates unrelated cache errors and retries without changing the result", async () => {
        const error = new Error("Cache read failed");
        nextCache.mockImplementationOnce(() => async () => { throw error; });
        mockSupabaseClient.rpc.mockResolvedValue(mockRpcSuccessResponse);
        const read = () => getCityEditorialContent("san-diego");

        await expect(read()).rejects.toBe(error);
        expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
        expect(await read()).toEqual(normalizedSanDiegoEditorial);
        expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(1);
      });
    });

    it("does not reuse city-wide Waimea editorial on an island page", async () => {
      mockSupabaseClient.rpc.mockResolvedValue(mockRpcNotFoundResponse);

      const result = await getCityEditorialContent(
        "waimea-kauai", "hi", "usa", null, false,
      );

      expect(result).toBeNull();
      expect(mockSupabaseClient.rpc.mock.calls.every(
        ([, args]) => args.p_city === "waimea-kauai",
      )).toBe(true);
    });

    describe("Success Cases", () => {
      it("should fetch San Diego editorial content successfully", async () => {
        mockSupabaseClient.rpc.mockResolvedValue(mockRpcSuccessResponse);

        const result = await getCityEditorialContent("san-diego", "ca", "usa");

        expect(result).not.toBeNull();
        expect(result?.city_slug).toBe("san-diego");
        expect(result?.city_name).toBe("San Diego");
        expect(result?.region_label).toBe("San Diego County, California");
      });

      it("should call rpc with correct parameters", async () => {
        mockSupabaseClient.rpc.mockResolvedValue(mockRpcSuccessResponse);

        await getCityEditorialContent("san-diego", "ca", "usa");

        expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("get_city_editorial", {
          p_city: "san-diego",
          p_state: "ca",
          p_country: "usa",
          p_intent: undefined,
        });
      });

      it("should use default state and country if not provided", async () => {
        mockSupabaseClient.rpc.mockResolvedValue(mockRpcSuccessResponse);

        await getCityEditorialContent("san-diego");

        expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("get_city_editorial", {
          p_city: "san-diego",
          p_state: "ca",
          p_country: "usa",
          p_intent: undefined,
        });
      });

      it("should request the exact editorial intent", async () => {
        mockSupabaseClient.rpc.mockResolvedValue(mockRpcSuccessResponse);

        await getCityEditorialContent("san-diego", "ca", "usa", "beginner");

        expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("get_city_editorial", {
          p_city: "san-diego",
          p_state: "ca",
          p_country: "usa",
          p_intent: "beginner",
        });
      });

      it("should fetch Orange County editorial content", async () => {
        mockSupabaseClient.rpc.mockResolvedValue({
          data: mockOrangeCountyEditorial,
          error: null,
        });

        const result = await getCityEditorialContent("orange-county", "ca", "usa");

        expect(result).not.toBeNull();
        expect(result?.city_slug).toBe("orange-county");
        expect(result?.city_name).toBe("Orange County");
      });

      it("should derive city_name from slug when DB city_name is empty", async () => {
        mockSupabaseClient.rpc.mockResolvedValue({
          data: { ...mockSanDiegoEditorial, city_name: "" },
          error: null,
        });

        const result = await getCityEditorialContent("san-diego", "ca", "usa");

        expect(result).not.toBeNull();
        expect(result?.city_name).toBe("San Diego");
      });

      it("should derive city_name from slug when DB city_name is whitespace", async () => {
        mockSupabaseClient.rpc.mockResolvedValue({
          data: { ...mockSanDiegoEditorial, city_name: "   " },
          error: null,
        });

        const result = await getCityEditorialContent("san-diego", "ca", "usa");

        expect(result).not.toBeNull();
        expect(result?.city_name).toBe("San Diego");
      });

      it("should return all required fields", async () => {
        mockSupabaseClient.rpc.mockResolvedValue(mockRpcSuccessResponse);

        const result = await getCityEditorialContent("san-diego");

        expect(result).toHaveProperty("id");
        expect(result).toHaveProperty("city_slug");
        expect(result).toHaveProperty("state_slug");
        expect(result).toHaveProperty("country_slug");
        expect(result).toHaveProperty("city_name");
        expect(result).toHaveProperty("region_label");
        expect(result).toHaveProperty("description");
        expect(result).toHaveProperty("session_timing");
        expect(result).toHaveProperty("quick_links");
        expect(result).toHaveProperty("featured_intents");
        expect(result).toHaveProperty("planning_checklist");
        expect(result).toHaveProperty("created_at");
        expect(result).toHaveProperty("updated_at");
      });
    });

    describe("JSONB Field Parsing", () => {
      it("should parse session_timing array correctly", async () => {
        mockSupabaseClient.rpc.mockResolvedValue(mockRpcSuccessResponse);

        const result = await getCityEditorialContent("san-diego");

        expect(Array.isArray(result?.session_timing)).toBe(true);
        expect(result?.session_timing).toHaveLength(3);
        expect(result?.session_timing[0]).toHaveProperty("icon");
        expect(result?.session_timing[0]).toHaveProperty("title");
        expect(result?.session_timing[0]).toHaveProperty("summary");
      });

      it("should parse quick_links array correctly", async () => {
        mockSupabaseClient.rpc.mockResolvedValue(mockRpcSuccessResponse);

        const result = await getCityEditorialContent("san-diego");

        expect(Array.isArray(result?.quick_links)).toBe(true);
        expect(result?.quick_links).toHaveLength(4);
        expect(result?.quick_links[0]).toHaveProperty("label");
        expect(result?.quick_links[0]).toHaveProperty("href");
      });

      it("should parse string-encoded session_timing JSON", async () => {
        mockSupabaseClient.rpc.mockResolvedValue({
          data: mockEditorialWithStringJsonb,
          error: null,
        });

        const result = await getCityEditorialContent("san-diego");

        expect(Array.isArray(result?.session_timing)).toBe(true);
        expect(result?.session_timing).toHaveLength(3);
      });

      it("should parse string-encoded quick_links JSON", async () => {
        mockSupabaseClient.rpc.mockResolvedValue({
          data: mockEditorialWithStringJsonb,
          error: null,
        });

        const result = await getCityEditorialContent("san-diego");

        expect(Array.isArray(result?.quick_links)).toBe(true);
        expect(result?.quick_links).toHaveLength(4);
      });

      it("should default to empty array if session_timing is null", async () => {
        mockSupabaseClient.rpc.mockResolvedValue({
          data: {
            ...mockSanDiegoEditorial,
            session_timing: null,
          },
          error: null,
        });

        const result = await getCityEditorialContent("san-diego");

        expect(Array.isArray(result?.session_timing)).toBe(true);
        expect(result?.session_timing).toHaveLength(0);
      });

      it("should default to empty array if quick_links is null", async () => {
        mockSupabaseClient.rpc.mockResolvedValue({
          data: {
            ...mockSanDiegoEditorial,
            quick_links: null,
          },
          error: null,
        });

        const result = await getCityEditorialContent("san-diego");

        expect(Array.isArray(result?.quick_links)).toBe(true);
        expect(result?.quick_links).toHaveLength(0);
      });
    });

    describe("Not Found Cases", () => {
      it("should return null for city without editorial content", async () => {
        mockSupabaseClient.rpc.mockResolvedValue(mockRpcNotFoundResponse);

        const result = await getCityEditorialContent("unknown-city");

        expect(result).toBeNull();
      });

      it("should return null when data is undefined", async () => {
        mockSupabaseClient.rpc.mockResolvedValue({
          data: undefined,
          error: null,
        });

        const result = await getCityEditorialContent("unknown-city");

        expect(result).toBeNull();
      });
    });

    describe("Error Handling", () => {
      it("should return null on database error", async () => {
        mockSupabaseClient.rpc.mockResolvedValue(mockRpcErrorResponse);

        const result = await getCityEditorialContent("san-diego");

        expect(result).toBeNull();
      });

      it("should log error on database error", async () => {
        const consoleSpy = jest.spyOn(console, "error").mockImplementation();
        mockSupabaseClient.rpc.mockResolvedValue(mockRpcErrorResponse);

        await getCityEditorialContent("san-diego");

        expect(consoleSpy).toHaveBeenCalled();
        expect(consoleSpy.mock.calls[0][0]).toContain("getCityEditorialContent");

        consoleSpy.mockRestore();
      });

      it("should not throw exceptions on error", async () => {
        mockSupabaseClient.rpc.mockResolvedValue(mockRpcErrorResponse);

        await expect(
          getCityEditorialContent("san-diego")
        ).resolves.not.toThrow();
      });

      it("should handle RPC rejection gracefully", async () => {
        mockSupabaseClient.rpc.mockRejectedValue(new Error("Network error"));

        await expect(
          getCityEditorialContent("san-diego")
        ).rejects.toThrow("Network error");
      });
    });

    describe("Type Validation", () => {
      it("should validate SessionTimingModule structure", async () => {
        mockSupabaseClient.rpc.mockResolvedValue(mockRpcSuccessResponse);

        const result = await getCityEditorialContent("san-diego");
        const timing = result?.session_timing[0];

        expect(timing?.icon).toMatch(/^(sun|clock|calendar)$/);
        expect(typeof timing?.title).toBe("string");
        expect(typeof timing?.summary).toBe("string");
      });

      it("should validate QuickLink structure", async () => {
        mockSupabaseClient.rpc.mockResolvedValue(mockRpcSuccessResponse);

        const result = await getCityEditorialContent("san-diego");
        const link = result?.quick_links[0];

        expect(typeof link?.label).toBe("string");
        expect(typeof link?.href).toBe("string");
        expect(link?.href).toMatch(/^\//);
      });

      it("should have description as array of strings", async () => {
        mockSupabaseClient.rpc.mockResolvedValue(mockRpcSuccessResponse);

        const result = await getCityEditorialContent("san-diego");

        expect(Array.isArray(result?.description)).toBe(true);
        result?.description.forEach((desc) => {
          expect(typeof desc).toBe("string");
        });
      });

      it("should have featured_intents as array of strings", async () => {
        mockSupabaseClient.rpc.mockResolvedValue(mockRpcSuccessResponse);

        const result = await getCityEditorialContent("san-diego");

        expect(Array.isArray(result?.featured_intents)).toBe(true);
        result?.featured_intents.forEach((intent) => {
          expect(typeof intent).toBe("string");
        });
      });

      it("should have planning_checklist as array of strings", async () => {
        mockSupabaseClient.rpc.mockResolvedValue(mockRpcSuccessResponse);

        const result = await getCityEditorialContent("san-diego");

        expect(Array.isArray(result?.planning_checklist)).toBe(true);
        result?.planning_checklist.forEach((item) => {
          expect(typeof item).toBe("string");
        });
      });
    });

    describe("Edge Cases", () => {
      it("should handle minimal editorial content", async () => {
        mockSupabaseClient.rpc.mockResolvedValue({
          data: mockMinimalEditorial,
          error: null,
        });

        const result = await getCityEditorialContent("minimal-city");

        expect(result).not.toBeNull();
        expect(result?.description).toEqual([]);
        expect(result?.session_timing).toEqual([]);
        expect(result?.quick_links).toEqual([]);
      });

      it("should preserve timestamp strings", async () => {
        mockSupabaseClient.rpc.mockResolvedValue(mockRpcSuccessResponse);

        const result = await getCityEditorialContent("san-diego");

        expect(result?.created_at).toBe("2024-12-01T00:00:00.000Z");
        expect(result?.updated_at).toBe("2024-12-03T12:00:00.000Z");
      });
    });
  });

  describe("getReviewedCityEditorialContent", () => {
    it("fails closed for malformed JSONB fields", async () => {
      tableChain.select.mockResolvedValue({
        data: [{
          ...mockSanDiegoEditorial,
          editorial_sources: "{not-json",
          session_timing: "{not-json",
          quick_links: "{not-json",
        }],
        error: null,
      });

      const result = await getReviewedCityEditorialContent();

      expect(result).toHaveLength(1);
      expect(result[0]?.editorial_sources).toEqual([]);
      expect(result[0]?.session_timing).toEqual([]);
      expect(result[0]?.quick_links).toEqual([]);
    });
  });

  describe("Supabase Client Creation", () => {
    it("should create Supabase client for getCityEditorialContent", async () => {
      mockSupabaseClient.rpc.mockResolvedValue(mockRpcNotFoundResponse);

      await getCityEditorialContent("san-diego");

      expect(createPublicReadClient).toHaveBeenCalled();
    });

  });
});
