#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const KNOWN_POSTGIS_EXTENSION_FUNCTIONS = new Set([
  "public.addauth",
  "public.lockrow",
  "public.populate_geometry_columns",
  "public.postgis_full_version",
  "public.st_findextent",
]);

function runSupabase(args) {
  const result = spawnSync("supabase", args, {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

function extractJsonArray(output) {
  const start = output.indexOf("[");
  const end = output.lastIndexOf("]");

  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Could not find JSON array in supabase output:\n${output}`);
  }

  return JSON.parse(output.slice(start, end + 1));
}

function extractJsonObject(output) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Could not find JSON object in supabase output:\n${output}`);
  }

  return JSON.parse(output.slice(start, end + 1));
}

const lintResult = runSupabase([
  "db",
  "lint",
  "--local",
  "--level",
  "error",
  "--output",
  "json",
]);

if (lintResult.status !== 0) {
  process.stderr.write(lintResult.stderr);
  process.stdout.write(lintResult.stdout);
  process.exit(lintResult.status ?? 1);
}

const lintIssues = extractJsonArray(lintResult.stdout);
const ignoredPostgisIssues = lintIssues.filter((issue) =>
  KNOWN_POSTGIS_EXTENSION_FUNCTIONS.has(issue.function),
);
const appIssues = lintIssues.filter(
  (issue) => !KNOWN_POSTGIS_EXTENSION_FUNCTIONS.has(issue.function),
);

if (ignoredPostgisIssues.length > 0) {
  const inventoryResult = runSupabase([
    "db",
    "query",
    "--local",
    "-o",
    "json",
    `
      SELECT DISTINCT n.nspname || '.' || p.proname AS function_name
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
      JOIN pg_extension e ON e.oid = d.refobjid
      WHERE e.extname = 'postgis'
      ORDER BY function_name
    `,
  ]);

  if (inventoryResult.status !== 0) {
    process.stderr.write(inventoryResult.stderr);
    process.stdout.write(inventoryResult.stdout);
    process.exit(inventoryResult.status ?? 1);
  }

  const postgisFunctions = new Set(
    extractJsonObject(inventoryResult.stdout).rows.map(
      (row) => row.function_name,
    ),
  );
  const nonExtensionIgnoredIssues = ignoredPostgisIssues.filter(
    (issue) => !postgisFunctions.has(issue.function),
  );

  if (nonExtensionIgnoredIssues.length > 0) {
    console.error(
      "Refusing to ignore lint issues that are not PostGIS extension-owned:",
    );
    console.error(JSON.stringify(nonExtensionIgnoredIssues, null, 2));
    process.exit(1);
  }
}

if (appIssues.length > 0) {
  console.error("Supabase app-owned function lint failed:");
  console.error(JSON.stringify(appIssues, null, 2));
  process.exit(1);
}

if (ignoredPostgisIssues.length > 0) {
  const ignoredNames = [
    ...new Set(ignoredPostgisIssues.map((issue) => issue.function)),
  ].sort();
  console.log(
    `Supabase app-owned function lint passed. Ignored PostGIS extension-owned lint noise: ${ignoredNames.join(", ")}`,
  );
} else {
  console.log("Supabase app-owned function lint passed with no ignored issues.");
}
