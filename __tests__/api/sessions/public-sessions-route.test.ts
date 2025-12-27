/**
 * @jest-environment node
 */

import {
  createMockRequest,
  createMockSupabaseClient,
  expectSuccessResponse,
} from "@/test-utils/api-test-helpers";

jest.mock("@/lib/middleware/rate-limiter", () => ({
  withBotBlockingAndRateLimit: (handler: any) => handler,
}));

const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseClient),
}));

// Import after mocks
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET } = require("@/app/api/sessions/public/route");

describe("/api/sessions/public", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns public sessions without leaking author name/avatar or rating", async () => {
    const profileId = "550e8400-e29b-41d4-a716-446655440000";

    const countChain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      then: jest.fn((onResolve: any) =>
        onResolve({ count: 1, data: null, error: null })
      ),
    };

    const dataChain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      then: jest.fn((onResolve: any) =>
        onResolve({
          data: [
            {
              id: "session-1",
              beach_name: "Ocean Beach",
              beach_id: "beach-1",
              arrival_time: "2025-01-01T08:00:00.000Z",
              rating: 5, // intentionally present in DB row; should not be exposed by API
              wave_quality: 4,
              wave_height: 3,
              notes: "Great waves",
              description: null,
              image_url: null,
              likes_count: 2,
              created_at: "2025-01-01T10:00:00.000Z",
              profile_id: profileId,
              duration_minutes: 90,
              crowd_level: 3,
              water_temp: 62,
              profiles: {
                id: profileId,
                full_name: "Should Not Leak",
                avatar_url: "/should-not-leak.jpg",
              },
              session_media: [],
            },
          ],
          error: null,
        })
      ),
    };

    let call = 0;
    (mockSupabaseClient as any).from.mockImplementation((table: string) => {
      expect(table).toBe("sessions");
      call += 1;
      return call === 1 ? countChain : dataChain;
    });

    const req = createMockRequest(
      "GET",
      "http://localhost:3000/api/sessions/public?page=1&limit=10"
    );
    const res = await GET(req as any);
    const payload = await expectSuccessResponse<any[]>(res, 200);

    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data).toHaveLength(1);

    const item = payload.data[0];
    expect(item).toMatchObject({
      id: "session-1",
      beachName: "Ocean Beach",
      author: { id: profileId },
    });

    // No rating in API payload
    expect(item).not.toHaveProperty("rating");

    // No author identifying fields
    expect(item.author).not.toHaveProperty("name");
    expect(item.author).not.toHaveProperty("avatar");
  });
});


