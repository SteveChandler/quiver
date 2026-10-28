/** @jest-environment node */

const mockFrom = jest.fn();
const mockGetUser = jest.fn();

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(async () => ({
    from: mockFrom,
    auth: { getUser: mockGetUser },
  })),
}));

import { deleteBoard, getUserBoards } from "@/actions/board-actions";

function chain(result: { data?: unknown; error: unknown }) {
  const query: Record<string, jest.Mock> & { then?: unknown } = {};
  for (const method of ["select", "eq", "is", "order", "update", "delete"]) {
    query[method] = jest.fn(() => query);
  }
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result));
  return query;
}

describe("board actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("lists only boards that are not retired", async () => {
    const query = chain({ data: [{ id: "board-1" }], error: null });
    mockFrom.mockReturnValue(query);

    const result = await getUserBoards("user-1");

    expect(result).toEqual(expect.objectContaining({ success: true, data: [{ id: "board-1" }] }));
    expect(mockFrom).toHaveBeenCalledWith("boards");
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(query.is).toHaveBeenCalledWith("retired_at", null);
  });

  it("retires the board instead of deleting it, so logged sessions keep their board", async () => {
    const query = chain({ error: null });
    mockFrom.mockReturnValue(query);

    const result = await deleteBoard("board-1");

    expect(result).toEqual({ success: true });
    expect(query.delete).not.toHaveBeenCalled();
    expect(query.update).toHaveBeenCalledTimes(1);
    const patch = query.update.mock.calls[0][0] as { retired_at: string; updated_at: string };
    expect(Number.isNaN(Date.parse(patch.retired_at))).toBe(false);
    expect(patch.updated_at).toBe(patch.retired_at);
    expect(query.eq).toHaveBeenCalledWith("id", "board-1");
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(query.is).toHaveBeenCalledWith("retired_at", null);
  });

  it("returns the database error when retiring fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockFrom.mockReturnValue(chain({ error: new Error("permission denied") }));

    const result = await deleteBoard("board-1");

    expect(result).toEqual({ success: false, error: "permission denied" });
  });

  it("requires a signed-in user to retire a board", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await deleteBoard("board-1");

    expect(result).toEqual({ success: false, error: "Authentication required" });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
