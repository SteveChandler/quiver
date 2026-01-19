/**
 * @jest-environment node
 */

import { GET } from "@/app/api/user/preferences/route";
import {
  createMockSupabaseClient,
  createMockUser,
  setupApiTestEnvironment,
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  mockDatabaseSuccess,
  mockDatabaseError,
} from "@/test-utils/api-test-helpers";

// Mock the Supabase server client
const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@/lib/supabase/server", () => ({
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

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error).toBe("Unauthorized");
    expect(json.timestamp).toBeDefined();
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
    mockDatabaseSuccess(mockSupabaseClient, mockPrefs);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toEqual(mockPrefs);
    expect(json.timestamp).toBeDefined();
  });

  it("returns null data when no preferences exist", async () => {
    const mockUser = createMockUser({ id: "user-123" });

    mockAuthenticatedUser(mockSupabaseClient, mockUser);
    mockDatabaseError(mockSupabaseClient, "No rows", "PGRST116");

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toBeNull();
    expect(json.timestamp).toBeDefined();
  });

  it("returns 500 when database error occurs", async () => {
    const mockUser = createMockUser({ id: "user-123" });

    mockAuthenticatedUser(mockSupabaseClient, mockUser);
    mockDatabaseError(mockSupabaseClient, "Database connection failed", "DB_ERROR");

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toBe("Failed to fetch preferences");
    expect(json.timestamp).toBeDefined();
  });
});
