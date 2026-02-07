import { creditAuthorWithXP } from "@/lib/gamification";

// Build a finely controlled supabase service-role mock
const mockSupabase: any = {
  from: jest.fn(),
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => mockSupabase,
}));

function chainSelectSingle(final: any) {
  return {
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(async () => final),
          })),
          single: jest.fn(async () => final),
        })),
        single: jest.fn(async () => final),
      })),
      single: jest.fn(async () => final),
      in: jest.fn(async () => final),
      order: jest.fn(async () => final),
    })),
  } as any;
}

function chainUpdateOK() {
  return {
    update: jest.fn(() => ({
      eq: jest.fn(async () => ({ error: null })),
    })),
  } as any;
}

function chainInsertOK() {
  return {
    insert: jest.fn(async () => ({ error: null })),
  } as any;
}

describe("creditAuthorWithXP", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("skips when XP already credited for this entity (idempotent)", async () => {
    // existing event present
    const existingEvent = { data: { id: "evt-1" }, error: null };
    mockSupabase.from.mockReturnValueOnce(chainSelectSingle(existingEvent)); // xp_events check

    const res = await creditAuthorWithXP("author-1", "session", "sess-1");
    expect(res.success).toBe(true);
    expect(String(res.message)).toMatch(/already credited/i);

    // Should not attempt to update XP or insert new event after early return
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(mockSupabase.from).toHaveBeenCalledWith("xp_events");
  });

  it("awards XP and updates level, recording an xp_event", async () => {
    // No prior event
    const noEvent = { data: null, error: null };
    mockSupabase.from
      .mockReturnValueOnce(chainSelectSingle(noEvent)) // xp_events check
      // initializeUserXP: select existing user_xp
      .mockReturnValueOnce(chainSelectSingle({ data: { id: "uxp-1" }, error: null }))
      // current XP fetch
      .mockReturnValueOnce(chainSelectSingle({ data: { xp_total: 90, level: 1 }, error: null }))
      // update user_xp
      .mockReturnValueOnce(chainUpdateOK())
      // insert xp_event
      .mockReturnValueOnce(chainInsertOK());

    const res = await creditAuthorWithXP("author-1", "session", "sess-1");
    expect(res.success).toBe(true);
    expect(res.xp_gained).toBe(10); // get_like_upvote = 10
    expect(res.total_xp).toBe(100);
    expect(res.level_up).toBe(true);
    expect(res.new_level).toBe(2);
    expect(res.level_title).toBe("Grom");
  });
});

