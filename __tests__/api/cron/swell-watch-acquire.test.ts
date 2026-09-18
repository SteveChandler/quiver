/** @jest-environment node */
import { GET } from "@/app/api/cron/swell-watch-acquire/route";
import { acquireSwellWatchCohort } from "@/lib/alerts/swell-watch/acquisition";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import deployment from "@/vercel.json";
import { completeSwellWatchStudyRun, readSwellWatchStudyStatus, recoverSwellWatchStudyRuns, SwellWatchStudySkip } from "@/lib/alerts/swell-watch/study";
import { calculateSwellWatchPolicyHash } from "@/lib/alerts/swell-watch/policy";
import fixture from "@/__tests__/fixtures/swell-watch-provisional-policy.json";
import { z } from "zod";

jest.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: jest.fn() }));
jest.mock("@/lib/alerts/swell-watch/acquisition", () => ({
  ...jest.requireActual("@/lib/alerts/swell-watch/acquisition"),
  acquireSwellWatchCohort: jest.fn(),
}));
jest.mock("@/lib/notifications/enqueue", () => ({
  enqueueNotification: () => { throw new Error("Forbidden send path"); },
}));
jest.mock("@/lib/alerts/swell-watch/study", () => ({
  ...jest.requireActual("@/lib/alerts/swell-watch/study"), completeSwellWatchStudyRun: jest.fn(), readSwellWatchStudyStatus: jest.fn(),
  recoverSwellWatchStudyRuns: jest.fn(),
}));

const originalEnv = process.env;
const cohort = [{ sourcePointId: "10000000-0000-4000-8000-000000000001", regionKey: "fixture" }];
const receipt = { issuanceId: "issuance", runBatchId: "batch", revisionSetId: "revision" };

it("schedules only acquisition hourly, not the completed-batch POST callback", () => {
  expect(deployment.crons.filter((cron) => cron.path === "/api/cron/swell-watch-acquire"))
    .toEqual([{ path: "/api/cron/swell-watch-acquire", schedule: "15 * * * *" }]);
  expect(deployment.crons.some((cron) => cron.path === "/api/cron/swell-watch-evaluate")).toBe(false);
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(createSupabaseServiceRoleClient).mockReturnValue({} as never);
  jest.mocked(acquireSwellWatchCohort).mockResolvedValue(receipt);
  process.env = { ...originalEnv, CRON_SECRET: "fixture-secret",
    SWELL_WATCH_STUDY_ENABLED: "false",
    SWELL_WATCH_ACQUISITION_ENABLED: "true", SWELL_WATCH_ENABLED: "false",
    SWELL_WATCH_PUSH_ENABLED: "false", SWELL_WATCH_PRODUCER_CONFIG: JSON.stringify({ cohort }) };
});

