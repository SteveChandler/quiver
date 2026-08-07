import { createHash } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  PHASE0_BASELINE_HARNESS_JSON,
  buildPhase0AppDeployGateSteps,
  buildPhase0GateEvidence,
  type Phase0GateRunResult,
} from "../phase0-app-deploy-gate";
import {
  PHASE0_MIGRATION_APPROVAL_PLAN_SHA256,
  PHASE0_MIGRATION_APPROVAL_PLAN_TEXT,
  PHASE0_MIGRATION_APPROVAL_PHRASE,
  parsePhase0MigrationPreapplyCliArgs,
  validatePhase0MigrationPreapplyPacket,
} from "../phase0-migration-preapply-check";

const NOW = new Date("2026-06-20T16:00:00.000Z");
const FRESH_BACKUP_MTIME = new Date("2026-06-20T15:30:00.000Z");
const STALE_BACKUP_MTIME = new Date("2026-06-19T15:59:59.000Z");

const PHASE0_PREFLIGHT_STDOUT = `
                 check_name
--------------------------------------------
 phase0_face_hs_display_source_contract_30d
(1 row)

 candidate_rows | face_hs_display_source_rows | model_version_face_hs_without_display_source_rows | missing_display_source_rows | other_display_source_rows
----------------+-----------------------------+---------------------------------------------------+-----------------------------+---------------------------
          76228 |                       76228 |                                                 0 |                           0 |                         0
(1 row)

             check_name
------------------------------------
 phase0_preflight_readiness_summary
(1 row)

 legacy_short_horizon_starvation_detected | can_request_phase0_migration_approval
------------------------------------------+---------------------------------------
 t                                        | t
(1 row)

        check_name
---------------------------
 phase0_preflight_blockers
(1 row)

 blocker_code | blocker_message
--------------+-----------------
(0 rows)

 phase0_preflight_assertions_passed
------------------------------------
                                  1
(1 row)
`;

const SNAPSHOT_LOGGING_HEALTH_STDOUT = `
                  check_name
----------------------------------------------
 phase0_snapshot_logging_health_legacy_window
(1 row)

 total_rows | distinct_beaches | rows_missing_canonical_model_version | rows_missing_valid_horizon_hours | rows_missing_display_heights
------------+------------------+--------------------------------------+----------------------------------+------------------------------
       2521 |              318 |                                    0 |                                0 |                            0
(1 row)

               check_name
-----------------------------------------
 phase0_snapshot_logging_health_blockers
(1 row)

 blocker_code | blocker_message | detail
--------------+-----------------+--------
(0 rows)

 phase0_snapshot_logging_health_assertions_passed
--------------------------------------------------
                                                1
(1 row)
`;

