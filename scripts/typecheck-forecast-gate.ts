#!/usr/bin/env tsx
import { existsSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

export const FORECAST_GATE_TYPECHECK_TARGETS = [
  "scripts/typecheck-forecast-gate.ts",
  "scripts/phase0-app-deploy-gate.ts",
  "scripts/phase0-migration-preapply-check.ts",
  "scripts/forecast-accuracy-approval-subset.ts",
  "scripts/forecast-accuracy-harness.ts",
  "scripts/forecast-accuracy-readiness-report.ts",
  "scripts/forecast-accuracy-report-validate.ts",
  "scripts/diag-snapshot-writer.ts",
  "scripts/ml-stats.ts",
  "scripts/phase1-shoaling-proposed-export.ts",
  "scripts/analog-shoaling-proposed-export.ts",
  "scripts/session-acquisition-funnel-report.ts",
  "scripts/session-face-height-truth-report.ts",
  "scripts/trusted-forecast-canary-report.ts",
  "scripts/terrain-filter-proposed-export.ts",
  "scripts/terrain-analysis.ts",
  "scripts/validate-match-score-heuristic.ts",
  "scripts/terrain/cli.ts",
  "scripts/terrain/database.ts",
  "scripts/terrain/proposed-export.ts",
  "scripts/terrain/types.ts",
  "scripts/terrain/write-guard.ts",
  "scripts/__tests__/analog-shoaling-proposed-export.test.ts",
  "scripts/__tests__/forecast-accuracy-approval-subset.test.ts",
  "scripts/__tests__/forecast-accuracy-harness.test.ts",
  "scripts/__tests__/forecast-accuracy-readiness-report.test.ts",
  "scripts/__tests__/forecast-accuracy-report-validate.test.ts",
  "scripts/__tests__/phase0-app-deploy-gate.test.ts",
  "scripts/__tests__/phase0-migration-preapply-check.test.ts",
  "scripts/__tests__/typecheck-forecast-gate.test.ts",
  "scripts/__tests__/phase1-shoaling-proposed-export.test.ts",
  "scripts/__tests__/session-acquisition-funnel-report.test.ts",
  "scripts/__tests__/session-face-height-truth-report.test.ts",
  "scripts/__tests__/trusted-forecast-canary-report.test.ts",
  "scripts/__tests__/terrain-filter-proposed-export.test.ts",
  "scripts/__tests__/validate-match-score-heuristic.test.ts",
  "scripts/terrain/__tests__/database.test.ts",
  "scripts/terrain/__tests__/proposed-export.test.ts",
  "scripts/terrain/__tests__/write-guard.test.ts",
  "__tests__/migrations/phase0-forecast-accuracy-metrics.test.ts",
  "__tests__/migrations/phase1-shoaling-apply-gap.test.ts",
  "__tests__/migrations/track-b-session-acquisition-event.test.ts",
  "__tests__/scripts/phase2-terrain-gap-sql.test.ts",
  "__tests__/scripts/session-truth-relinkability-sql.test.ts",
] as const;

const TSCONFIG_PATH = path.resolve("tsconfig.json");

export function getMissingForecastGateTypecheckTargets(
  targets: readonly string[] = FORECAST_GATE_TYPECHECK_TARGETS
): string[] {
  return targets.filter((target) => !existsSync(path.resolve(target)));
}

function main(): void {
  const missingTargets = getMissingForecastGateTypecheckTargets();
  if (missingTargets.length > 0) {
    console.error(
      [
        "Forecast gate script typecheck target(s) are missing:",
        ...missingTargets.map((target) => `- ${target}`),
      ].join("\n")
    );
    process.exit(2);
  }

  const readResult = ts.readConfigFile(TSCONFIG_PATH, ts.sys.readFile);
  if (readResult.error) {
    printDiagnostics([readResult.error]);
    process.exit(2);
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    {
      ...readResult.config,
      include: [...FORECAST_GATE_TYPECHECK_TARGETS],
      exclude: ["node_modules"],
    },
    ts.sys,
    path.dirname(TSCONFIG_PATH)
  );

  const program = ts.createProgram(parsedConfig.fileNames, {
    ...parsedConfig.options,
    incremental: false,
    noEmit: true,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);

  if (diagnostics.length > 0) {
    printDiagnostics(diagnostics);
    process.exit(2);
  }

  console.log(
    `Forecast gate script typecheck passed (${parsedConfig.fileNames.length} files).`
  );
}

function printDiagnostics(diagnostics: readonly ts.Diagnostic[]): void {
  console.error(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      getNewLine: () => ts.sys.newLine,
    })
  );
}

if (require.main === module) {
  main();
}