describe("automated study", () => {
  beforeEach(() => {
    const policy = { ...fixture, schema_version: "swell-watch-policy.v2", policy_values: {
      ...fixture.policy_values, volume_caps: { ...fixture.policy_values.volume_caps, projected_send_window_hours: 24 },
    } };
    policy.value_hash = calculateSwellWatchPolicyHash(policy as never);
    process.env.SWELL_WATCH_STUDY_ENABLED = "true";
    process.env.SWELL_WATCH_SHADOW_EVALUATION_ENABLED = "true";
    process.env.SWELL_WATCH_PRODUCER_CONFIG = JSON.stringify({ policy, cohort: Array.from({ length: 10 }, (_, i) => ({
      sourcePointId: `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`, regionKey: `region-${i}`,
    })) });
    jest.mocked(completeSwellWatchStudyRun).mockResolvedValue({ status: "evaluated", enqueued: 0 } as never);
    jest.mocked(readSwellWatchStudyStatus).mockResolvedValue({ status: "active", qualificationRule: "primary_partition_with_retained_unavailable_secondary.v1" });
    jest.mocked(recoverSwellWatchStudyRuns).mockResolvedValue({ processed: 0, failed: 0 });
  });

  it("advances a stored receipt through the automated study", async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ qualification: "automated_study", study: { status: "evaluated" }, enqueued: 0 });
    expect(completeSwellWatchStudyRun).toHaveBeenCalledWith(receipt.revisionSetId, expect.anything(), expect.anything(), "primary_partition_with_retained_unavailable_secondary.v1", expect.any(Function));
    expect(recoverSwellWatchStudyRuns).toHaveBeenCalledWith(expect.anything(), expect.anything(), "primary_partition_with_retained_unavailable_secondary.v1", expect.any(Function));
  });

  it("uses the refreshed authority rule after recovery", async () => {
    jest.mocked(readSwellWatchStudyStatus)
      .mockResolvedValueOnce({ status: "active", qualificationRule: "complete_partitions.v1" })
      .mockResolvedValueOnce({ status: "active", qualificationRule: "primary_partition_with_retained_unavailable_secondary.v1" });
    jest.mocked(recoverSwellWatchStudyRuns).mockResolvedValueOnce({ processed: 1, failed: 0 });
    expect((await call()).status).toBe(200);
    expect(recoverSwellWatchStudyRuns).toHaveBeenCalledWith(expect.anything(), expect.anything(), "complete_partitions.v1", expect.any(Function));
    expect(completeSwellWatchStudyRun).toHaveBeenCalledWith(receipt.revisionSetId, expect.anything(), expect.anything(), "primary_partition_with_retained_unavailable_secondary.v1", expect.any(Function));
  });

  it("processes retained issuance A before acquiring newer issuance B", async () => {
    jest.mocked(recoverSwellWatchStudyRuns).mockResolvedValueOnce({ processed: 1, failed: 0 });
    const response = await call();
    expect(response.status).toBe(200);
    expect((await response.json()).data.recovery).toEqual({ processed: 1, failed: 0 });
    expect(jest.mocked(recoverSwellWatchStudyRuns).mock.invocationCallOrder[0])
      .toBeLessThan(jest.mocked(acquireSwellWatchCohort).mock.invocationCallOrder[0]);
    expect(completeSwellWatchStudyRun).toHaveBeenCalledWith(receipt.revisionSetId, expect.anything(), expect.anything(), "primary_partition_with_retained_unavailable_secondary.v1", expect.any(Function));
  });

  it("reports retained failures while still processing the newest issuance", async () => {
    jest.mocked(recoverSwellWatchStudyRuns).mockResolvedValueOnce({ processed: 0, failed: 1 });
    const response = await call();
    expect(response.status).toBe(500);
    expect(completeSwellWatchStudyRun).toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ details: { recovery: { failed: 1 }, study: { status: "evaluated" }, enqueued: 0 } });
  });

  it("stops before new acquisition if recovery reaches the target", async () => {
    jest.mocked(recoverSwellWatchStudyRuns).mockResolvedValueOnce({ processed: 1, failed: 0 });
    jest.mocked(readSwellWatchStudyStatus).mockResolvedValueOnce({ status: "active", qualificationRule: "primary_partition_with_retained_unavailable_secondary.v1" }).mockResolvedValueOnce({ status: "complete", qualificationRule: "primary_partition_with_retained_unavailable_secondary.v1" });
    const response = await call();
    expect(response.status).toBe(200);
    expect((await response.json()).data.reason).toBe("study_complete");
    expect(acquireSwellWatchCohort).not.toHaveBeenCalled();
  });

  it.each(["SWELL_WATCH_ENABLED", "SWELL_WATCH_PUSH_ENABLED"])("requires explicit false for %s before collection", async (flag) => {
    delete process.env[flag];
    expect((await call()).status).toBe(503);
    expect(acquireSwellWatchCohort).not.toHaveBeenCalled();
    expect(completeSwellWatchStudyRun).not.toHaveBeenCalled();
    process.env[flag] = "true";
    expect((await call()).status).toBe(503);
    expect(acquireSwellWatchCohort).not.toHaveBeenCalled();
  });

  it("requires shadow evaluation and the full study configuration before collection", async () => {
    delete process.env.SWELL_WATCH_SHADOW_EVALUATION_ENABLED;
    expect((await call()).status).toBe(503);
    process.env.SWELL_WATCH_SHADOW_EVALUATION_ENABLED = "true";
    process.env.SWELL_WATCH_PRODUCER_CONFIG = JSON.stringify({ cohort });
    expect((await call()).status).toBe(503);
    expect(acquireSwellWatchCohort).not.toHaveBeenCalled();
  });

  it("does not complete when another collector holds the lease", async () => {
    jest.mocked(acquireSwellWatchCohort).mockResolvedValueOnce({ skipped: true, reason: "collection_in_progress", enqueued: 0 });
    expect((await call()).status).toBe(200);
    expect(completeSwellWatchStudyRun).not.toHaveBeenCalled();
  });

  it.each(["complete", "expired"] as const)("stops acquisition automatically when study is %s", async (status) => {
    jest.mocked(readSwellWatchStudyStatus).mockResolvedValueOnce({ status: status, qualificationRule: "primary_partition_with_retained_unavailable_secondary.v1" });
    const response = await call();
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ skipped: true, reason: `study_${status}`, enqueued: 0 });
    expect(acquireSwellWatchCohort).not.toHaveBeenCalled();
  });

  it.each(["unconfigured", "blocked"] as const)("fails before acquisition when study is %s", async (status) => {
    jest.mocked(readSwellWatchStudyStatus).mockResolvedValueOnce({ status: status, qualificationRule: "primary_partition_with_retained_unavailable_secondary.v1" });
    expect((await call()).status).toBe(503);
    expect(acquireSwellWatchCohort).not.toHaveBeenCalled();
  });

  it("returns an actual failure if automatic completion or outcome recording fails", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.mocked(completeSwellWatchStudyRun).mockImplementationOnce(async (...args) => {
      args[4]?.("study_evaluation");
      throw new Error("private-database-detail");
    });
    const response = await call();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private-database-detail");
    expect(log).toHaveBeenCalledWith("[swell-watch-acquire] automated study failed", { stage: "study_evaluation", code: "unknown" });
  });

  it.each([
    ["study_completion", new Error("Study completion failed"), "study_completion_failed"],
    ["study_evaluation", new Error("Swell Watch history attestation failed: private detail"), "history_attestation_failed"],
    ["study_recording", new Error("Study outcome recording failed"), "study_outcome_recording_failed"],
  ] as const)("reports the fixed %s failure stage and code", async (stage, error, code) => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.mocked(completeSwellWatchStudyRun).mockImplementationOnce(async (...args) => {
      args[4]?.(stage);
      throw error;
    });
    const response = await call();
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({ details: { stage, code, enqueued: 0 } });
    expect(JSON.stringify(body)).not.toContain(error.message);
    expect(log).toHaveBeenCalledWith("[swell-watch-acquire] automated study failed", { stage, code });
  });

  it.each([
    [new Error("Swell Watch history differs from attested component"), "history_component_mismatch"],
    [new Error("Swell Watch history scope is inconsistent"), "history_invalid"],
    [new Error("Swell Watch history state is inconsistent"), "history_invalid"],
    [new Error("Swell Watch history is truncated or duplicated"), "history_invalid"],
    [new Error("Current evaluation is absent or superseded"), "current_evaluation_absent_or_superseded"],
    [new Error("Persisted matching identity changed"), "persisted_matching_identity_changed"],
    [new Error("Invalid shadow candidate"), "invalid_shadow_candidate"],
    [new Error("Duplicate shadow candidate"), "duplicate_shadow_candidate"],
    [new Error("Shadow demand recording failed"), "shadow_demand_recording_failed"],
    [new Error("Attested run ingestion failed: private detail"), "attested_run_ingestion_failed"],
    [new Error("Attested run ingestion identities are missing or inconsistent"), "attested_run_ingestion_identities_are_missing_or_inconsistent"],
    [new Error("Cohort exceeds atomic impact limit"), "cohort_exceeds_atomic_impact_limit"],
  ] as const)("reports a fixed code without raw error text: %s", async (error, code) => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.mocked(completeSwellWatchStudyRun).mockImplementationOnce(async (...args) => {
      args[4]?.("study_evaluation");
      throw error;
    });
    const response = await call();
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ details: { stage: "study_evaluation", code, enqueued: 0 } });
    expect(log).toHaveBeenCalledWith("[swell-watch-acquire] automated study failed", { stage: "study_evaluation", code });
  });

  it.each(["issuance_accepted_under_previous_epoch", "latest_issuance_stale"] as const)("skips expected completion outcome %s", async (reason) => {
    jest.mocked(completeSwellWatchStudyRun).mockRejectedValueOnce(new SwellWatchStudySkip(reason));
    const response = await call();
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ skipped: true, reason, ...receipt, recovery: { processed: 0, failed: 0 }, qualification: "automated_study", enqueued: 0 });
  });

  it.each([
    ["client", "unknown"], ["health", "study_health_unavailable"],
    ["recovery", "pending_study_runs_unavailable"], ["health_after_recovery", "study_health_unavailable"],
  ])("logs the fixed %s failure stage without changing its public error", async (stage, code) => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    if (stage === "client") jest.mocked(createSupabaseServiceRoleClient).mockImplementation(() => { throw new Error("secret"); });
    if (stage === "health") jest.mocked(readSwellWatchStudyStatus).mockRejectedValueOnce(new Error("Study health unavailable"));
    if (stage === "recovery") jest.mocked(recoverSwellWatchStudyRuns).mockRejectedValueOnce(new Error("Pending study runs unavailable"));
    if (stage === "health_after_recovery") {
      jest.mocked(recoverSwellWatchStudyRuns).mockResolvedValueOnce({ processed: 1, failed: 0 });
      jest.mocked(readSwellWatchStudyStatus).mockResolvedValueOnce({ status: "active", qualificationRule: "primary_partition_with_retained_unavailable_secondary.v1" }).mockRejectedValueOnce(new Error("Study health unavailable"));
    }
    const response = await call();
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ details: { stage, code, enqueued: 0 } });
    expect(log).toHaveBeenCalledWith("[swell-watch-acquire] automated study failed", { stage, code });
    expect(acquireSwellWatchCohort).not.toHaveBeenCalled();
  });

  it.each(["collection_lease", "acquisition_scope", "provider_fetch", "receipt_storage", "lease_release"] as const)("retains the %s I/O substage", async (stage) => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.mocked(acquireSwellWatchCohort).mockImplementationOnce(async (_cohort, _client, onStage) => {
      onStage?.(stage);
      throw new TypeError("fetch failed");
    });
    const response = await call();
    expect(response.status).toBe(500);
    expect(log).toHaveBeenCalledWith("[swell-watch-acquire] automated study failed", { stage, code: "network_fetch_failed" });
    expect(completeSwellWatchStudyRun).not.toHaveBeenCalled();
  });

  it.each([
    [new Error("Provider run is not ready after replication delay"), "provider_run_is_not_ready_after_replication_delay"],
    [new Error("Single Runs tuple is invalid"), "single_runs_tuple_is_invalid"],
    [new Error("Provider run receipt storage failed: secret credentials and payload"), "provider_receipt_storage_failed"],
    [new Error("Acquisition scope read failed: secret coordinates"), "acquisition_scope_read_failed"],
    [new z.ZodError([{ code: "custom", path: ["secret"], message: "private payload" }]), "schema_validation_failed"],
    [new SyntaxError("private JSON"), "json_parse_failed"],
    [new TypeError("fetch failed"), "network_fetch_failed"],
    [Object.assign(new Error("private URL"), { name: "TimeoutError" }), "request_aborted_or_timed_out"],
    [new Error("Single Runs tuple is invalid: secret suffix"), "unknown"],
    [{ message: "private message", code: "private code" }, "unknown"],
    [null, "unknown"],
  ])("logs only an allowlisted acquisition code (%#)", async (error, code) => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.mocked(acquireSwellWatchCohort).mockRejectedValueOnce(error);
    const response = await call();
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ details: { stage: "acquisition", code, enqueued: 0 } });
    expect(log).toHaveBeenCalledWith("[swell-watch-acquire] automated study failed", { stage: "acquisition", code });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private|secret|credentials|payload/);
    expect(completeSwellWatchStudyRun).not.toHaveBeenCalled();
  });
});
afterEach(() => { process.env = originalEnv; jest.restoreAllMocks(); });

