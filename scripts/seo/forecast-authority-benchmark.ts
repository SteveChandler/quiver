import fs from "node:fs";
import path from "node:path";

import {
  buildForecastBenchmarkQueries,
  extractForecastAnswerContractFacts,
  type ForecastBenchmarkSpot,
} from "../../lib/seo/forecast-authority-benchmark";
import { loadSeoEnv } from "./load-env";

loadSeoEnv();

const inputPath = getFlag("--input") ?? path.join(
  process.cwd(),
  "reports",
  "seo",
  `FORECAST-AUTHORITY-AUDIT-${new Date().toISOString().slice(0, 10)}.json`,
);
const outputPath = getFlag("--output") ?? path.join(
  process.cwd(),
  "reports",
  "seo",
  `FORECAST-AUTHORITY-BENCHMARK-${new Date().toISOString().slice(0, 10)}.json`,
);
const baseUrl = (
  getFlag("--base-url") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

interface AuditInput {
  generatedAt: string;
  eligibleSpots: Array<Omit<ForecastBenchmarkSpot, "name"> & { name: string | null }>;
}

void main();

async function main(): Promise<void> {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Audit input not found: ${inputPath}`);
  }

  const audit = JSON.parse(fs.readFileSync(inputPath, "utf8")) as AuditInput;
  const benchmarkSpots: ForecastBenchmarkSpot[] = audit.eligibleSpots.flatMap((spot) =>
    spot.name ? [{ ...spot, name: spot.name }] : []
  );
  const queries = buildForecastBenchmarkQueries(benchmarkSpots);
  const uniquePaths = [...new Set(
    queries.flatMap((query) => query.canonicalPath ? [query.canonicalPath] : []),
  )];
  const pageResults = await Promise.all(uniquePaths.map(fetchPage));
  const pagesByPath = new Map(pageResults.map((result) => [result.path, result]));
  const queryResults = queries.map((query) => {
    const page = query.canonicalPath ? pagesByPath.get(query.canonicalPath) : undefined;
    return {
      ...query,
      status: page?.status ?? null,
      facts: page?.facts ?? null,
      error: page?.error ?? null,
    };
  });

  const answeredPages = pageResults.filter((page) => page.facts?.answerLayer).length;
  const averageContractScore = pageResults.length === 0
    ? 0
    : pageResults.reduce((sum, page) => sum + (page.facts?.score ?? 0), 0) / pageResults.length;
  const report = {
    generatedAt: new Date().toISOString(),
    auditGeneratedAt: audit.generatedAt,
    baseUrl,
    queryClasses: [...new Set(queries.map((query) => query.queryClass))],
    regions: [...new Set(queries.map((query) => query.region))],
    sampledSpots: [...new Set(queries.map((query) => query.spotId).filter(Boolean))].length,
    queryCount: queries.length,
    rawHtml: {
      pagesChecked: pageResults.length,
      answeredPages,
      averageContractScore,
      pages: pageResults,
    },
    queries: queryResults,
    competitiveBenchmark: {
      competitors: ["Surfline", "Surf Captain"],
      criteria: [
        "search discoverability",
        "canonical-page selection",
        "raw HTML completeness",
        "surf facts available",
        "freshness transparency",
        "forecast reasoning",
        "provenance",
        "citation suitability",
      ],
      status: "manual-evidence-required",
      note: "Provide a dated SERP capture or page fixture before recording competitor claims.",
    },
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    outputPath,
    queryCount: report.queryCount,
    pagesChecked: report.rawHtml.pagesChecked,
    answeredPages: report.rawHtml.answeredPages,
    averageContractScore: report.rawHtml.averageContractScore,
    competitiveBenchmark: report.competitiveBenchmark.status,
  }, null, 2));
}

async function fetchPage(pagePath: string): Promise<{
  path: string;
  status: number | null;
  facts: ReturnType<typeof extractForecastAnswerContractFacts> | null;
  error: string | null;
}> {
  try {
    const response = await fetch(`${baseUrl}${pagePath}`);
    const html = await response.text();
    return {
      path: pagePath,
      status: response.status,
      facts: extractForecastAnswerContractFacts(html),
      error: null,
    };
  } catch (error) {
    return {
      path: pagePath,
      status: null,
      facts: null,
      error: error instanceof Error ? error.message : "Unknown fetch error",
    };
  }
}

function getFlag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}
