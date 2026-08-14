import StateRootPage from "@/app/[intent]/page";

const mockRankBeaches = jest.fn(
  async (
    beaches: Array<{ id: string; name: string }>,
    _options?: unknown,
  ) =>
    beaches.filter((beach) => beach.id !== "held-beach"),
);
const mockCandidateLimit = jest.fn();

jest.mock("@/lib/recommendations/selection", () => ({
  rankBeaches: (
    beaches: Array<{ id: string; name: string }>,
    options: unknown,
  ) => mockRankBeaches(beaches, options),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => {
    const query: Record<string, jest.Mock> & {
      then?: (resolve: (value: unknown) => unknown) => unknown;
    } = {
      select: jest.fn(() => query),
      or: jest.fn(() => query),
      eq: jest.fn(() => query),
      order: jest.fn(() => query),
      limit: jest.fn((value: number) => {
        mockCandidateLimit(value);
        return query;
      }),
    };
    query.then = (resolve) =>
      resolve({
        data: [
          {
            id: "held-beach",
            name: "Held Beach",
            slug: "held-beach",
            city: "San Diego",
            state: "CA",
            country: "USA",
            review_count: 100,
            average_rating: 4.8,
            is_private: false,
          },
          {
            id: "safe-beach",
            name: "Safe Beach",
            slug: "safe-beach",
            city: "San Diego",
            state: "CA",
            country: "USA",
            review_count: 50,
            average_rating: 4.5,
            is_private: false,
          },
        ],
        error: null,
      });
    return { from: jest.fn(() => query) };
  }),
}));

jest.mock("next/navigation", () => ({
  notFound: jest.fn(),
  permanentRedirect: jest.fn(),
}));

describe("state root beach recommendations", () => {
  beforeEach(() => jest.clearAllMocks());

  it("filters held beaches before rendering the ranked state list", async () => {
    const page = await StateRootPage({
      params: Promise.resolve({ intent: "ca" }),
    });

    expect(mockRankBeaches).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "held-beach" }),
        expect.objectContaining({ id: "safe-beach" }),
      ]),
      expect.objectContaining({ compare: expect.any(Function) }),
    );
    expect(page).toBeDefined();
    const ranked = await mockRankBeaches.mock.results[0].value;
    expect(ranked.map((beach: { id: string }) => beach.id)).toEqual([
      "safe-beach",
    ]);
  });

  it("over-fetches the candidate boundary before hold filtering", async () => {
    await StateRootPage({
      params: Promise.resolve({ intent: "ca" }),
    });

    expect(mockCandidateLimit).toHaveBeenCalledWith(205);
  });
});
