/**
 * @jest-environment node
 */

import { main } from "@/scripts/email-android-beta-leads";
import { createClient } from "@supabase/supabase-js";
import { sendAndroidBetaInstructionsEmail } from "@/lib/mailer/android-beta";

jest.mock("dotenv", () => ({
  config: jest.fn(),
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/lib/mailer/android-beta", () => ({
  sendAndroidBetaInstructionsEmail: jest.fn(),
}));

type QueryResult<T> = {
  data?: T;
  error?: unknown;
};

type ChainCall = {
  method: string;
  args: unknown[];
};

type QueryChain<T> = {
  calls: ChainCall[];
  chain: {
    select: jest.Mock;
    is: jest.Mock;
    order: jest.Mock;
    limit: jest.Mock;
    eq: jest.Mock;
    in: jest.Mock;
    maybeSingle: jest.Mock;
    then: Promise<QueryResult<T>>["then"];
  };
};

function createQueryChain<T>(result: QueryResult<T>): QueryChain<T> {
  const calls: ChainCall[] = [];
  const resolved = Promise.resolve(result);
  let chain: QueryChain<T>["chain"];
  chain = {
    select: jest.fn((...args: unknown[]) => {
      calls.push({ method: "select", args });
      return chain;
    }),
    is: jest.fn((...args: unknown[]) => {
      calls.push({ method: "is", args });
      return chain;
    }),
    order: jest.fn((...args: unknown[]) => {
      calls.push({ method: "order", args });
      return chain;
    }),
    limit: jest.fn((...args: unknown[]) => {
      calls.push({ method: "limit", args });
      return chain;
    }),
    eq: jest.fn((...args: unknown[]) => {
      calls.push({ method: "eq", args });
      return chain;
    }),
    in: jest.fn((...args: unknown[]) => {
      calls.push({ method: "in", args });
      return chain;
    }),
    maybeSingle: jest.fn(() => resolved),
    then: resolved.then.bind(resolved),
  };

  return { calls, chain };
}

function createSupabaseMock(options: {
  canonicalRows?: Array<{
    android_waitlist_source_links: Array<{ source_id: string }>;
  }>;
  leadRows?: Array<{ email: string | null }>;
  claims?: Array<QueryResult<{ email: string } | null>>;
  resetResults?: Array<QueryResult<null>>;
}) {
  const canonicalSelect = createQueryChain({
    data: options.canonicalRows ?? [],
    error: null,
  });
  const leadSelect = createQueryChain({
    data: options.leadRows ?? [],
    error: null,
  });
  const claimChains: Array<QueryChain<{ email: string } | null>> = [];
  const resetChains: Array<QueryChain<null>> = [];
  const updatePayloads: unknown[] = [];

  const claims = [...(options.claims ?? [])];
  const resetResults = [...(options.resetResults ?? [])];

  const supabase = {
    from: jest.fn((table: string) => ({
      select: jest.fn((...args: unknown[]) => {
        if (table === "android_waitlist_entries") {
          return canonicalSelect.chain.select(...args);
        }
        if (table === "android_beta_leads") {
          return leadSelect.chain.select(...args);
        }
        throw new Error(`Unexpected select table: ${table}`);
      }),
      update: jest.fn((payload: { instructions_sent_at?: string | null }) => {
        updatePayloads.push(payload);
        if (payload.instructions_sent_at === null) {
          const chain = createQueryChain<null>(
            resetResults.shift() ?? { data: null, error: null },
          );
          resetChains.push(chain);
          return chain.chain;
        }

        const chain = createQueryChain<{ email: string } | null>(
          claims.shift() ?? { data: null, error: null },
        );
        claimChains.push(chain);
        return chain.chain;
      }),
    })),
  };

  return {
    supabase,
    canonicalSelect,
    leadSelect,
    claimChains,
    resetChains,
    updatePayloads,
  };
}

