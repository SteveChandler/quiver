/**
 * @jest-environment node
 */
import { getBoardPickContext } from "@/actions/board-pick-actions";
import { fetchUserBoardContext } from "@/lib/services/discovery/surf-discovery-orchestrator";

jest.mock("@/lib/services/discovery/surf-discovery-orchestrator", () => ({
  fetchUserBoardContext: jest.fn(),
}));

const fakeSupabase = {};

jest.mock("@/lib/server-action-utils", () => ({
  withAuthenticatedAction: (fn: (user: unknown, supabase: unknown) => Promise<unknown>) =>
    fn({ id: "user-1" }, fakeSupabase).then((data) => ({ success: true, data })),
}));

const mockFetchUserBoardContext = fetchUserBoardContext as jest.Mock;

describe("getBoardPickContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchUserBoardContext.mockResolvedValue({
      dominantBoardClass: "fish",
      boardClasses: ["fish"],
      boardsForPicks: [{ id: "board-1", name: "Fish", board_type: "fish", sessions: [] }],
    });
  });

  it("loads and returns board context for a signed-in user", async () => {
    const result = await getBoardPickContext();

    expect(mockFetchUserBoardContext).toHaveBeenCalledWith(fakeSupabase, "user-1");
    expect(result.data).toEqual({
      boardClasses: ["fish"],
      boardsForPicks: [{ id: "board-1", name: "Fish", board_type: "fish", sessions: [] }],
    });
  });
});
