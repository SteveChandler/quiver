import { countRealSurfers } from "@/lib/social-proof/count-real-surfers";

type CountResult = {
  count: number | null;
  error: unknown;
};

function makeCountBuilder(result: CountResult) {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    or: jest.fn(),
    is: jest.fn(),
    gte: jest.fn(),
    then: jest.fn(
      (
        resolve: (value: CountResult) => unknown,
        reject?: (reason: unknown) => unknown
      ) => Promise.resolve(result).then(resolve, reject)
    ),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.or.mockReturnValue(builder);
  builder.is.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);

  return builder;
}

describe("countRealSurfers", () => {
  it("counts real active profiles and includes false-or-null system flags", async () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    const totalBuilder = makeCountBuilder({ count: 124, error: null });
    const joinedBuilder = makeCountBuilder({ count: 9, error: null });
    const supabase = {
      from: jest
        .fn()
        .mockReturnValueOnce(totalBuilder)
        .mockReturnValueOnce(joinedBuilder),
    };

    await expect(countRealSurfers(supabase as any, now)).resolves.toEqual({
      totalSurfers: 124,
      joinedLast7d: 9,
    });

    expect(supabase.from).toHaveBeenNthCalledWith(1, "profiles");
    expect(supabase.from).toHaveBeenNthCalledWith(2, "profiles");

    for (const builder of [totalBuilder, joinedBuilder]) {
      expect(builder.select).toHaveBeenCalledWith("id", {
        count: "exact",
        head: true,
      });
      expect(builder.eq).toHaveBeenCalledWith("analytics_is_real_user", true);
      expect(builder.or).toHaveBeenCalledWith(
        "is_system_account.is.null,is_system_account.eq.false"
      );
      expect(builder.eq).not.toHaveBeenCalledWith(
        "is_system_account",
        expect.anything()
      );
      expect(builder.is).toHaveBeenCalledWith("deleted_at", null);
    }

    expect(totalBuilder.gte).not.toHaveBeenCalled();
    expect(joinedBuilder.gte).toHaveBeenCalledWith(
      "created_at",
      "2026-06-08T12:00:00.000Z"
    );
  });

  it("returns zeros when Supabase count fields are null", async () => {
    const totalBuilder = makeCountBuilder({ count: null, error: null });
    const joinedBuilder = makeCountBuilder({ count: null, error: null });
    const supabase = {
      from: jest
        .fn()
        .mockReturnValueOnce(totalBuilder)
        .mockReturnValueOnce(joinedBuilder),
    };

    await expect(countRealSurfers(supabase as any)).resolves.toEqual({
      totalSurfers: 0,
      joinedLast7d: 0,
    });
  });

  it("throws when the total count query fails", async () => {
    const totalBuilder = makeCountBuilder({
      count: null,
      error: { message: "permission denied" },
    });
    const joinedBuilder = makeCountBuilder({ count: 3, error: null });
    const supabase = {
      from: jest
        .fn()
        .mockReturnValueOnce(totalBuilder)
        .mockReturnValueOnce(joinedBuilder),
    };

    await expect(countRealSurfers(supabase as any)).rejects.toThrow(
      "Failed to count real surfers: permission denied"
    );
  });

  it("throws when the joined-last-7-days query fails", async () => {
    const totalBuilder = makeCountBuilder({ count: 12, error: null });
    const joinedBuilder = makeCountBuilder({
      count: null,
      error: new Error("timeout"),
    });
    const supabase = {
      from: jest
        .fn()
        .mockReturnValueOnce(totalBuilder)
        .mockReturnValueOnce(joinedBuilder),
    };

    await expect(countRealSurfers(supabase as any)).rejects.toThrow(
      "Failed to count real surfers joined in the last 7 days: timeout"
    );
  });
});
