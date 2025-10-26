import { describe, test, expect, beforeAll, jest } from "@jest/globals";

let createIntelPost: typeof import("@/actions/intel-actions")["createIntelPost"];

const createSupabaseMock = () => {
  const supabase = {
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn(),
    update: jest.fn().mockReturnThis(),
    single: jest.fn(),
    rpc: jest.fn(),
  };
  return supabase;
};

beforeAll(async () => {
  ({ createIntelPost } = await import("@/actions/intel-actions"));
});

describe("createIntelPost deduplication", () => {
  test("rejects duplicate intel within dedupe window", async () => {
    const supabase = createSupabaseMock();
    const existingRow = {
      id: "intel-existing",
      title: "Found an easy spot near Birdrock",
      description:
        "Rolled up around 10:29AM for the morning window and found a spot in about 6 minutes.",
      lat: 32.8,
      lon: -117.3,
      created_at: new Date().toISOString(),
    };

    supabase.limit.mockResolvedValueOnce({ data: [existingRow], error: null });

    const result = await createIntelPost(
      {
        lat: existingRow.lat,
        lon: existingRow.lon,
        tag: "parking" as any,
        title: existingRow.title,
        description: existingRow.description,
        beach_id: "beach-123",
      },
      {
        authWrapper: async (fn: any) => fn({ id: "user-abc" }, supabase),
      }
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already shared/i);
    expect(supabase.insert).not.toHaveBeenCalled();
  });
});
