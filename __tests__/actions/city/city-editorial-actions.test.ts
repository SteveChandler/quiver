/**
 * Tests for City Editorial Actions
 *
 * Tests the server actions for fetching city editorial content from Supabase.
 * Priority 1 test coverage for San Diego page redesign.
 */

import {
  getCityEditorialContent,
  hasCityEditorialContent,
} from "@/actions/city/city-editorial-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  createSupabaseServerClient: jest.fn(),
}));

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
    tableChain = makeChain();

    mockSupabaseClient = {
      rpc: jest.fn(),
      from: jest.fn(() => tableChain),
    };

    (createSupabaseServerClient as jest.Mock).mockResolvedValue(
      mockSupabaseClient
    );
  });

  describe("getCityEditorialContent", () => {
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
        });
      });

      it("should use default state and country if not provided", async () => {
        mockSupabaseClient.rpc.mockResolvedValue(mockRpcSuccessResponse);

        await getCityEditorialContent("san-diego");

        expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("get_city_editorial", {
          p_city: "san-diego",
          p_state: "ca",
          p_country: "usa",
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

  describe("hasCityEditorialContent", () => {
    describe("Success Cases", () => {
      it("should return true for city with editorial content", async () => {
        tableChain.maybeSingle.mockResolvedValue(mockTableExistsResponse);

        const result = await hasCityEditorialContent("san-diego", "ca", "usa");

        expect(result).toBe(true);
      });

      it("should return false for city without editorial content", async () => {
        tableChain.maybeSingle.mockResolvedValue(mockTableNotExistsResponse);

        const result = await hasCityEditorialContent("unknown-city", "ca", "usa");

        expect(result).toBe(false);
      });

      it("should call table query with correct filters", async () => {
        tableChain.maybeSingle.mockResolvedValue(mockTableExistsResponse);

        await hasCityEditorialContent("san-diego", "ca", "usa");

        expect(mockSupabaseClient.from).toHaveBeenCalledWith("city_editorial_content");
        expect(tableChain.select).toHaveBeenCalledWith("id");
        expect(tableChain.eq).toHaveBeenCalledWith("city_slug", "san-diego");
        expect(tableChain.eq).toHaveBeenCalledWith("state_slug", "ca");
        expect(tableChain.eq).toHaveBeenCalledWith("country_slug", "usa");
      });

      it("should use default state and country if not provided", async () => {
        tableChain.maybeSingle.mockResolvedValue(mockTableExistsResponse);

        await hasCityEditorialContent("san-diego");

        expect(tableChain.eq).toHaveBeenCalledWith("state_slug", "ca");
        expect(tableChain.eq).toHaveBeenCalledWith("country_slug", "usa");
      });
    });

    describe("Error Handling", () => {
      it("should return false on database error", async () => {
        tableChain.maybeSingle.mockResolvedValue(mockRpcErrorResponse);

        const result = await hasCityEditorialContent("san-diego");

        expect(result).toBe(false);
      });

      it("should log error on database error", async () => {
        const consoleSpy = jest.spyOn(console, "error").mockImplementation();
        tableChain.maybeSingle.mockResolvedValue(mockRpcErrorResponse);

        await hasCityEditorialContent("san-diego");

        expect(consoleSpy).toHaveBeenCalled();
        expect(consoleSpy.mock.calls[0][0]).toContain("hasCityEditorialContent");

        consoleSpy.mockRestore();
      });

      it("should not throw exceptions on error", async () => {
        tableChain.maybeSingle.mockResolvedValue(mockRpcErrorResponse);

        await expect(
          hasCityEditorialContent("san-diego")
        ).resolves.not.toThrow();
      });
    });

    describe("Return Value Types", () => {
      it("should return boolean true when content exists", async () => {
        tableChain.maybeSingle.mockResolvedValue(mockTableExistsResponse);

        const result = await hasCityEditorialContent("san-diego");

        expect(typeof result).toBe("boolean");
        expect(result).toBe(true);
      });

      it("should return boolean false when content does not exist", async () => {
        tableChain.maybeSingle.mockResolvedValue(mockTableNotExistsResponse);

        const result = await hasCityEditorialContent("unknown-city");

        expect(typeof result).toBe("boolean");
        expect(result).toBe(false);
      });
    });
  });

  describe("Supabase Client Creation", () => {
    it("should create Supabase client for getCityEditorialContent", async () => {
      mockSupabaseClient.rpc.mockResolvedValue(mockRpcNotFoundResponse);

      await getCityEditorialContent("san-diego");

      expect(createSupabaseServerClient).toHaveBeenCalled();
    });

    it("should create Supabase client for hasCityEditorialContent", async () => {
      tableChain.maybeSingle.mockResolvedValue(mockTableNotExistsResponse);

      await hasCityEditorialContent("san-diego");

      expect(createSupabaseServerClient).toHaveBeenCalled();
    });
  });
});
