/**
 * Loader for `trusted-forecast-issues.real.json`.
 *
 * Every row in that file is output of 21-01's SHIPPED Seaside parsers
 * (`trusted_forecasts.parsers`) plus its shipped
 * `crons.fetch_trusted_forecasts._serialize_issue`, run over the bounded
 * corpus. Nothing in it was authored by hand — see
 * `generate-trusted-forecast-issue-fixture.py` beside it.
 *
 * Provenance rule enforced here: a test may use a row verbatim
 * (`realIssueRow` / `realIssue`), or it may DERIVE one with explicitly named
 * field overrides (`derivedIssue`), which requires a `note` saying why the live
 * corpus cannot produce that shape. There is no third option, and a ratchet
 * test asserts the derived inventory is complete and annotated.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import {
  parseTrustedForecastIssue,
  type TrustedForecastIssue,
} from "../../trusted-forecast-policy";

interface RealIssueDocument {
  readonly sourceKey: string;
  readonly capture: string | null;
  readonly inlineBody: boolean;
  readonly note: string | null;
  readonly fetchedAt: string;
  readonly issues: readonly Record<string, unknown>[];
}

interface RealIssueFixtureFile {
  readonly provenance: Record<string, unknown>;
  readonly issueCount: number;
  readonly documents: Record<string, RealIssueDocument>;
}

export const REAL_ISSUE_FIXTURE_PATH = path.join(
  __dirname,
  "trusted-forecast-issues.real.json",
);

export const REAL_ISSUE_FIXTURE: RealIssueFixtureFile = JSON.parse(
  readFileSync(REAL_ISSUE_FIXTURE_PATH, "utf8"),
) as RealIssueFixtureFile;

export function realIssueDocument(documentId: string): RealIssueDocument {
  const document = REAL_ISSUE_FIXTURE.documents[documentId];
  if (document === undefined) {
    throw new Error(`unknown real-issue fixture document: ${documentId}`);
  }
  return document;
}

/** The verbatim serialized row, deep-cloned so callers cannot mutate the fixture. */
export function realIssueRow(
  documentId: string,
  index: number,
): Record<string, unknown> {
  const row = realIssueDocument(documentId).issues[index];
  if (row === undefined) {
    throw new Error(`no issue at index ${index} of ${documentId}`);
  }
  return JSON.parse(JSON.stringify(row)) as Record<string, unknown>;
}

/**
 * The database assigns `issue_id` on insert, so Seaside's serialized rows carry
 * none. Tests stand in for that with a deterministic uuid so ordering and
 * foreign-key semantics stay reproducible.
 */
export function storedIssueId(documentId: string, index: number): string {
  let hash = 0x811c9dc5;
  for (const character of `${documentId}#${index}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const suffix = hash.toString(16).padStart(8, "0");
  return `00000000-0000-4000-8000-0000${suffix}`;
}

/** A real row, verbatim, with only the database-assigned `issue_id` added. */
export function realIssue(
  documentId: string,
  index: number,
): TrustedForecastIssue {
  const row = realIssueRow(documentId, index);
  row.issue_id = storedIssueId(documentId, index);
  return parseTrustedForecastIssue(row);
}

export interface DerivedIssueRecord {
  readonly label: string;
  readonly from: string;
  readonly overrides: readonly string[];
  readonly note: string;
}

const DERIVED_REGISTRY: DerivedIssueRecord[] = [];

export function derivedIssueInventory(): readonly DerivedIssueRecord[] {
  return DERIVED_REGISTRY;
}

/**
 * A real row plus explicitly named field overrides.
 *
 * Use only for shapes the live corpus cannot produce — the four disabled
 * sources emit nothing, no live source pairs an authority row with a
 * `derived_publication_day` basis, and no live pair of independent lineages
 * disagrees by more than a foot. Each such fixture must say so.
 */
export function derivedIssue(args: {
  readonly label: string;
  readonly from: { readonly document: string; readonly index: number };
  readonly overrides: Record<string, unknown>;
  readonly note: string;
}): TrustedForecastIssue {
  if (args.note.trim().length === 0) {
    throw new Error(`derived issue ${args.label} must document why it is synthetic`);
  }
  const overrideKeys = Object.keys(args.overrides);
  if (overrideKeys.length === 0) {
    throw new Error(
      `derived issue ${args.label} overrides nothing; use realIssue() instead`,
    );
  }

  const row = realIssueRow(args.from.document, args.from.index);
  for (const key of overrideKeys) {
    if (!(key in row) && key !== "issue_id") {
      throw new Error(
        `derived issue ${args.label} overrides unknown field "${key}"`,
      );
    }
  }
  Object.assign(row, args.overrides);
  if (row.issue_id === undefined) {
    row.issue_id = storedIssueId(args.label, 0);
  }

  DERIVED_REGISTRY.push({
    label: args.label,
    from: `${args.from.document}#${args.from.index}`,
    overrides: overrideKeys,
    note: args.note,
  });

  return parseTrustedForecastIssue(row);
}
