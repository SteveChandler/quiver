/** @jest-environment node */

import { withCronOutcome, type CronOutcomeOptions } from "@/lib/cron/outcome";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import * as Sentry from "@sentry/nextjs";

const mockInsert = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

type TestResult = { produced: number };

const JOBS: Array<{ name: string; unit: string }> = [
  { name: "condition-alert-deliver", unit: "notifications_sent" },
  { name: "condition-alert-evaluate", unit: "alerts_queued" },
  { name: "water-quality-sync?phase=stations", unit: "stations_synced" },
  { name: "water-quality-sync?phase=samples", unit: "samples_stored" },
  { name: "water-quality-sync?phase=evaluate", unit: "beaches_evaluated" },
  { name: "enhanced-forecast-sync", unit: "forecasts_written" },
  { name: "enhanced-forecast-sync-cdip", unit: "forecasts_written" },
  { name: "enhanced-forecast-sync-dispatch", unit: "forecasts_written" },
  { name: "system-cards", unit: "cards_published" },
  { name: "cleanup-pending-alert-captures", unit: "captures_deleted" },
  { name: "indexnow-submit", unit: "urls_submitted" },
  { name: "major-event-hold-retention", unit: "rows_deleted" },
  { name: "refresh-beach-traffic-weights", unit: "weights_refreshed" },
  { name: "update-implicit-preferences", unit: "preferences_recomputed" },
];

function optionsFor(
  job: { name: string; unit: string },
  legitimatelyZero = false,
): CronOutcomeOptions<TestResult> {
  return {
    job: `/api/cron/${job.name}`,
    unit: job.unit,
    expectedMin: 1,
    getProduced: (result) => result.produced,
    legitimatelyZero: legitimatelyZero
      ? () => ({ reason: "No work was scheduled for this test cycle" })
      : undefined,
  };
}

