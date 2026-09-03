/**
 * Gate an AEO citation report before it is published.
 *
 * Three runs in seventeen days (2026-08-17, 2026-08-24, 2026-08-31) published a
 * rate that could not be reproduced, each one by enumerating pages that exist
 * instead of results that appeared, and each one skipping the query lists that
 * would have made the error visible. Reviewing after the fact caught all three
 * late. This runs before the write.
 *
 * Usage:
 *   npm run seo:validate-aeo                       # newest report
 *   npm run seo:validate-aeo -- 2026-09-02.md      # a specific report
 */
import fs from "node:fs";
import path from "node:path";

import {
  detectAeoCitationRunAnomalies,
  discoverLatestAeoCitationReport,
  isVoidAeoCitationReport,
  validateAeoCitationReport,
  type AeoQuerySet,
} from "../../lib/seo/agent-workflow/aeo-export";

const REPORT_DIR = path.join(process.cwd(), "docs/seo/reports/aeo-citation-tracking");
const QUERY_SET = path.join(process.cwd(), "docs/seo/aeo-query-set.json");
const CAPTURE_POINTS_REQUIRED_FROM = "2026-09-02";

function previousValidReport(target: string): string | null {
  const files = fs.readdirSync(REPORT_DIR)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
    .filter((name) => name < path.basename(target))
    .sort();

  for (let index = files.length - 1; index >= 0; index -= 1) {
    const markdown = fs.readFileSync(path.join(REPORT_DIR, files[index]), "utf8");
    if (!isVoidAeoCitationReport(markdown)) return markdown;
  }
  return null;
}

function main(): void {
  const argument = process.argv[2];
  const target = argument
    ? path.join(REPORT_DIR, path.basename(argument))
    : discoverLatestAeoCitationReport(REPORT_DIR);

  if (!target || !fs.existsSync(target)) {
    console.error("No AEO citation report found to validate.");
    process.exit(1);
  }

  const querySet = JSON.parse(fs.readFileSync(QUERY_SET, "utf8")) as AeoQuerySet;
  const markdown = fs.readFileSync(target, "utf8");
  const name = path.basename(target);

  const segments = Object.entries(querySet.segments)
    .map(([key, queries]) => `${key} ${queries.length}`)
    .join(", ");
  console.log(`Validating ${name}\n  query set: ${segments}\n`);

  const validation = validateAeoCitationReport(markdown, querySet, {
    requireCapturePoints: name >= CAPTURE_POINTS_REQUIRED_FROM,
  });
  const anomalies = detectAeoCitationRunAnomalies(markdown, previousValidReport(target), querySet);

  for (const problem of validation.problems) console.error(`  FAIL     ${problem}`);
  for (const anomaly of anomalies) console.error(`  ANOMALY  ${anomaly}`);

  if (!validation.ok) {
    console.error(`\n${name} is not publishable. A run that cannot name the queries it counted cannot report a rate.`);
    process.exit(1);
  }

  if (anomalies.length > 0) {
    console.error(`\n${name} passes the format check but looks unreproducible. Investigate before publishing.`);
    process.exit(2);
  }

  console.log(`  OK       ${name} satisfies the runbook.`);
}

main();