function writeBaselineHarnessFixture(): void {
  const baselines = [
    "current_display",
    "raw_display",
    "raw_om",
    "v5_shadow",
  ];
  writeFileSync(
    PHASE0_BASELINE_HARNESS_JSON,
    `${JSON.stringify(
      {
        report_schema_version: 1,
        generated_at: "2026-06-20T15:45:00.000Z",
        range: {
          start: "2026-05-21T15:45:00.000Z",
          end: "2026-06-20T15:45:00.000Z",
        },
        truth_source: "both",
        row_counts: {
          buoy_observation_rows: 100,
          session_observation_rows: 10,
          matched_prediction_rows: 110,
          matched_0_72h_rows: 75,
          matched_0_72h_rows_with_horizon_bucket_provenance: 75,
          matched_0_72h_rows_without_horizon_bucket_provenance: 0,
          matched_0_72h_rows_with_replay_provenance: 75,
          matched_0_72h_rows_without_replay_provenance: 0,
          proposed_rows_compared: 0,
          rows_without_proposed_value: 0,
        },
        gate_metrics: baselines.map((baseline, index) => ({
          horizon_group: "0-72h",
          baseline,
          baseline_label: baseline,
          sample_count: 75,
          mae_m: 0.2 + index / 100,
          bias_m: -0.1 + index / 100,
        })),
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

function buildSqlStepOutputs(): Phase0GateRunResult["stepOutputs"] {
  writeBaselineHarnessFixture();
  return [
    {
      id: "phase0-baseline-harness",
      stdout: `Wrote harness report JSON: ${PHASE0_BASELINE_HARNESS_JSON}\n`,
      stderr: "",
    },
    {
      id: "phase0-baseline-validate",
      stdout:
        "Forecast accuracy report validation passed.\nRows compared: 110; rows without proposed value: 0.\n",
      stderr: "",
    },
    {
      id: "phase0-preflight",
      stdout: PHASE0_PREFLIGHT_STDOUT,
      stderr: "",
    },
    {
      id: "snapshot-logging-health",
      stdout: SNAPSHOT_LOGGING_HEALTH_STDOUT,
      stderr: "",
    },
  ];
}

async function writeEvidenceJson(
  evidenceJsonPath: string,
  deployStartUtc: string | null
): Promise<void> {
  const options = {
    includePreviewBuild: true,
    includeReadOnlySql: true,
    includeBaselineHarness: true,
    envFile: ".env.production.local",
    deployStartUtc,
    outputJsonPath: evidenceJsonPath,
    validateOutputJsonPath: null,
    printOnly: false,
    postgresUrl: "postgres://readonly.example",
  };
  const stepsRun = buildPhase0AppDeployGateSteps(options).map(
    (step) => step.id
  );
  const evidence = buildPhase0GateEvidence(
    options,
    {
      stepsRun,
      stepOutputs: buildSqlStepOutputs(),
    },
    NOW
  );

  await writeFile(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`);
}

async function writeBackupFile(
  backupPath: string,
  modifiedAt: Date = FRESH_BACKUP_MTIME
): Promise<void> {
  await writeFile(backupPath, Buffer.alloc(2048, 1));
  await utimes(backupPath, modifiedAt, modifiedAt);
}

