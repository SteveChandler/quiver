/**
 * @jest-environment node
 *
 * Tests for the Beach Daily Intel API route.
 *
 * This route is critical for the Surf Intel feature, which provides
 * personalized surfing recommendations based on forecast data and user preferences.
 *
 * Key fix tested here: The route now uses per-beach local dates (via getLocalDateString)
 * to avoid UTC date mismatches that caused "Intel not available" after 4pm PT.
 */

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(),
}));

const mockGetDailyIntelWaveHeightLabels = jest.fn();
const mockEvaluateMajorEventHoldCandidates = jest.fn();
const mockGetProfileExperienceLevel = jest.fn();
const NO_STORE = "private, no-store, no-cache, must-revalidate";
jest.mock("@/lib/services/intel/wave-height-labels", () => ({
  getDailyIntelWaveHeightLabels: (...args: unknown[]) =>
    mockGetDailyIntelWaveHeightLabels(...args),
}));

jest.mock("@/lib/profile/skill-level", () => ({
  getProfileExperienceLevel: (...args: unknown[]) =>
    mockGetProfileExperienceLevel(...args),
  getVerifiedProfileExperience: async (supabase: any) => {
    try {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (error || !user) return { userId: null, profileExperience: null };
      return {
        userId: user.id,
        profileExperience: await mockGetProfileExperienceLevel(supabase, user.id),
      };
    } catch {
      return { userId: null, profileExperience: null };
    }
  },
}));