describe("withCronOutcome", () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
    (createSupabaseServiceRoleClient as jest.Mock).mockResolvedValue({
      from: jest.fn(() => ({ insert: mockInsert })),
    });
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it.each(JOBS)("fails and alerts when $name produces zero", async (job) => {
    const result = await withCronOutcome(
      optionsFor(job),
      async () => ({ produced: 0 }),
    );

    expect(result).toEqual({ produced: 0 });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        job: `/api/cron/${job.name}`,
        unit: job.unit,
        produced: 0,
        expected_min: 1,
        status: "failed",
      }),
    );
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining(`[cron-outcome] /api/cron/${job.name}`),
      expect.objectContaining({ level: "error" }),
    );
  });

  it.each(JOBS)("records a reason without alerting for a legitimate zero from $name", async (job) => {
    await withCronOutcome(
      optionsFor(job, true),
      async () => ({ produced: 0 }),
    );

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ok",
        legitimately_zero_reason: "No work was scheduled for this test cycle",
      }),
    );
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it.each(JOBS)("logs and returns the handler result when the outcomes table is absent for $name", async (job) => {
    mockInsert.mockRejectedValue(new Error("42P01: relation cron_runs does not exist"));

    await expect(
      withCronOutcome(optionsFor(job), async () => ({ produced: 1 })),
    ).resolves.toEqual({ produced: 1 });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[cron-outcome] could not persist outcome",
      expect.objectContaining({ job: `/api/cron/${job.name}` }),
    );
  });

  it.each([false, true])("reports an unacknowledged write once (transport rejection: %s)", async (transportError) => {
    if (transportError) mockInsert.mockRejectedValue(new Error("private database payload"));
    else mockInsert.mockResolvedValue({ error: { message: "private database payload" } });
    const onPersistenceFailure = jest.fn();
    const value = { produced: 4 };
    await expect(withCronOutcome({ ...optionsFor(JOBS[0]), onPersistenceFailure }, async () => value)).resolves.toBe(value);
    expect(onPersistenceFailure).toHaveBeenCalledTimes(1);
    expect(onPersistenceFailure).toHaveBeenCalledWith(value);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(consoleWarnSpy.mock.calls)).not.toContain("private database payload");
  });

  it("does not report persistence failure after an acknowledged outcome", async () => {
    const onPersistenceFailure = jest.fn();
    await withCronOutcome({ ...optionsFor(JOBS[0]), onPersistenceFailure }, async () => ({ produced: 1 }));
    expect(onPersistenceFailure).not.toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it.each(JOBS)("rethrows the handler error for $name", async (job) => {
    const handlerError = new Error(`${job.name} failed`);

    await expect(
      withCronOutcome(optionsFor(job), async () => {
        throw handlerError;
      }),
    ).rejects.toBe(handlerError);
    expect(Sentry.captureException).toHaveBeenCalledWith(
      handlerError,
      expect.objectContaining({
        tags: expect.objectContaining({ cron_outcome_status: "error" }),
      }),
    );
  });

  it("names the handler failure instead of a false range when produced is within range", async () => {
    await withCronOutcome(
      {
        ...optionsFor(JOBS[0]),
        expectedMax: 10000,
        failureReason: () => "tide coverage under 7 days for 2 beaches",
      },
      async () => ({ produced: 5087 }),
    );

    const [title, context] = (Sentry.captureMessage as jest.Mock).mock.calls[0];
    expect(title).toContain("reported failure");
    expect(title).not.toContain("expected 1-10000;");
    expect(context.extra.reason).toBe("tide coverage under 7 days for 2 beaches");
    expect(context.fingerprint).toEqual(["cron-outcome", "/api/cron/condition-alert-deliver", "handler-failure"]);
  });

  it("keeps the range wording when produced is actually out of range", async () => {
    await withCronOutcome(optionsFor(JOBS[0]), async () => ({ produced: 0 }));
    const [title, context] = (Sentry.captureMessage as jest.Mock).mock.calls[0];
    expect(title).toContain("produced 0");
    expect(context.fingerprint[2]).toBe("out-of-range");
  });

  describe("upstreamGap", () => {
    const limitMs = 6 * 60 * 60 * 1000;
    const query = {
      eq: jest.fn().mockReturnThis(), gt: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
    };
    const describeGap = jest.fn((lastRanAt: string | null): string =>
      `Provider unavailable for >6 h; last productive run ${lastRanAt ?? 'never'}; action: check provider`);
    const gapOptions = (): CronOutcomeOptions<TestResult> => ({
      ...optionsFor(JOBS[0]),
      upstreamGap: { active: () => true, limitMs, describe: describeGap },
    });

    beforeEach(() => {
      describeGap.mockClear();
      query.maybeSingle.mockReset().mockResolvedValue({ data: null, error: null });
      (createSupabaseServiceRoleClient as jest.Mock).mockResolvedValue({
        from: jest.fn(() => ({ select: jest.fn(() => query), insert: mockInsert })),
      });
    });

    it.each([2, 6])("allows a zero-row gap %i hours after the last productive run", async (hours) => {
      const now = Date.parse('2026-11-16T12:00:00Z');
      const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
      const ranAt = new Date(now - hours * 60 * 60 * 1000).toISOString();
      query.maybeSingle.mockResolvedValue({ data: { ran_at: ranAt }, error: null });

      try {
        const value = { produced: 0 };
        await expect(withCronOutcome(gapOptions(), async () => value)).resolves.toBe(value);

        expect(query.eq).toHaveBeenCalledWith('job', `/api/cron/${JOBS[0].name}`);
        expect(query.eq).toHaveBeenCalledWith('status', 'ok');
        expect(query.gt).toHaveBeenCalledWith('produced', 0);
        expect(query.order).toHaveBeenCalledWith('ran_at', { ascending: false });
        expect(query.limit).toHaveBeenCalledWith(1);
        expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
          status: 'ok', produced: 0, error_message: null,
          legitimately_zero_reason: 'Upstream gap within allowed duration',
        }));
        expect(Sentry.captureMessage).not.toHaveBeenCalled();
        expect(describeGap).not.toHaveBeenCalled();
        expect(createSupabaseServiceRoleClient).toHaveBeenCalledTimes(1);
      } finally {
        clock.mockRestore();
      }
    });

    it.each([0, 4])("fails an expired gap even with %i rows produced in this run", async (produced) => {
      const ranAt = new Date(Date.now() - limitMs - 60_000).toISOString();
      query.maybeSingle.mockResolvedValue({ data: { ran_at: ranAt }, error: null });

      await withCronOutcome(gapOptions(), async () => ({ produced }));

      expect(describeGap).toHaveBeenCalledWith(ranAt);
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        status: 'failed', produced, error_message: describeGap.mock.results[0].value,
      }));
      expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    });

    it("fails when there is no productive history", async () => {
      await withCronOutcome(gapOptions(), async () => ({ produced: 0 }));

      expect(describeGap).toHaveBeenCalledWith(null);
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        status: 'failed', error_message: expect.stringContaining('last productive run never'),
      }));
    });

    it.each([false, true])("warns and permits the gap when the read fails (rejection: %s)", async (rejects) => {
      const error = new Error('history read failed');
      if (rejects) query.maybeSingle.mockRejectedValue(error);
      else query.maybeSingle.mockResolvedValue({ data: null, error });

      await withCronOutcome(gapOptions(), async () => ({ produced: 0 }));

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[cron-outcome] could not read last productive run',
        expect.objectContaining({ job: `/api/cron/${JOBS[0].name}` }),
      );
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ status: 'ok', error_message: null }));
      expect(Sentry.captureMessage).not.toHaveBeenCalled();
      expect(describeGap).not.toHaveBeenCalled();
    });

    it("keeps an explicit handler failure when the gap read fails", async () => {
      query.maybeSingle.mockRejectedValue(new Error('history read failed'));
      await withCronOutcome({ ...gapOptions(), failureReason: () => 'database write failed' }, async () => ({ produced: 0 }));

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', error_message: 'database write failed' }));
      expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    });

    it("does not exempt an inactive gap or read its history", async () => {
      const options = gapOptions();
      options.upstreamGap!.active = () => false;
      await withCronOutcome(options, async () => ({ produced: 0 }));

      expect(query.maybeSingle).not.toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
      expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    });

    it.each(['active', 'describe'] as const)("rethrows an unrelated %s callback error", async (callback) => {
      const options = gapOptions();
      const error = new Error('unrelated callback bug');
      options.upstreamGap![callback] = () => { throw error; };

      await expect(withCronOutcome(options, async () => ({ produced: 0 }))).rejects.toBe(error);

      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', error_message: error.message }));
      expect(Sentry.captureException).toHaveBeenCalledWith(error, expect.any(Object));
    });
  });
});