describe("phase0-migration-preapply-check", () => {
  let testDir: string;
  let evidenceJsonPath: string;
  let backupPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `quiver-phase0-preapply-${process.pid}`);
    evidenceJsonPath = join(testDir, "post-deploy-evidence.json");
    backupPath = join(testDir, "quiver-prod-phase0-preapply.dump");
    await rm(testDir, { force: true, recursive: true });
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { force: true, recursive: true });
    rmSync(PHASE0_BASELINE_HARNESS_JSON, { force: true });
  });

  it("accepts fresh post-deploy evidence, fresh backup, and the exact approval phrase", async () => {
    await writeEvidenceJson(evidenceJsonPath, "2026-06-20T15:00:00.000Z");
    await writeBackupFile(backupPath);

    await expect(
      validatePhase0MigrationPreapplyPacket({
        evidenceJsonPath,
        backupPath,
        approvalPhrase: PHASE0_MIGRATION_APPROVAL_PHRASE,
        now: NOW,
      })
    ).resolves.toMatchObject({
      ok: true,
      blockers: [],
      backup: {
        path: backupPath,
        size_bytes: 2048,
        age_hours: 0.5,
      },
      approval_phrase_accepted: true,
    });
  });

  it("rejects pre-deploy evidence, missing backups, and wrong approval phrases", async () => {
    await writeEvidenceJson(evidenceJsonPath, null);

    await expect(
      validatePhase0MigrationPreapplyPacket({
        evidenceJsonPath,
        backupPath,
        approvalPhrase: "APPROVE: wrong",
        now: NOW,
      })
    ).resolves.toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        "evidence_deploy_start_utc_required",
        "backup_missing",
        "approval_phrase_mismatch",
      ]),
    });
  });

  it("binds the approval phrase to the canonical pre-apply plan text", () => {
    const expectedHash = createHash("sha256")
      .update(PHASE0_MIGRATION_APPROVAL_PLAN_TEXT)
      .digest("hex");

    expect(PHASE0_MIGRATION_APPROVAL_PLAN_TEXT).toContain(
      "scripts/phase0-migration-preapply-check.ts"
    );
    expect(PHASE0_MIGRATION_APPROVAL_PLAN_TEXT).toContain(
      "--post-deploy-evidence-json /tmp/quiver-phase0-app-deploy-gate-post-deploy.json"
    );
    expect(PHASE0_MIGRATION_APPROVAL_PLAN_TEXT).toContain(
      "--backup-path /tmp/quiver-prod-phase0-forecast-accuracy-preapply-20260620.dump"
    );
    expect(PHASE0_MIGRATION_APPROVAL_PLAN_SHA256).toBe(expectedHash);
    expect(PHASE0_MIGRATION_APPROVAL_PHRASE).toBe(
      `APPROVE: ${expectedHash}`
    );
    expect(PHASE0_MIGRATION_APPROVAL_PHRASE).not.toBe(
      "APPROVE: 84281344779a77bea004d9312f88bca8ceac0dbe7e771c4d6780a353f877d649"
    );
  });

  it("keeps the approval request document in sync with the canonical plan text", () => {
    const approvalRequest = readFileSync(
      "docs/research/2026-06-19-phase0-migration-approval-request.md",
      "utf8"
    );
    const planMatch = approvalRequest.match(
      /```text\n(PHASE0_FORECAST_ACCURACY_MIGRATION_PLAN_V1[\s\S]*?)\n```/
    );

    expect(approvalRequest).toContain(PHASE0_MIGRATION_APPROVAL_PHRASE);
    expect(planMatch?.[1]).toBe(PHASE0_MIGRATION_APPROVAL_PLAN_TEXT);
  });

  it("rejects stale, empty, or future-dated backup artifacts", async () => {
    await writeEvidenceJson(evidenceJsonPath, "2026-06-20T15:00:00.000Z");
    await writeBackupFile(backupPath, STALE_BACKUP_MTIME);

    await expect(
      validatePhase0MigrationPreapplyPacket({
        evidenceJsonPath,
        backupPath,
        approvalPhrase: PHASE0_MIGRATION_APPROVAL_PHRASE,
        now: NOW,
      })
    ).resolves.toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["backup_too_old"]),
    });

    await writeFile(backupPath, "");
    await utimes(backupPath, FRESH_BACKUP_MTIME, FRESH_BACKUP_MTIME);

    await expect(
      validatePhase0MigrationPreapplyPacket({
        evidenceJsonPath,
        backupPath,
        approvalPhrase: PHASE0_MIGRATION_APPROVAL_PHRASE,
        now: NOW,
      })
    ).resolves.toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["backup_too_small"]),
    });

    await writeBackupFile(backupPath, new Date("2026-06-20T16:10:01.000Z"));

    await expect(
      validatePhase0MigrationPreapplyPacket({
        evidenceJsonPath,
        backupPath,
        approvalPhrase: PHASE0_MIGRATION_APPROVAL_PHRASE,
        now: NOW,
      })
    ).resolves.toMatchObject({
      ok: false,
      blockers: expect.arrayContaining(["backup_mtime_in_future"]),
    });
  });

  it("parses CLI args without accepting migration execution flags", () => {
    expect(
      parsePhase0MigrationPreapplyCliArgs([
        "--post-deploy-evidence-json",
        evidenceJsonPath,
        "--backup-path",
        backupPath,
        "--approval-phrase",
        PHASE0_MIGRATION_APPROVAL_PHRASE,
        "--max-evidence-age-hours",
        "12",
        "--max-backup-age-hours=12",
      ])
    ).toEqual({
      evidenceJsonPath,
      backupPath,
      approvalPhrase: PHASE0_MIGRATION_APPROVAL_PHRASE,
      maxEvidenceAgeHours: 12,
      maxBackupAgeHours: 12,
      minBackupBytes: 1024,
    });

    expect(() =>
      parsePhase0MigrationPreapplyCliArgs(["--apply-migration"])
    ).toThrow("Unknown argument: --apply-migration.");
  });
});
