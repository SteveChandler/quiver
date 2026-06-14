import { filterSuppressedRecipients } from "@/lib/email/suppression";

interface TestRecipient {
  user_id: string;
  email: string;
  label: string;
}

function createSuppressionSupabaseMock({
  data = [],
  error = null,
  results,
  throwOnIn = null,
}: {
  data?: { email: string }[] | null;
  error?: { message: string } | null;
  results?: Array<{
    data?: { email: string }[] | null;
    error?: { message: string } | null;
  }>;
  throwOnIn?: Error | null;
} = {}) {
  let lookupCallIndex = 0;
  const inMock = jest.fn((..._args: unknown[]) => {
    if (throwOnIn) {
      throw throwOnIn;
    }

    const nextResult = results?.[lookupCallIndex];
    lookupCallIndex += 1;
    return Promise.resolve({
      data: nextResult?.data ?? data,
      error: nextResult?.error ?? error,
    });
  });
  const selectMock = jest.fn(() => ({ in: inMock }));
  const fromMock = jest.fn(() => ({ select: selectMock }));

  return {
    supabase: { from: fromMock },
    fromMock,
    selectMock,
    inMock,
  };
}

describe("filterSuppressedRecipients", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns the input unchanged for empty recipients", async () => {
    const { supabase, fromMock } = createSuppressionSupabaseMock();
    const recipients: TestRecipient[] = [];

    const result = await filterSuppressedRecipients(supabase as never, recipients);

    expect(result).toBe(recipients);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("queries lowercased emails and drops suppressed recipients case-insensitively", async () => {
    const { supabase, fromMock, selectMock, inMock } =
      createSuppressionSupabaseMock({
        data: [
          { email: "bounced@example.com" },
          { email: "other@example.com" },
        ],
      });
    const keep: TestRecipient = {
      user_id: "user-1",
      email: "KEEP@example.com",
      label: "keep",
    };
    const bounced: TestRecipient = {
      user_id: "user-2",
      email: "Bounced@Example.com",
      label: "drop",
    };
    const other: TestRecipient = {
      user_id: "user-3",
      email: "other@example.com",
      label: "drop too",
    };

    const result = await filterSuppressedRecipients(supabase as never, [
      keep,
      bounced,
      other,
    ]);

    expect(result).toEqual([keep]);
    expect(fromMock).toHaveBeenCalledWith("email_suppression_list");
    expect(selectMock).toHaveBeenCalledWith("email");
    expect(inMock).toHaveBeenCalledWith("email", [
      "keep@example.com",
      "bounced@example.com",
      "other@example.com",
    ]);
  });

  it("dedupes lowercased emails and queries suppression rows in 200-email chunks", async () => {
    const recipients: TestRecipient[] = [
      ...Array.from({ length: 201 }, (_, index) => ({
        user_id: `user-${index}`,
        email: `USER-${index}@Example.com`,
        label: `recipient-${index}`,
      })),
      {
        user_id: "duplicate-user",
        email: "user-0@example.com",
        label: "duplicate recipient",
      },
    ];
    const { supabase, inMock } = createSuppressionSupabaseMock({
      results: [
        { data: [{ email: "user-0@example.com" }], error: null },
        { data: [], error: null },
      ],
    });

    const result = await filterSuppressedRecipients(supabase as never, recipients);

    expect(inMock).toHaveBeenCalledTimes(2);
    expect(inMock).toHaveBeenNthCalledWith(
      1,
      "email",
      Array.from({ length: 200 }, (_, index) => `user-${index}@example.com`)
    );
    expect(inMock).toHaveBeenNthCalledWith(2, "email", [
      "user-200@example.com",
    ]);
    expect(result).toHaveLength(200);
    expect(result).not.toContain(recipients[0]);
    expect(result).not.toContain(recipients[201]);
  });

  it("returns all recipients when none are suppressed", async () => {
    const { supabase } = createSuppressionSupabaseMock({ data: [] });
    const recipients: TestRecipient[] = [
      { user_id: "user-1", email: "a@example.com", label: "a" },
      { user_id: "user-2", email: "b@example.com", label: "b" },
    ];

    const result = await filterSuppressedRecipients(supabase as never, recipients);

    expect(result).toEqual(recipients);
  });

  it("fails open when the suppression lookup errors", async () => {
    const lookupError = { message: "permission denied" };
    const { supabase } = createSuppressionSupabaseMock({
      data: null,
      error: lookupError,
    });
    const recipients: TestRecipient[] = [
      { user_id: "user-1", email: "blocked@example.com", label: "kept" },
    ];

    const result = await filterSuppressedRecipients(supabase as never, recipients);

    expect(result).toEqual(recipients);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to check email suppression list"),
      lookupError
    );
  });

  it("fails open when the suppression lookup throws", async () => {
    const thrownError = new Error("network failed");
    const { supabase } = createSuppressionSupabaseMock({
      throwOnIn: thrownError,
    });
    const recipients: TestRecipient[] = [
      { user_id: "user-1", email: "blocked@example.com", label: "kept" },
    ];

    const result = await filterSuppressedRecipients(supabase as never, recipients);

    expect(result).toEqual(recipients);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to check email suppression list"),
      thrownError
    );
  });
});
