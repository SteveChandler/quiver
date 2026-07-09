/**
 * @jest-environment node
 */

import { GET } from "@/app/api/user/preferences/route";
import {
  createMockSupabaseClient,
  createMockUser,
  createMockRequest,
  setupApiTestEnvironment,
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  mockDatabaseSuccess,
  mockDatabaseError,
} from "@/test-utils/api-test-helpers";

function normalizeSelect(select: string): string {
  return select.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim();
}

// Mock the Supabase server client (withAuth uses createSupabaseServerClient)
const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseClient),
  createAPIServerClient: jest.fn(() => mockSupabaseClient),
}));

describe("GET /api/user/preferences", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup?.();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockUnauthenticatedUser(mockSupabaseClient);

    const request = createMockRequest("GET", "http://localhost:3000/api/user/preferences");
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error).toBe("Authentication required");
    expect(json.timestamp).toEqual(expect.any(String));
  });

  it("returns user preferences when authenticated", async () => {
    const mockUser = createMockUser({ id: "user-123" });
    const mockPrefs = {
      wave_min_ft: 3,
      wave_max_ft: 5,
      confidence: 0.8,
      sample_size: 15,
    };

    mockAuthenticatedUser(mockSupabaseClient, mockUser);
    const preferenceSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({ data: mockPrefs, error: null }),
      }),
    });
    mockSupabaseClient.from.mockReturnValue({
      select: preferenceSelect,
    } as any);

    const request = createMockRequest("GET", "http://localhost:3000/api/user/preferences");
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toEqual(mockPrefs);
    expect(json.timestamp).toEqual(expect.any(String));
    expect(normalizeSelect(preferenceSelect.mock.calls[0][0])).toBe(
      "wave_min_ft, wave_max_ft, wave_period_min_s, wave_period_max_s, max_wind_mph, preferred_wind_directions, preferred_tide_statuses, confidence, sample_size, eligible_session_count, avoidance_by_beach, validated_at, manual_override"
    );
  });

  it("returns null data when no preferences exist", async () => {
    const mockUser = createMockUser({ id: "user-123" });

    mockAuthenticatedUser(mockSupabaseClient, mockUser);
    mockDatabaseSuccess(mockSupabaseClient, null);

    const request = createMockRequest("GET", "http://localhost:3000/api/user/preferences");
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toBeNull();
    expect(json.timestamp).toEqual(expect.any(String));
  });

  it("returns 500 when database error occurs", async () => {
    const mockUser = createMockUser({ id: "user-123" });

    mockAuthenticatedUser(mockSupabaseClient, mockUser);
    mockDatabaseError(mockSupabaseClient, "Database connection failed", "DB_ERROR");

    const request = createMockRequest("GET", "http://localhost:3000/api/user/preferences");
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toBe("Failed to fetch preferences");
    expect(json.timestamp).toEqual(expect.any(String));
  });
});