describe("scripts/email-android-beta-leads", () => {
  const originalArgv = process.argv;
  const originalEnv = process.env;
  const originalExitCode = process.exitCode;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    process.argv = ["node", "scripts/email-android-beta-leads.ts"];
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    };
    process.exitCode = undefined;
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
    process.exitCode = originalExitCode;
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it("dry-runs unsent leads without claiming or sending", async () => {
    process.argv = [
      "node",
      "scripts/email-android-beta-leads.ts",
      "--limit",
      "10",
    ];
    const supabaseMock = createSupabaseMock({
      canonicalRows: [
        {
          android_waitlist_source_links: [{ source_id: "lead-id-1" }],
        },
      ],
      leadRows: [{ email: "lead@example.com" }],
    });
    (createClient as jest.Mock).mockReturnValue(supabaseMock.supabase);

    await main();

    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role",
    );
    expect(supabaseMock.canonicalSelect.calls).toContainEqual({
      method: "eq",
      args: ["android_waitlist_source_links.source_kind", "anonymous_lead"],
    });
    expect(supabaseMock.canonicalSelect.calls).toContainEqual({
      method: "limit",
      args: [10],
    });
    expect(supabaseMock.leadSelect.calls).toContainEqual({
      method: "in",
      args: ["id", ["lead-id-1"]],
    });
    expect(supabaseMock.leadSelect.calls).toContainEqual({
      method: "is",
      args: ["instructions_sent_at", null],
    });
    expect(supabaseMock.updatePayloads).toEqual([]);
    expect(sendAndroidBetaInstructionsEmail).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('"mode": "dry-run"'),
    );
  });

  it("claims and sends only canonical recipients with lead addresses", async () => {
    process.argv = ["node", "scripts/email-android-beta-leads.ts", "--send"];
    const supabaseMock = createSupabaseMock({
      canonicalRows: [
        {
          android_waitlist_source_links: [
            { source_id: "lead-id-1" },
            { source_id: "lead-id-2" },
          ],
        },
      ],
      leadRows: [
        { email: "lead@example.com" },
        { email: "profile@example.com" },
      ],
      claims: [
        { data: { email: "lead@example.com" }, error: null },
        { data: { email: "profile@example.com" }, error: null },
      ],
    });
    (createClient as jest.Mock).mockReturnValue(supabaseMock.supabase);
    (sendAndroidBetaInstructionsEmail as jest.Mock).mockResolvedValue({
      success: true,
      messageId: "message-1",
    });

    await main();

    expect(supabaseMock.leadSelect.calls).toContainEqual({
      method: "in",
      args: ["id", ["lead-id-1", "lead-id-2"]],
    });
    expect(supabaseMock.updatePayloads).toHaveLength(2);
    expect(supabaseMock.updatePayloads).toEqual([
      { instructions_sent_at: expect.any(String) },
      { instructions_sent_at: expect.any(String) },
    ]);
    expect(supabaseMock.claimChains[0].calls).toContainEqual({
      method: "eq",
      args: ["email", "lead@example.com"],
    });
    expect(supabaseMock.claimChains[0].calls).toContainEqual({
      method: "is",
      args: ["instructions_sent_at", null],
    });
    expect(sendAndroidBetaInstructionsEmail).toHaveBeenCalledTimes(2);
    expect(sendAndroidBetaInstructionsEmail).toHaveBeenNthCalledWith(
      1,
      "lead@example.com",
    );
    expect(sendAndroidBetaInstructionsEmail).toHaveBeenNthCalledWith(
      2,
      "profile@example.com",
    );
    expect(process.exitCode).toBeUndefined();
  });

  it("resets the sent-at claim when sending fails", async () => {
    process.argv = ["node", "scripts/email-android-beta-leads.ts", "--send"];
    const supabaseMock = createSupabaseMock({
      canonicalRows: [
        {
          android_waitlist_source_links: [{ source_id: "lead-id-1" }],
        },
      ],
      leadRows: [{ email: "lead@example.com" }],
      claims: [{ data: { email: "lead@example.com" }, error: null }],
    });
    (createClient as jest.Mock).mockReturnValue(supabaseMock.supabase);
    (sendAndroidBetaInstructionsEmail as jest.Mock).mockResolvedValue({
      success: false,
      error: "resend_failed",
    });

    await main();

    const claimPayload = supabaseMock.updatePayloads[0] as {
      instructions_sent_at: string;
    };
    expect(sendAndroidBetaInstructionsEmail).toHaveBeenCalledWith(
      "lead@example.com",
    );
    expect(supabaseMock.updatePayloads).toEqual([
      { instructions_sent_at: expect.any(String) },
      { instructions_sent_at: null },
    ]);
    expect(supabaseMock.resetChains[0].calls).toContainEqual({
      method: "eq",
      args: ["email", "lead@example.com"],
    });
    expect(supabaseMock.resetChains[0].calls).toContainEqual({
      method: "eq",
      args: ["instructions_sent_at", claimPayload.instructions_sent_at],
    });
    expect(process.exitCode).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to send Android beta email",
      {
        email: "lead@example.com",
        error: "resend_failed",
      },
    );
  });
});
