import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import {
  buildOpenverseSearchUrl,
  buildTargetQuery,
  candidateFromOpenverseResult,
  formatCandidateReport,
  parseBeachPhotoTargets,
  type BeachPhotoTarget,
  type OpenverseImageResult,
  type PhotoCandidate,
} from "./lib/beach-photo-candidates";

interface OpenverseResponse {
  results?: OpenverseImageResult[];
  detail?: string;
}

interface CliOptions {
  targetsPath: string;
  markdownOutPath: string;
  jsonOutPath: string;
  limit: number;
  perTarget: number;
  minScore: number;
  source: string | null;
  dryRun: boolean;
  onlySlugs: Set<string> | null;
}

const DEFAULT_TARGETS_PATH = "scripts/data/socal-beginner-photo-targets.json";
const DEFAULT_MARKDOWN_OUT_PATH =
  "docs/seo/photo-candidates/socal-beginner-photo-candidates.md";
const DEFAULT_JSON_OUT_PATH =
  "docs/seo/photo-candidates/socal-beginner-photo-candidates.json";
const OPENVERSE_API_URL =
  process.env.OPENVERSE_API_URL ?? "https://api.openverse.org/v1/images/";

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;

    const [key, inlineValue] = arg.slice(2).split("=");
    const nextValue = argv[index + 1];
    if (inlineValue !== undefined) {
      args.set(key, inlineValue);
    } else if (nextValue && !nextValue.startsWith("--")) {
      args.set(key, nextValue);
      index += 1;
    } else {
      args.set(key, "true");
    }
  }

  const only = args.get("only");

  return {
    targetsPath: args.get("targets") ?? DEFAULT_TARGETS_PATH,
    markdownOutPath: args.get("out") ?? DEFAULT_MARKDOWN_OUT_PATH,
    jsonOutPath: args.get("jsonOut") ?? DEFAULT_JSON_OUT_PATH,
    limit: Number(args.get("limit") ?? "6"),
    perTarget: Number(args.get("perTarget") ?? "3"),
    minScore: Number(args.get("minScore") ?? "4"),
    source: args.get("source") === "all" ? null : args.get("source") ?? "wikimedia",
    dryRun: args.get("dryRun") === "true",
    onlySlugs: only
      ? new Set(
          only
            .split(",")
            .map((slug) => slug.trim())
            .filter(Boolean),
        )
      : null,
  };
}

async function readTargets(path: string): Promise<BeachPhotoTarget[]> {
  const raw = await readFile(path, "utf8");
  return parseBeachPhotoTargets(JSON.parse(raw));
}

async function writeTextFile(path: string, body: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body, "utf8");
}

async function fetchOpenverseCandidates(
  target: BeachPhotoTarget,
  options: Pick<CliOptions, "limit" | "perTarget" | "minScore" | "source">,
): Promise<PhotoCandidate[]> {
  const url = buildOpenverseSearchUrl(target, {
    apiUrl: OPENVERSE_API_URL,
    limit: options.limit,
    source: options.source,
  });
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Quiver-SEO-BeachPhotoCandidates/1.0",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Openverse failed for ${target.slug}: ${response.status} ${body}`,
    );
  }

  const payload = (await response.json()) as OpenverseResponse;
  if (payload.detail) {
    throw new Error(`Openverse failed for ${target.slug}: ${payload.detail}`);
  }

  return (payload.results ?? [])
    .map((result) => candidateFromOpenverseResult(target, result))
    .filter((candidate): candidate is PhotoCandidate => candidate !== null)
    .filter((candidate) => candidate.score >= options.minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, options.perTarget);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const targetsPath = resolve(options.targetsPath);
  const markdownOutPath = resolve(options.markdownOutPath);
  const jsonOutPath = resolve(options.jsonOutPath);
  const targets = (await readTargets(targetsPath)).filter((target) =>
    options.onlySlugs ? options.onlySlugs.has(target.slug) : true,
  );

  if (targets.length === 0) {
    throw new Error("No beach photo targets matched the requested filters.");
  }

  if (options.dryRun) {
    for (const target of targets) {
      console.log(
        `${target.slug}: ${buildTargetQuery(target)} (source=${options.source ?? "all"}, minScore=${options.minScore})`,
      );
    }
    return;
  }

  const candidates: PhotoCandidate[] = [];

  for (const target of targets) {
    console.log(`Searching ${target.slug}: ${buildTargetQuery(target)}`);
    const targetCandidates = await fetchOpenverseCandidates(target, options);
    candidates.push(...targetCandidates);
    console.log(`  ${targetCandidates.length} usable candidates`);
  }

  const generatedAt = new Date().toISOString();
  const report = formatCandidateReport({
    generatedAt,
    sourceLabel: `Openverse API commercial-use Creative Commons image search (${options.source ?? "all sources"}, min score ${options.minScore})`,
    targetPath: relative(process.cwd(), targetsPath),
    targets,
    candidates,
  });
  const jsonBody = JSON.stringify(
    {
      generatedAt,
      source: "openverse",
      sourceFilter: options.source,
      minScore: options.minScore,
      targetPath: relative(process.cwd(), targetsPath),
      candidates,
    },
    null,
    2,
  );

  await writeTextFile(markdownOutPath, report);
  await writeTextFile(jsonOutPath, `${jsonBody}\n`);

  console.log(`Wrote ${relative(process.cwd(), markdownOutPath)}`);
  console.log(`Wrote ${relative(process.cwd(), jsonOutPath)}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