async function call(token = "fixture-secret", query = ""): Promise<Response> {
  const response = await GET(new Request(`http://localhost/api/cron/swell-watch-acquire${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  }));
  expect(response.headers.get("Cache-Control")).toBe("private, no-store, no-cache, must-revalidate");
  return response;
}

it("authenticates before checking the default-off flag and never collects while disabled", async () => {
  delete process.env.SWELL_WATCH_ACQUISITION_ENABLED;
  expect((await call("wrong")).status).toBe(401);
  const response = await call();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { skipped: true, reason: "disabled", enqueued: 0 } });
  expect(acquireSwellWatchCohort).not.toHaveBeenCalled();
});

it("rejects caller-supplied acquisition overrides", async () => {
  expect((await call("fixture-secret", "?run=2026-09-06T00:00Z")).status).toBe(400);
  expect(acquireSwellWatchCohort).not.toHaveBeenCalled();
});

it.each([null, {}, { cohort: [] }, { cohort: [...cohort, ...cohort] },
  { cohort, extra: true }, { cohort: [{ sourcePointId: "bad", regionKey: "fixture" }] },
  { cohort: Array.from({ length: 11 }, (_, i) => ({ sourcePointId: `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`, regionKey: "fixture" })) },
])("rejects invalid server configuration: %j", async (config) => {
  process.env.SWELL_WATCH_PRODUCER_CONFIG = JSON.stringify(config);
  expect((await call()).status).toBe(503);
  expect(acquireSwellWatchCohort).not.toHaveBeenCalled();
});

it("captures only the server cohort without treating receipts as qualified evaluations", async () => {
  const response = await call();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { ...receipt, qualification: "prototype_unqualified", enqueued: 0 } });
  expect(acquireSwellWatchCohort).toHaveBeenCalledTimes(1);
  expect(acquireSwellWatchCohort).toHaveBeenCalledWith(cohort, expect.anything(), expect.any(Function));
});

it("preserves a busy lease outcome without inventing a receipt", async () => {
  jest.mocked(acquireSwellWatchCohort).mockResolvedValueOnce({ skipped: true, reason: "collection_in_progress", enqueued: 0 });
  const response = await call();
  expect(response.status).toBe(200);
  expect((await response.json()).data).toEqual({ skipped: true, reason: "collection_in_progress", qualification: "prototype_unqualified", enqueued: 0 });
});

it("returns a sanitized real failure when collection fails", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  jest.mocked(acquireSwellWatchCohort).mockRejectedValueOnce(new Error("private-provider-detail"));
  const response = await call();
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("private-provider-detail");
  expect(log).toHaveBeenCalledWith("[swell-watch-acquire] acquisition failed", { stage: "acquisition", code: "unknown" });
});