jest.mock("@/lib/recommendations/major-event-hold/service", () => ({
  evaluateMajorEventHoldCandidates: (input: unknown) =>
    mockEvaluateMajorEventHoldCandidates(input),
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/beach-daily-intel/route";
import { createSupabaseServerClient } from "@/lib/supabase/server";

describe("/api/beach-daily-intel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDailyIntelWaveHeightLabels.mockResolvedValue({
      current_wave_height_label: null,
      best_window_wave_height_label: null,
    });
    mockGetProfileExperienceLevel.mockResolvedValue(null);
    mockEvaluateMajorEventHoldCandidates.mockImplementation(
      ({
        candidates,
      }: {
        candidates: Array<{ candidateId?: string } | null>;
      }) =>
        Promise.resolve(
          candidates.map((candidate) => ({
            candidateId: candidate?.candidateId ?? null,
            evaluation: {
              outcome: "allow",
              holdIds: [],
              holdEpoch: "ordinary-epoch",
            },
            recommendationAvailability: {
              state: "available",
              holdEpoch: "ordinary-epoch",
            },
          })),
        ),
    );
  });

  describe("input validation", () => {
    it("returns 400 for missing beachId parameter", async () => {
      const req = new NextRequest(
        new URL(
          "http://localhost/api/beach-daily-intel?forecastDate=2026-01-06",
        ),
      );
      const res = await GET(req);
      expect(res.status).toBe(400);
      expect(res.headers.get("Cache-Control")).toBe(NO_STORE);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Invalid query parameters");
    });

    it("does not create a Supabase client for invalid query parameters", async () => {
      const req = new NextRequest(
        new URL(
          "http://localhost/api/beach-daily-intel?beachId=invalid&forecastDate=2026-01-06",
        ),
      );

      const res = await GET(req);

      expect(res.status).toBe(400);
      expect(createSupabaseServerClient).not.toHaveBeenCalled();
    });

    it("returns 400 for missing forecastDate parameter", async () => {
      const req = new NextRequest(
        new URL(
          "http://localhost/api/beach-daily-intel?beachId=11111111-1111-4111-8111-111111111111",
        ),
      );
      const res = await GET(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Invalid query parameters");
    });

    it("returns 400 for both missing params", async () => {
      const req = new NextRequest(
        new URL("http://localhost/api/beach-daily-intel"),
      );
      const res = await GET(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("returns 400 for invalid beachId (not a UUID)", async () => {
      const req = new NextRequest(
        new URL(
          "http://localhost/api/beach-daily-intel?beachId=not-a-uuid&forecastDate=2026-01-06",
        ),
      );
      const res = await GET(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Invalid query parameters");
    });

    it("returns 400 for invalid forecastDate format (not YYYY-MM-DD)", async () => {
      const req = new NextRequest(
        new URL(
          "http://localhost/api/beach-daily-intel?beachId=11111111-1111-4111-8111-111111111111&forecastDate=01/06/2026",
        ),
      );
      const res = await GET(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Invalid query parameters");
    });

    it("returns 400 for invalid forecastDate format (missing leading zeros)", async () => {
      const req = new NextRequest(
        new URL(
          "http://localhost/api/beach-daily-intel?beachId=11111111-1111-4111-8111-111111111111&forecastDate=2026-1-6",
        ),
      );
      const res = await GET(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("accepts valid UUID and date format", async () => {
      const chain: any = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        order: jest.fn(() => chain),
        limit: jest.fn(() => chain),
        maybeSingle: jest.fn(async () => ({ data: null, error: null })),
      };
      const mockSupabase = {
        from: jest.fn(() => chain),
      };
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(
        mockSupabase as any,
      );

      const req = new NextRequest(
        new URL(
          "http://localhost/api/beach-daily-intel?beachId=11111111-1111-4111-8111-111111111111&forecastDate=2026-01-06",
        ),
      );

      const res = await GET(req);
      expect(res.status).toBe(200);
    });
  });

  describe("successful data retrieval", () => {
    it("uses the authoritative beach timezone and clears held positive prose after labels", async () => {
      const beachId = "11111111-1111-4111-8111-111111111111";
      const intelRow = {
        id: "intel-row-1",
        beach_id: beachId,
        forecast_date: "2026-07-19",
        best_window_start: "06:00:00",
        best_window_end: "09:00:00",
        conditions_score: 88,
        confidence: "high",
        recommendation: "Go surf now",
        best_window_description: "A perfect morning window",
        surf_min_ft: 3,
        surf_max_ft: 5,
        raw_intel_data: {
          recommendation: "Internal positive prose",
          narrative: "Do not leak this",
          surf: { min: 3, max: 5, dominant: "3-5 ft" },
        },
        beaches: { timezone: "Pacific/Honolulu" },
      };
      const chain: any = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        order: jest.fn(() => chain),
        limit: jest.fn(() => chain),
        maybeSingle: jest.fn(async () => ({ data: intelRow, error: null })),
      };
      const mockSupabase = {
        auth: {
          getUser: jest.fn(async () => ({ data: { user: null }, error: null })),
        },
        from: jest.fn(() => chain),
      };
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(
        mockSupabase as any,
      );
      mockGetDailyIntelWaveHeightLabels.mockResolvedValue({
        current_wave_height_label: "3-5ft",
        best_window_wave_height_label: "4-5ft",
      });
      mockEvaluateMajorEventHoldCandidates.mockImplementationOnce(
        ({ candidates }: { candidates: Array<{ candidateId: string }> }) =>
          Promise.resolve(
            candidates.map(({ candidateId }) => ({
              candidateId,
              evaluation: {
                outcome: "explicit_none",
                reasonCode: "major_event_hold",
                holdIds: ["internal-hold-id"],
                expiresAt: "2026-07-20T00:00:00.000Z",
                holdEpoch: "blocked-epoch",
              },
              recommendationAvailability: {
                state: "none",
                reasonCode: "major_event_hold",
                expiresAt: "2026-07-20T00:00:00.000Z",
                holdEpoch: "blocked-epoch",
              },
            })),
          ),
      );

      const response = await GET(
        new NextRequest(
          new URL(
            `http://localhost/api/beach-daily-intel?beachId=${beachId}&forecastDate=2026-07-19`,
          ),
        ),
      );
      const body = await response.json();

      expect(chain.select).toHaveBeenCalledWith(
        expect.stringContaining("beaches!inner"),
      );
      expect(mockEvaluateMajorEventHoldCandidates).toHaveBeenCalledWith({
        candidates: [
          {
            candidateId: "daily-intel:intel-row-1",
            beachId,
            startsAt: "2026-07-19T16:00:00.000Z",
            endsAt: "2026-07-19T19:00:00.000Z",
          },
        ],
        profileExperience: null,
      });
      expect(body.data.intel).toMatchObject({
        surf_min_ft: 3,
        surf_max_ft: 5,
        conditions_score: null,
        confidence: null,
        recommendation: null,
        best_window_start: null,
        best_window_end: null,
        best_window_description: null,
        best_window_wave_height_label: null,
        raw_intel_data: {
          surf: { min: 3, max: 5, dominant: "3-5 ft" },
        },
        recommendationAvailability: {
          state: "none",
          reasonCode: "major_event_hold",
        },
      });
      expect(JSON.stringify(body)).not.toMatch(
        /internal-hold-id|Internal positive prose|Do not leak this|holdIds|evaluation/,
      );
      expect(response.headers.get("Cache-Control")).toBe(NO_STORE);
    });

    it("returns latest intel record for valid params", async () => {
      const intelRow = {
        beach_id: "11111111-1111-4111-8111-111111111111",
        forecast_date: "2026-01-06",
        generation_time: "06:00",
        generated_at: "2026-01-06T14:00:00.000Z",
        summary: "Great conditions for morning surf!",
        best_time_range: "08:00-10:00",
        confidence_score: 0.85,
      };

      const chain: any = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        order: jest.fn(() => chain),
        limit: jest.fn(() => chain),
        maybeSingle: jest.fn(async () => ({ data: intelRow, error: null })),
      };
      const mockSupabase = {
        from: jest.fn(() => chain),
      };
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(
        mockSupabase as any,
      );

      const req = new NextRequest(
        new URL(
          "http://localhost/api/beach-daily-intel?beachId=11111111-1111-4111-8111-111111111111&forecastDate=2026-01-06",
        ),
      );

      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.intel).toMatchObject({
        beach_id: intelRow.beach_id,
        forecast_date: intelRow.forecast_date,
        generation_time: intelRow.generation_time,
        summary: intelRow.summary,
        best_time_range: intelRow.best_time_range,
        confidence_score: intelRow.confidence_score,
      });
    });

    it("merges computed forecast wave-height labels into the intel response", async () => {
      const beachId = "11111111-1111-4111-8111-111111111111";
      const forecastDate = "2026-01-06";
      const intelRow = {
        id: "intel-label-row",
        beach_id: beachId,
        forecast_date: forecastDate,
        best_window_start: "06:00:00",
        best_window_end: "09:00:00",
        surf_min_ft: 1,
        surf_max_ft: 5,
        beaches: { timezone: "America/Los_Angeles" },
      };

      mockGetDailyIntelWaveHeightLabels.mockResolvedValue({
        current_wave_height_label: "2-3ft",
        best_window_wave_height_label: "3-4ft",
      });

      const chain: any = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        order: jest.fn(() => chain),
        limit: jest.fn(() => chain),
        maybeSingle: jest.fn(async () => ({ data: intelRow, error: null })),
      };
      const mockSupabase = {
        from: jest.fn(() => chain),
      };
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(
        mockSupabase as any,
      );

      const req = new NextRequest(
        new URL(
          `http://localhost/api/beach-daily-intel?beachId=${beachId}&forecastDate=${forecastDate}`,
        ),
      );

      const res = await GET(req);
      const json = await res.json();

      expect(json.data.intel).toMatchObject({
        surf_min_ft: 1,
        surf_max_ft: 5,
        current_wave_height_label: "2-3ft",
        best_window_wave_height_label: "3-4ft",
      });
      expect(mockGetDailyIntelWaveHeightLabels).toHaveBeenCalledWith(
        mockSupabase,
        beachId,
        forecastDate,
        {
          bestWindowStart: "06:00:00",
          bestWindowEnd: "09:00:00",
        },
        // The best window is beach-local wall clock, so the beach timezone has
        // to reach the label query or it resolves the window against UTC.
        "America/Los_Angeles",
      );
    });

    it("returns null intel when no data found (not a 404)", async () => {
      const chain: any = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        order: jest.fn(() => chain),
        limit: jest.fn(() => chain),
        maybeSingle: jest.fn(async () => ({ data: null, error: null })),
      };
      const mockSupabase = {
        from: jest.fn(() => chain),
      };
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(
        mockSupabase as any,
      );

      const req = new NextRequest(
        new URL(
          "http://localhost/api/beach-daily-intel?beachId=11111111-1111-4111-8111-111111111111&forecastDate=2026-01-06",
        ),
      );

      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.intel).toBeNull();
    });
  });

  describe("response structure", () => {
    it("returns data in standardized success format", async () => {
      const chain: any = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        order: jest.fn(() => chain),
        limit: jest.fn(() => chain),
        maybeSingle: jest.fn(async () => ({ data: null, error: null })),
      };
      const mockSupabase = {
        from: jest.fn(() => chain),
      };
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(
        mockSupabase as any,
      );

      const req = new NextRequest(
        new URL(
          "http://localhost/api/beach-daily-intel?beachId=11111111-1111-4111-8111-111111111111&forecastDate=2026-01-06",
        ),
      );

      const res = await GET(req);
      const json = await res.json();

      // Standard API response structure
      expect(json).toHaveProperty("success");
      expect(json).toHaveProperty("data");
      expect(json.data).toHaveProperty("intel");
    });

    it("includes error details in validation failure response", async () => {
      const req = new NextRequest(
        new URL(
          "http://localhost/api/beach-daily-intel?beachId=invalid&forecastDate=2026-01-06",
        ),
      );

      const res = await GET(req);
      const json = await res.json();

      expect(json.success).toBe(false);
      expect(json).toHaveProperty("error");
      expect(json).toHaveProperty("details");
      expect(Array.isArray(json.details)).toBe(true);
    });
  });

  describe("database query verification", () => {
    it("queries beach_daily_intel table with correct filters", async () => {
      const beachId = "22222222-2222-4222-8222-222222222222";
      const forecastDate = "2024-12-05";

      const chain: any = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        order: jest.fn(() => chain),
        limit: jest.fn(() => chain),
        maybeSingle: jest.fn(async () => ({ data: null, error: null })),
      };
      const mockSupabase = {
        from: jest.fn(() => chain),
      };
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(
        mockSupabase as any,
      );

      const req = new NextRequest(
        new URL(
          `http://localhost/api/beach-daily-intel?beachId=${beachId}&forecastDate=${forecastDate}`,
        ),
      );

      await GET(req);

      // Verify query chain
      expect(mockSupabase.from).toHaveBeenCalledWith("beach_daily_intel");
      expect(chain.select).toHaveBeenCalledWith(
        expect.stringContaining("best_window_start"),
      );
      expect(chain.eq).toHaveBeenCalledWith("beach_id", beachId);
      expect(chain.eq).toHaveBeenCalledWith("forecast_date", forecastDate);
      expect(chain.order).toHaveBeenCalledWith("generated_at", {
        ascending: false,
      });
      expect(chain.limit).toHaveBeenCalledWith(1);
      expect(chain.maybeSingle).toHaveBeenCalled();
    });

    it("orders results by generated_at DESC to get latest intel", async () => {
      const chain: any = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        order: jest.fn(() => chain),
        limit: jest.fn(() => chain),
        maybeSingle: jest.fn(async () => ({ data: null, error: null })),
      };
      const mockSupabase = {
        from: jest.fn(() => chain),
      };
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(
        mockSupabase as any,
      );

      const req = new NextRequest(
        new URL(
          "http://localhost/api/beach-daily-intel?beachId=11111111-1111-4111-8111-111111111111&forecastDate=2026-01-06",
        ),
      );

      await GET(req);

      expect(chain.order).toHaveBeenCalledWith("generated_at", {
        ascending: false,
      });
    });
  });

  describe("error handling", () => {
    it("handles database errors gracefully", async () => {
      const chain: any = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        order: jest.fn(() => chain),
        limit: jest.fn(() => chain),
        maybeSingle: jest.fn(async () => ({
          data: null,
          error: { message: "Database connection failed" },
        })),
      };
      const mockSupabase = {
        from: jest.fn(() => chain),
      };
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(
        mockSupabase as any,
      );

      const req = new NextRequest(
        new URL(
          "http://localhost/api/beach-daily-intel?beachId=11111111-1111-4111-8111-111111111111&forecastDate=2026-01-06",
        ),
      );

      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      try {
        const res = await GET(req);
        expect(res.status).toBe(500);
        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error).toBe("Failed to load beach daily intel");
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "API Error:",
          "Unknown error",
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });
  });

  describe("regression tests for UTC date mismatch bug", () => {
    it("accepts local date string matching beach timezone (not UTC date)", async () => {
      // Critical: The forecastDate should be the beach's LOCAL date,
      // not the UTC date. This is what getLocalDateString() provides.
      // For example, at 11 PM PT Dec 5, UTC is Dec 6, but forecastDate should be 2024-12-05
      const chain: any = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        order: jest.fn(() => chain),
        limit: jest.fn(() => chain),
        maybeSingle: jest.fn(async () => ({
          data: {
            beach_id: "33333333-3333-4333-8333-333333333333",
            forecast_date: "2024-12-05", // Beach local date
            generated_at: "2024-12-06T07:00:00Z", // 11 PM PT Dec 5
            summary: "Evening conditions still good",
          },
          error: null,
        })),
      };
      const mockSupabase = {
        from: jest.fn(() => chain),
      };
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(
        mockSupabase as any,
      );

      const req = new NextRequest(
        new URL(
          "http://localhost/api/beach-daily-intel?beachId=33333333-3333-4333-8333-333333333333&forecastDate=2024-12-05",
        ),
      );

      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.intel).toMatchObject({ forecast_date: "2024-12-05" });
    });

    it("validates that forecastDate uses YYYY-MM-DD format (as getLocalDateString returns)", async () => {
      // Ensure the API enforces the format that getLocalDateString produces
      const req = new NextRequest(
        new URL(
          "http://localhost/api/beach-daily-intel?beachId=11111111-1111-4111-8111-111111111111&forecastDate=2024-12-5",
        ),
      );

      const res = await GET(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });
});
