import { toggleSessionLike } from "@/actions/like-actions";

// Mocks
const mockSupabase: any = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(),
};

const mockCreditAuthorWithXP = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => mockSupabase,
}));

jest.mock("@/lib/gamification-actions", () => ({
  creditAuthorWithXP: (...args: any[]) => mockCreditAuthorWithXP(...args),
}));

// Helper builders for common chains
function makeSelectChain(final: any) {
  return {
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(async () => final),
          single: jest.fn(async () => final),
        })),
        single: jest.fn(async () => final),
      })),
      single: jest.fn(async () => final),
    })),
  } as any;
}

function makeDeleteChain(result: any = { error: null }) {
  return {
    delete: jest.fn(() => ({
      eq: jest.fn(async () => result),
    })),
  } as any;
}

function makeInsertChain(result: any = { error: null }) {
  return {
    insert: jest.fn(async () => result),
  } as any;
}

describe("toggleSessionLike → author XP crediting", () => {
  const liker = { id: "user-liker" };
  const sessionId = "sess-1";

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: liker },
      error: null,
    });
  });

  it("likes a session and credits the author when liker != author", async () => {
    // Implement robust per-table chain behavior
    let likesCall = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "session_likes") {
        // First call → check existing like
        if (likesCall++ === 0) {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          } as any;
        }
        // Second call → insert like
        return {
          insert: async () => ({ error: null }),
        } as any;
      }
      if (table === "sessions") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { user_id: "author-1" }, error: null }),
            }),
          }),
        } as any;
      }
      return {} as any;
    });

    const res = await toggleSessionLike(sessionId);
    // Debug on failure
    if (!res?.success) {
      // eslint-disable-next-line no-console
      console.error('toggleSessionLike failure:', res);
    }
    expect(res.success).toBe(true);
    expect(res.liked).toBe(true);
    expect(mockCreditAuthorWithXP).toHaveBeenCalledWith(
      "author-1",
      "session",
      sessionId
    );
  });

  it("unlikes a previously liked session and does not credit XP", async () => {
    const alreadyLiked = { data: { id: "like-1" }, error: null };
    const delOK = { error: null };

    mockSupabase.from
      .mockReturnValueOnce(makeSelectChain(alreadyLiked)) // existing like
      .mockReturnValueOnce(makeDeleteChain(delOK)); // delete like

    const res = await toggleSessionLike(sessionId);

    expect(res.success).toBe(true);
    expect(res.liked).toBe(false);
    expect(mockCreditAuthorWithXP).not.toHaveBeenCalled();
  });

  it("does not credit XP for self-like (author == liker)", async () => {
    const notLiked = { data: null, error: null };
    const insertOK = { error: null };
    const selfAuthor = { data: { user_id: liker.id }, error: null };

    mockSupabase.from
      .mockReturnValueOnce(makeSelectChain(notLiked))
      .mockReturnValueOnce(makeInsertChain(insertOK))
      .mockReturnValueOnce(makeSelectChain(selfAuthor));

    const res = await toggleSessionLike(sessionId);
    expect(res.success).toBe(true);
    expect(res.liked).toBe(true);
    expect(mockCreditAuthorWithXP).not.toHaveBeenCalled();
  });
});
