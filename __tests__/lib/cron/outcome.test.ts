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
  { name: "enhanced-forecast-sync-offset", unit: "forecasts_written" },
  { name: "enhanced-forecast-sync-cdip", unit: "forecasts_written" },
  { name: "enhanced-forecast-sync-dispatch", unit: "forecasts_written" },
  { name: "system-cards", unit: "cards_published" },
  { name: "cleanup-pending-alert-captures", unit: "captures_deleted" },
  { name: "indexnow-submit", unit: "urls_submitted" },
  { name: "major-event-hold-retention", unit: "rows_deleted" },
  { name: "refresh-beach-traffic-weights", unit: "weights_refreshed" },
  { name: "sync-buoys", unit: "buoys_synced" },
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
});
