/**
 * 21-03 Task 2 — the Seaside -> SQL -> TypeScript normalized issue contract.
 *
 * This proves ONE concrete row, not three independent lists of field names.
 * The row is real: it is `_serialize_issue` output from 21-01's production
 * WaveCast parser run over the bounded corpus capture of
 * `https://wavecast.com/forecasts/hawaii/`.
 *
 * The three contracts under test:
 *   1. Seaside  — `trusted_forecasts/models.py` + `crons/_serialize_issue`
 *   2. SQL      — `supabase/migrations/20260727231500_..._adjustments.sql`
 *   3. TypeScript — `parseTrustedForecastIssue` in `trusted-forecast-policy.ts`
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import {
  TRUSTED_FORECAST_DAY_PARTS,
  TRUSTED_FORECAST_EVIDENCE_CLASSES,
  TRUSTED_FORECAST_ISSUE_INPUT_FIELDS,
  TRUSTED_FORECAST_MEASUREMENT_BASES,
  TRUSTED_FORECAST_SCOPE_TYPES,
  TRUSTED_FORECAST_VALIDITY_BASES,
  TrustedForecastIssueContractError,
  parseTrustedForecastIssue,
} from "../trusted-forecast-policy";
import {
  REAL_ISSUE_FIXTURE,
  realIssueRow,
  storedIssueId,
} from "./fixtures/trusted-forecast-real-issues";

const MIGRATION_PATH = path.join(
  __dirname,
  "../../../../supabase/migrations/20260727231500_create_trusted_external_forecast_adjustments.sql",
);
const MIGRATION_SQL = readFileSync(MIGRATION_PATH, "utf8");

/** The `CREATE TABLE public.trusted_forecast_issues (...)` body, verbatim. */
function issuesTableSql(): string {
  const start = MIGRATION_SQL.indexOf(
    "CREATE TABLE public.trusted_forecast_issues (",
  );
  expect(start).toBeGreaterThan(-1);
  const end = MIGRATION_SQL.indexOf(
    "CREATE INDEX trusted_forecast_issues",
    start,
  );
  expect(end).toBeGreaterThan(start);
  return MIGRATION_SQL.slice(start, end);
}

function migrationColumnNames(): string[] {
  const columns: string[] = [];
  for (const line of issuesTableSql().split("\n")) {
    const match = /^ {2}([a-z_]+) (?!.*^\s*CONSTRAINT)/.exec(line);
    if (match === null) continue;
    if (line.trimStart().startsWith("CONSTRAINT")) continue;
    columns.push(match[1]);
  }
  return columns;
}

/** Vocabulary inside a `CHECK (<column> IN (...))` on the issues table. */
function migrationCheckVocabulary(column: string): string[] {
  const table = issuesTableSql();
  const pattern = new RegExp(`CHECK \\(\\s*${column} IN \\(([^)]*)\\)`, "s");
  const match = pattern.exec(table);
  expect(match).not.toBeNull();
  return [...(match as RegExpExecArray)[1].matchAll(/'([a-z_]+)'/g)].map(
    (hit) => hit[1],
  );
}

const REPRESENTATIVE_DOCUMENT = "wavecast_regional_live_hawaii";
const REPRESENTATIVE_INDEX = 0;

function representativeRow(): Record<string, unknown> {
  return realIssueRow(REPRESENTATIVE_DOCUMENT, REPRESENTATIVE_INDEX);
}

describe("trusted forecast normalized issue: fixture provenance", () => {
  it("every fixture row is real Seaside parser output, not a hand-written shape", () => {
    expect(REAL_ISSUE_FIXTURE.provenance.everyRowIsRealParserOutput).toBe(true);
    expect(REAL_ISSUE_FIXTURE.provenance.producedBy).toContain("_serialize_issue");
    expect(REAL_ISSUE_FIXTURE.provenance.seasideCorpus).toBe(
      "tests/fixtures/trusted_forecasts/corpus.json",
    );
    expect(REAL_ISSUE_FIXTURE.issueCount).toBe(196);
  });

  it("the corpus really does produce every day_part and validity_basis value", () => {
    const dayParts = new Set<unknown>();
    const bases = new Set<unknown>();
    for (const document of Object.values(REAL_ISSUE_FIXTURE.documents)) {
      for (const issue of document.issues) {
        dayParts.add(issue.day_part);
        bases.add(issue.validity_basis);
      }
    }
    expect([...dayParts].sort()).toEqual(["all_day", "day", "night"]);
    expect([...bases].sort()).toEqual(["derived_publication_day", "stated"]);
  });
});

