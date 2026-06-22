import type { TerrainAnalysisArgs } from "./types";

/**
 * Parse command-line arguments for terrain analysis.
 */
export function parseTerrainAnalysisArgs(argv: string[]): TerrainAnalysisArgs {
  const args: TerrainAnalysisArgs = {
    dryRun: false,
    force: false,
    concurrency: 4,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--force") {
      args.force = true;
    } else if (arg === "--missing-only") {
      args.missingOnly = true;
    } else if (arg === "--beach-id") {
      args.beachId = readFlagValue(argv[++i], "--beach-id");
    } else if (arg.startsWith("--beach-id=")) {
      args.beachId = readFlagValue(arg.split("=")[1], "--beach-id");
    } else if (arg === "--beach-ids") {
      args.beachIds = splitList(readFlagValue(argv[++i], "--beach-ids"));
    } else if (arg.startsWith("--beach-ids=")) {
      args.beachIds = splitList(
        readFlagValue(arg.split("=")[1], "--beach-ids")
      );
    } else if (arg === "--region") {
      args.region = readFlagValue(argv[++i], "--region");
    } else if (arg.startsWith("--region=")) {
      args.region = readFlagValue(arg.split("=")[1], "--region");
    } else if (arg === "--limit") {
      args.limit = parsePositiveInteger(
        readFlagValue(argv[++i], "--limit"),
        "--limit"
      );
    } else if (arg.startsWith("--limit=")) {
      args.limit = parsePositiveInteger(
        readFlagValue(arg.split("=")[1], "--limit"),
        "--limit"
      );
    } else if (arg === "--offset") {
      args.offset = parseNonNegativeInteger(
        readFlagValue(argv[++i], "--offset"),
        "--offset"
      );
    } else if (arg.startsWith("--offset=")) {
      args.offset = parseNonNegativeInteger(
        readFlagValue(arg.split("=")[1], "--offset"),
        "--offset"
      );
    } else if (arg === "--concurrency") {
      args.concurrency = parsePositiveInteger(
        readFlagValue(argv[++i], "--concurrency"),
        "--concurrency"
      );
    } else if (arg.startsWith("--concurrency=")) {
      args.concurrency = parsePositiveInteger(
        readFlagValue(arg.split("=")[1], "--concurrency"),
        "--concurrency"
      );
    } else if (arg === "--output-json") {
      args.outputJsonPath = readFlagValue(argv[++i], "--output-json");
    } else if (arg.startsWith("--output-json=")) {
      args.outputJsonPath = readFlagValue(arg.split("=")[1], "--output-json");
    } else if (arg === "--validate-output-json") {
      args.validateOutputJsonPath = readFlagValue(
        argv[++i],
        "--validate-output-json"
      );
    } else if (arg.startsWith("--validate-output-json=")) {
      args.validateOutputJsonPath = readFlagValue(
        arg.split("=")[1],
        "--validate-output-json"
      );
    } else if (arg === "--max-artifact-age-hours") {
      args.maxArtifactAgeHours = parsePositiveInteger(
        readFlagValue(argv[++i], "--max-artifact-age-hours"),
        "--max-artifact-age-hours"
      );
    } else if (arg.startsWith("--max-artifact-age-hours=")) {
      args.maxArtifactAgeHours = parsePositiveInteger(
        readFlagValue(arg.split("=")[1], "--max-artifact-age-hours"),
        "--max-artifact-age-hours"
      );
    } else if (arg === "--approval-report-json") {
      args.approvalReportJsonPath = readFlagValue(
        argv[++i],
        "--approval-report-json"
      );
    } else if (arg.startsWith("--approval-report-json=")) {
      args.approvalReportJsonPath = readFlagValue(
        arg.split("=")[1],
        "--approval-report-json"
      );
    } else if (arg === "--approval-proposed-json") {
      args.approvalProposedJsonPath = readFlagValue(
        argv[++i],
        "--approval-proposed-json"
      );
    } else if (arg.startsWith("--approval-proposed-json=")) {
      args.approvalProposedJsonPath = readFlagValue(
        arg.split("=")[1],
        "--approval-proposed-json"
      );
    } else if (arg === "--max-approval-report-age-hours") {
      args.maxApprovalReportAgeHours = parsePositiveInteger(
        readFlagValue(argv[++i], "--max-approval-report-age-hours"),
        "--max-approval-report-age-hours"
      );
    } else if (arg.startsWith("--max-approval-report-age-hours=")) {
      args.maxApprovalReportAgeHours = parsePositiveInteger(
        readFlagValue(arg.split("=")[1], "--max-approval-report-age-hours"),
        "--max-approval-report-age-hours"
      );
    } else if (arg === "--min-approval-gate-samples") {
      args.minApprovalGateSamples = parsePositiveInteger(
        readFlagValue(argv[++i], "--min-approval-gate-samples"),
        "--min-approval-gate-samples"
      );
    } else if (arg.startsWith("--min-approval-gate-samples=")) {
      args.minApprovalGateSamples = parsePositiveInteger(
        readFlagValue(arg.split("=")[1], "--min-approval-gate-samples"),
        "--min-approval-gate-samples"
      );
    } else if (arg === "--min-approval-slice-samples") {
      args.minApprovalSliceSamples = parsePositiveInteger(
        readFlagValue(argv[++i], "--min-approval-slice-samples"),
        "--min-approval-slice-samples"
      );
    } else if (arg.startsWith("--min-approval-slice-samples=")) {
      args.minApprovalSliceSamples = parsePositiveInteger(
        readFlagValue(arg.split("=")[1], "--min-approval-slice-samples"),
        "--min-approval-slice-samples"
      );
    } else if (arg === "--human-approval-token") {
      args.humanApprovalToken = readFlagValue(
        argv[++i],
        "--human-approval-token"
      );
    } else if (arg.startsWith("--human-approval-token=")) {
      args.humanApprovalToken = readFlagValue(
        arg.split("=")[1],
        "--human-approval-token"
      );
    } else {
      throw new Error(`Unknown argument: ${arg}.`);
    }
  }

  return args;
}

function splitList(value: string): string[] {
  const values = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const duplicates = findDuplicateStrings(values);
  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate --beach-ids value(s): ${duplicates.join(", ")}.`
    );
  }
  return values;
}

function readFlagValue(value: string | undefined, flagName: string): string {
  if (!value || value.startsWith("--")) {
    throw new Error(`${flagName} requires a value.`);
  }
  return value;
}

function findDuplicateStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (!value) {
      continue;
    }
    if (seen.has(value)) {
      duplicates.add(value);
    } else {
      seen.add(value);
    }
  }
  return Array.from(duplicates).sort((a, b) =>
    a.localeCompare(b)
  );
}

function parsePositiveInteger(value: string, flagName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flagName} must be a positive integer.`);
  }
  return parsed;
}

function parseNonNegativeInteger(value: string, flagName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flagName} must be a non-negative integer.`);
  }
  return parsed;
}
