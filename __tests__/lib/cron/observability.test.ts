// __tests__/lib/cron/observability.test.ts
import { withCronObservability } from "@/lib/cron/observability";

const mockChain = () => {
  const insertMock = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({ data: { id: "run-1" }, error: null }),
    }),
  });
  const updateMock = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
  return {
    from: jest.fn(() => ({ insert: insertMock, update: updateMock })),
    _insertMock: insertMock,
    _updateMock: updateMock,
  };
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

describe("withCronObservability", () => {
  it("records start + ok with summary on success", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    createSupabaseServiceRoleClient.mockResolvedValue(client);

    const result = await withCronObservability("/api/cron/test", async () => ({ queued: 3 }));

    expect(result).toEqual({ queued: 3 });
    expect(client._insertMock).toHaveBeenCalledWith({ route: "/api/cron/test", status: "started" });
    expect(client._updateMock).toHaveBeenCalledWith(expect.objectContaining({
      status: "ok",
      summary: { queued: 3 },
    }));
  });

  it("records error and rethrows", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    createSupabaseServiceRoleClient.mockResolvedValue(client);

    await expect(
      withCronObservability("/api/cron/test", async () => { throw new Error("boom"); })
    ).rejects.toThrow("boom");

    expect(client._updateMock).toHaveBeenCalledWith(expect.objectContaining({
      status: "error",
      error_message: "boom",
    }));
  });

  it("does not block handler when cron_runs insert fails", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    client._insertMock.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: null, error: { message: "rls" } }),
      }),
    });
    createSupabaseServiceRoleClient.mockResolvedValue(client);

    const result = await withCronObservability("/api/cron/test", async () => ({ ok: true }));
    expect(result).toEqual({ ok: true });
  });
});