describe("trusted forecast normalized issue: one representative row, three contracts", () => {
  it("is the exact WaveCast Hawaii row 21-01 serializes", () => {
    // Pinned so a Seaside parser change that silently alters this row's
    // semantics fails here rather than downstream in the engine.
    expect(representativeRow()).toEqual({
      authority_eligible: true,
      beach_id: null,
      day_part: "all_day",
      direction_deg: 271.0,
      evidence_class: "human_face_height_authority",
      exposure: "NNW",
      fetched_at: "2026-08-06T20:00:00+00:00",
      ingest_run_id: null,
      issue_identity_key:
        "ab1b7d2fda05a280754a3c2a956365ed7720d5903edb3831e0ed30b39abfa51e",
      issued_at: "2026-08-06T04:15:00-10:00",
      max_face_ft: 1.0,
      measurement_basis: "breaking_face_ft",
      min_face_ft: 0.0,
      parser_version: "wavecast-v3",
      period_seconds: 11.0,
      provider_lineage: "wavecast",
      region_key: "hawaii",
      revision_hash:
        "e72543441802fa2a97ca91dd84117a74cd780838e3cfeda98ad2c71063a4ef24",
      scope_type: "regional",
      source_hash:
        "99de32d30189063ad3b289626ef06a81a89d3d76f6949d339b106cefeef710f7",
      source_key: "hawaii",
      supersedes_issue_id: null,
      valid_end_at: "2026-08-06T10:00:00+00:00",
      valid_local_date: "2026-08-05",
      valid_start_at: "2026-08-05T10:00:00+00:00",
      valid_timezone: "Pacific/Honolulu",
      validity_basis: "stated",
    });
  });

  it("carries exactly the field set the TypeScript boundary declares", () => {
    expect(Object.keys(representativeRow()).sort()).toEqual(
      [...TRUSTED_FORECAST_ISSUE_INPUT_FIELDS].sort(),
    );
  });

  it("is accepted by the production TypeScript parser and mapped to camelCase", () => {
    const row = representativeRow();
    row.issue_id = storedIssueId(REPRESENTATIVE_DOCUMENT, REPRESENTATIVE_INDEX);
    const issue = parseTrustedForecastIssue(row);

    expect(issue.providerLineage).toBe("wavecast");
    expect(issue.sourceKey).toBe("hawaii");
    expect(issue.scopeType).toBe("regional");
    expect(issue.regionKey).toBe("hawaii");
    expect(issue.exposure).toBe("NNW");
    expect(issue.dayPart).toBe("all_day");
    expect(issue.validityBasis).toBe("stated");
    expect(issue.measurementBasis).toBe("breaking_face_ft");
    expect(issue.authorityEligible).toBe(true);
    expect(issue.evidenceClass).toBe("human_face_height_authority");
    expect(issue.minFaceFt).toBe(0);
    expect(issue.maxFaceFt).toBe(1);
    expect(issue.validLocalDate).toBe("2026-08-05");
    expect(issue.validTimezone).toBe("Pacific/Honolulu");
    // `-10:00` is a real offset Seaside emits; it must survive as an instant.
    expect(issue.issuedAt.toISOString()).toBe("2026-08-06T14:15:00.000Z");
    expect(issue.validStartAt.toISOString()).toBe("2026-08-05T10:00:00.000Z");
    expect(issue.validEndAt.toISOString()).toBe("2026-08-06T10:00:00.000Z");
    expect(issue.beachId).toBeNull();
    expect(issue.supersedesIssueId).toBeNull();
  });

  it("has a storage column for every field, and no extra required field", () => {
    const columns = migrationColumnNames();
    const seasideFields = Object.keys(representativeRow());

    for (const field of seasideFields) {
      expect(columns).toContain(field);
    }
    // The only storage columns Seaside does not send are database-assigned.
    expect(columns.filter((column) => !seasideFields.includes(column))).toEqual([
      "issue_id",
      "created_at",
    ]);
  });

  it("agrees with the migration on every enum vocabulary", () => {
    expect(migrationCheckVocabulary("scope_type")).toEqual([
      ...TRUSTED_FORECAST_SCOPE_TYPES,
    ]);
    expect(migrationCheckVocabulary("day_part")).toEqual([
      ...TRUSTED_FORECAST_DAY_PARTS,
    ]);
    expect(migrationCheckVocabulary("validity_basis")).toEqual([
      ...TRUSTED_FORECAST_VALIDITY_BASES,
    ]);
    expect(migrationCheckVocabulary("measurement_basis")).toEqual([
      ...TRUSTED_FORECAST_MEASUREMENT_BASES,
    ]);
    expect(migrationCheckVocabulary("evidence_class")).toEqual([
      ...TRUSTED_FORECAST_EVIDENCE_CLASSES,
    ]);
  });

  it("agrees with the migration on the SHA-256 hash format", () => {
    const table = issuesTableSql();
    expect(table).toContain("CHECK (issue_identity_key ~ '^[0-9a-f]{64}$')");
    expect(table).toContain("CHECK (revision_hash ~ '^[0-9a-f]{64}$')");

    for (const field of [
      "issue_identity_key",
      "revision_hash",
      "source_hash",
    ] as const) {
      const value = representativeRow()[field];
      expect(typeof value).toBe("string");
      expect(value).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("rejects a hash that is not lowercase 64-char hex", () => {
    const row = representativeRow();
    row.revision_hash = "E72543441802FA2A97CA91DD84117A74CD780838E3CFEDA98AD2C71063A4EF24";
    expect(() => parseTrustedForecastIssue(row)).toThrow(
      TrustedForecastIssueContractError,
    );
  });

  it("fails when any required field is removed", () => {
    for (const field of TRUSTED_FORECAST_ISSUE_INPUT_FIELDS) {
      const row = representativeRow();
      delete row[field];
      expect(() => parseTrustedForecastIssue(row)).toThrow(
        new RegExp(`"${field}" is required`),
      );
    }
  });

  it("fails when a required field is renamed", () => {
    const row = representativeRow();
    row.providerLineage = row.provider_lineage;
    delete row.provider_lineage;
    expect(() => parseTrustedForecastIssue(row)).toThrow(
      /"provider_lineage" is required/,
    );
  });

  it("rejects a value outside each enum vocabulary", () => {
    for (const field of [
      "scope_type",
      "day_part",
      "validity_basis",
      "measurement_basis",
      "evidence_class",
    ] as const) {
      const row = representativeRow();
      row[field] = "not_a_real_value";
      expect(() => parseTrustedForecastIssue(row)).toThrow(
        new RegExp(`"${field}" must be one of`),
      );
    }
  });

  it("enforces the migration's numeric bounds", () => {
    const cases: readonly [string, unknown, RegExp][] = [
      ["max_face_ft", 60.0001, /within 0\.\.60 feet/],
      ["min_face_ft", -0.0001, /within 0\.\.60 feet/],
      ["direction_deg", 360, /within 0\.\.<360 degrees/],
      ["period_seconds", 120.0001, /within >0\.\.120 seconds/],
      ["period_seconds", 0, /within >0\.\.120 seconds/],
    ];
    for (const [field, value, message] of cases) {
      const row = representativeRow();
      row[field] = value;
      expect(() => parseTrustedForecastIssue(row)).toThrow(message);
    }
  });

  it("enforces the migration's paired-bound and ordering constraints", () => {
    const missingHalf = representativeRow();
    missingHalf.max_face_ft = null;
    expect(() => parseTrustedForecastIssue(missingHalf)).toThrow(
      /both be present or both be null/,
    );

    const reversed = representativeRow();
    reversed.min_face_ft = 4;
    reversed.max_face_ft = 2;
    expect(() => parseTrustedForecastIssue(reversed)).toThrow(
      /must not exceed max_face_ft/,
    );

    const badWindow = representativeRow();
    badWindow.valid_end_at = badWindow.valid_start_at;
    expect(() => parseTrustedForecastIssue(badWindow)).toThrow(
      /must be after valid_start_at/,
    );
  });

  it("enforces the migration's authority-requires-measurement constraint", () => {
    const table = issuesTableSql();
    expect(table).toContain(
      "trusted_forecast_issues_authority_check",
    );

    for (const override of [
      { measurement_basis: "unspecified" },
      { evidence_class: "model_buoy_evidence" },
      { min_face_ft: null, max_face_ft: null },
    ]) {
      const row = { ...representativeRow(), ...override };
      expect(() => parseTrustedForecastIssue(row)).toThrow(
        /requires a measured breaking-face range|both be present or both be null/,
      );
    }
  });

  it("rejects timestamps with no explicit offset and malformed local dates", () => {
    const naive = representativeRow();
    naive.issued_at = "2026-08-06T04:15:00";
    expect(() => parseTrustedForecastIssue(naive)).toThrow(
      /"issued_at" must carry an explicit UTC offset/,
    );

    const badDate = representativeRow();
    badDate.valid_local_date = "2026-8-5";
    expect(() => parseTrustedForecastIssue(badDate)).toThrow(
      /YYYY-MM-DD local calendar date/,
    );

    const badZone = representativeRow();
    badZone.valid_timezone = "Pacific/Nowhere";
    expect(() => parseTrustedForecastIssue(badZone)).toThrow(
      /valid IANA timezone/,
    );
  });

  it("accepts every real issue the bounded corpus produces", () => {
    let parsed = 0;
    for (const [documentId, document] of Object.entries(
      REAL_ISSUE_FIXTURE.documents,
    )) {
      document.issues.forEach((_, index) => {
        const row = realIssueRow(documentId, index);
        row.issue_id = storedIssueId(documentId, index);
        expect(() => parseTrustedForecastIssue(row)).not.toThrow();
        parsed += 1;
      });
    }
    expect(parsed).toBe(REAL_ISSUE_FIXTURE.issueCount);
    expect(parsed).toBe(196);
  });
});
