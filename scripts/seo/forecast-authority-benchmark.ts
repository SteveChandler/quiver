import fs from "node:fs";
import path from "node:path";

import {
  buildForecastBenchmarkQueries,
  createUnmeasuredForecastRetrievalBenchmark,
  DEFAULT_QUIVER_BENCHMARK_ORIGIN,
  extractForecastAnswerContractFacts,
  parseForecastRetrievalEvidence,
  summarizeForecastCompetitiveBenchmark,
  summarizeForecastRetrievalEvidence,
  type ForecastBenchmarkSpot,
  type ForecastRetrievalBenchmark,
  type ForecastRetrievalEvidence,
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
const quiverOrigin = (
  getFlag("--quiver-origin") ?? DEFAULT_QUIVER_BENCHMARK_ORIGIN
).replace(/\/$/, "");

interface AuditInput {
  generatedAt: string;
  eligibleSpots: Array<Omit<ForecastBenchmarkSpot, "name"> & { name: string | null }>;
}

interface LoadedRetrievalBenchmark {
  benchmark: ForecastRetrievalBenchmark;
  evidence: ForecastRetrievalEvidence[];
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
  const retrieval = await loadRetrievalBenchmark(queries);
  if (retrieval.benchmark.status === "invalid") {
    throw new Error(retrieval.benchmark.reason ?? "Retrieval evidence is invalid.");
  }
  if (hasFlag("--require-retrieval") && retrieval.benchmark.status !== "measured") {
    throw new Error(
      retrieval.benchmark.reason ?? "A measured retrieval benchmark is required.",
    );
  }
  const uniquePaths = [...new Set(
    queries.flatMap((query) => query.canonicalPath ? [query.canonicalPath] : []),
  )];
  const pageResults = await Promise.all(uniquePaths.map(fetchPage));
  const pagesByPath = new Map(pageResults.map((result) => [result.path, result]));
  const retrievalByQueryId = new Map(
    retrieval.evidence.map((result) => [result.queryId, result]),
  );
  const queryResults = queries.map((query) => {
    const page = query.canonicalPath ? pagesByPath.get(query.canonicalPath) : undefined;
    return {
      ...query,
      rawHtml: {
        status: page?.status ?? null,
        facts: page?.facts ?? null,
        error: page?.error ?? null,
      },
      retrieval: retrievalByQueryId.get(query.queryId) ?? null,
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
    quiverOrigin,
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
    retrievalBenchmark: retrieval.benchmark,
    queries: queryResults,
    competitiveBenchmark: summarizeForecastCompetitiveBenchmark(
      queries,
      retrieval.evidence,
      retrieval.benchmark,
    ),
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    outputPath,
    queryCount: report.queryCount,
    pagesChecked: report.rawHtml.pagesChecked,
    answeredPages: report.rawHtml.answeredPages,
    averageContractScore: report.rawHtml.averageContractScore,
    retrievalStatus: report.retrievalBenchmark.status,
    retrievalProvider: report.retrievalBenchmark.provider,
    answerShare: report.retrievalBenchmark.answerShare,
    citationShare: report.retrievalBenchmark.citationShare,
    canonicalSelectionShare: report.retrievalBenchmark.canonicalSelectionShare,
    competitiveBenchmarkStatus: report.competitiveBenchmark.status,
  }, null, 2));
}

async function loadRetrievalBenchmark(
  queries: ReturnType<typeof buildForecastBenchmarkQueries>,
): Promise<LoadedRetrievalBenchmark> {
  const retrievalUrl = getFlag("--retrieval-url");
  const retrievalEvidencePath = getFlag("--retrieval-evidence");

  if (retrievalUrl && retrievalEvidencePath) {
    throw new Error("Use only one of --retrieval-url or --retrieval-evidence.");
  }

  if (!retrievalUrl && !retrievalEvidencePath) {
    return {
      benchmark: createUnmeasuredForecastRetrievalBenchmark(
        queries,
        "No retrieval provider or evidence supplied. Raw HTML is not Answer Share evidence.",
      ),
      evidence: [],
    };
  }

  const payload = retrievalUrl
    ? await fetchRetrievalProvider(retrievalUrl, queries)
    : JSON.parse(fs.readFileSync(retrievalEvidencePath!, "utf8")) as unknown;
  const parsed = parseRetrievalPayload(
    payload,
    retrievalUrl ? "retrieval-provider" : "evidence-file",
  );

  return {
    benchmark: summarizeForecastRetrievalEvidence(
      queries,
      parsed.results,
      parsed.provider,
      quiverOrigin,
    ),
    evidence: parsed.results,
  };
}

async function fetchRetrievalProvider(
  retrievalUrl: string,
  queries: ReturnType<typeof buildForecastBenchmarkQueries>,
): Promise<unknown> {
  const response = await fetch(retrievalUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queries }),
  });

  if (!response.ok) {
    throw new Error(`Retrieval provider returned HTTP ${response.status}.`);
  }

  return response.json() as Promise<unknown>;
}

function parseRetrievalPayload(
  value: unknown,
  fallbackProvider: string,
): { provider: string; results: ForecastRetrievalEvidence[] } {
  if (Array.isArray(value)) {
    return {
      provider: fallbackProvider,
      results: parseForecastRetrievalEvidence(value),
    };
  }

  if (typeof value !== "object" || value === null) {
    throw new Error("Retrieval provider response must be an array or an object with results.");
  }

  const record = value as Record<string, unknown>;
  const provider = typeof record.provider === "string" && record.provider.trim().length > 0
    ? record.provider
    : fallbackProvider;

  return {
    provider,
    results: parseForecastRetrievalEvidence(record.results),
  };
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

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}
