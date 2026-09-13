import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { deriveSwellWatchFixture } from "./derive-swell-watch-fixture";

import {
  buildCorpusManifest,
  sanitizeSwellWatchCorpusRows,
  type CandidateCorpusRow,
  type ShadowCorpusManifest,
} from "./export-swell-watch-shadow-corpus";
import {
  verifySwellWatchPolicy,
  type SwellWatchPolicy,
} from "@/lib/alerts/swell-watch/policy";

export interface CalibrationCorpus {
  rows: CandidateCorpusRow[];
  manifest: Pick<ShadowCorpusManifest, "status" | "corpus_hash" | "coverage">;
}

interface BlockedCalibration {
  status: "blocked";
  corpus_hash: string;
  profile: null;
  profile_hash: null;
  blockers: string[];
}

export interface FixtureCalibration {
  status: "provisional_fixture";
  profile_id: string;
  policy_hash: string;
  production_approved: false;
  reviewer: null;
  limitations: [
    "fixture values are deterministic test inputs, not observed safe thresholds",
  ];
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashRows(rows: CandidateCorpusRow[]): string {
  return createHash("sha256").update(stableStringify(rows)).digest("hex");
}

export function calibrateSwellWatch(
  corpus: CalibrationCorpus,
): BlockedCalibration {
  const rows = sanitizeSwellWatchCorpusRows(corpus.rows);
  if (!corpus.manifest.coverage.eligible_for_calibration) {
    return {
      status: "blocked",
      corpus_hash: corpus.manifest.corpus_hash,
      profile: null,
      profile_hash: null,
      blockers: ["manifest coverage is not eligible for calibration"],
    };
  }
  const blockers: string[] = [];
  if (corpus.manifest.status !== "ready") {
    blockers.push("manifest status is not ready");
  }
  if (hashRows(rows) !== corpus.manifest.corpus_hash) {
    blockers.push("manifest corpus hash does not match sanitized rows");
  }
  if (
    rows.some(
      (row) => row.provenance === "fixture" || row.provenance === "replay",
    )
  ) {
    blockers.push("fixture or replay rows cannot select a policy profile");
  }

  return {
    status: "blocked",
    corpus_hash: corpus.manifest.corpus_hash,
    profile: null,
    profile_hash: null,
    blockers:
      blockers.length > 0 ? blockers : ["human profile approval is required"],
  };
}

export function calibrateFixturePolicy(
  policy: SwellWatchPolicy,
): FixtureCalibration {
  if (!verifySwellWatchPolicy(policy)) {
    throw new Error("fixture policy hash is invalid");
  }
  if (
    policy.provenance !== "provisional_fixture" ||
    policy.approval_evidence !== null
  ) {
    throw new Error(
      "fixture mode requires an unapproved provisional fixture policy",
    );
  }
  return {
    status: "provisional_fixture",
    profile_id: policy.profile_id,
    policy_hash: policy.value_hash,
    production_approved: false,
    reviewer: null,
    limitations: [
      "fixture values are deterministic test inputs, not observed safe thresholds",
    ],
  };
}

function requiredArgument(args: string[], name: string): string {
  const index = args.indexOf(name);
  const value = args[index + 1];
  if (index === -1 || !value)
    throw new Error(`missing required argument ${name}`);
  return value;
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const mode = requiredArgument(args, "--mode");
  if (mode === "derivation-fixtures") {
    const result = deriveSwellWatchFixture(JSON.parse(await readFile(requiredArgument(args, "--input"), "utf8")));
    console.log(stableStringify(result));
    if (result.kind === "suppressed") process.exitCode = 1;
    return;
  }
  if (mode === "fixtures") {
    const fixturePath = requiredArgument(args, "--fixture");
    const result = calibrateFixturePolicy(
      JSON.parse(await readFile(fixturePath, "utf8")) as SwellWatchPolicy,
    );
    console.log(stableStringify(result));
    return;
  }
  if (mode !== "live-evidence") {
    throw new Error("--mode must be fixtures, derivation-fixtures or live-evidence");
  }
  const inputPath = requiredArgument(args, "--input");
  const manifestPath = requiredArgument(args, "--manifest");
  requiredArgument(args, "--output");
  const rows = (await readFile(inputPath, "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const manifest = JSON.parse(
    await readFile(manifestPath, "utf8"),
  ) as ShadowCorpusManifest;
  const recalculated = buildCorpusManifest(rows, {
    from: manifest.window_start,
    to: manifest.window_end,
    active_scope: {
      inventory_id: manifest.active_scope_inventory_id,
      inventory_hash: manifest.active_scope_inventory_hash,
      active_beach_pseudonyms: manifest.active_beach_pseudonyms,
      active_region_ids: manifest.active_region_ids,
    },
  });

  const coverageMatches =
    stableStringify(recalculated.coverage.assertions) ===
    stableStringify(manifest.coverage.assertions);
  if (
    recalculated.corpus_hash !== manifest.corpus_hash ||
    !coverageMatches ||
    !manifest.coverage.eligible_for_calibration
  ) {
    throw new Error("blocked: corpus hash or coverage assertions failed");
  }
  const result = calibrateSwellWatch({ rows, manifest });
  if (result.status === "blocked")
    throw new Error(`blocked: ${result.blockers.join("; ")}`);
}

if (require.main === module) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
