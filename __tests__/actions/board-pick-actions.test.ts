/**
 * @jest-environment node
 */
import { getBoardPickContext } from "@/actions/board-pick-actions";
import { fetchUserBoardContext } from "@/lib/services/discovery/surf-discovery-orchestrator";

jest.mock("@/lib/services/discovery/surf-discovery-orchestrator", () => ({
  fetchUserBoardContext: jest.fn(),
}));

let entitlementRow: Record<string, unknown> | null = null;
const fakeSupabase = {
  from: jest.fn(() => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: entitlementRow, error: null }) }),
    }),
  })),
};

jest.mock("@/lib/server-action-utils", () => ({
  withAuthenticatedAction: (fn: (user: unknown, supabase: unknown) => Promise<unknown>) =>
    fn({ id: "user-1" }, fakeSupabase).then((data) => ({ success: true, data })),
}));

const mockFetchUserBoardContext = fetchUserBoardContext as jest.Mock;

describe("getBoardPickContext", () => {
  const originalFlag = process.env.BOARD_PICKS_FREE_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.BOARD_PICKS_FREE_ENABLED;
    mockFetchUserBoardContext.mockResolvedValue({
      dominantBoardClass: "fish",
      boardClasses: ["fish"],
      boardsForPicks: [{ id: "board-1", name: "Fish", board_type: "fish", sessions: [] }],
    });
  });

  afterAll(() => {
    if (originalFlag === undefined) delete process.env.BOARD_PICKS_FREE_ENABLED;
    else process.env.BOARD_PICKS_FREE_ENABLED = originalFlag;
  });

  it("loads board history for Pro users, the same gate discovery uses", async () => {
    entitlementRow = { is_pro: true, is_trialing: false, billing_issue: false, expires_at: null };

    const result = await getBoardPickContext();

    expect(mockFetchUserBoardContext).toHaveBeenCalledWith(fakeSupabase, "user-1", true);
    expect(result.data).toEqual({
      boardClasses: ["fish"],
      boardsForPicks: [{ id: "board-1", name: "Fish", board_type: "fish", sessions: [] }],
    });
  });

  it("gates picks off for free users unless the free board-picks flag is on", async () => {
    entitlementRow = null;

    await getBoardPickContext();
    expect(mockFetchUserBoardContext).toHaveBeenLastCalledWith(fakeSupabase, "user-1", false);

    process.env.BOARD_PICKS_FREE_ENABLED = "true";
    await getBoardPickContext();
    expect(mockFetchUserBoardContext).toHaveBeenLastCalledWith(fakeSupabase, "user-1", true);
  });
});
