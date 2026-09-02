import fs from "node:fs";
import path from "node:path";

import type {
  AeoCitationBaselineSegment,
  AeoCitationDomainSnapshot,
  AeoCitationEngineSnapshot,
  AeoCitationInput,
  AeoCitationNarrativeBaseline,
  VercelExportInput,
} from "./types";

const AI_REFERRER_PATTERNS = [
  /perplexity/i,
  /chatgpt/i,
  /openai/i,
  /copilot/i,
  /gemini/i,
  /grok/i,
];

export function buildAeoCitationExport(
  generatedAt: string,
  input: Partial<AeoCitationInput>,
): AeoCitationInput {
  return {
    generatedAt,
    aiReferrers: input.aiReferrers ?? [],
    engines: input.engines ?? [],
    citationDomains: input.citationDomains ?? [],
    llmsFiles: input.llmsFiles ?? [],
    narrativeBaseline: input.narrativeBaseline,
    missing: input.missing ?? [],
  };
}

export function extractAiReferrers(vercel?: VercelExportInput): AeoCitationInput["aiReferrers"] {
  return (vercel?.referrers ?? []).filter((row) =>
    AI_REFERRER_PATTERNS.some((pattern) => pattern.test(row.referrer)),
  );
}

export function extractAhrefsAeoSummary(raw: unknown): {
  engines: AeoCitationEngineSnapshot[];
  citationDomains: AeoCitationDomainSnapshot[];
} {
  const record = asRecord(raw);
  const summary = asRecord(record?.summary);
  const siteExplorer = asRecord(summary?.siteExplorer);
  const aiCitations = asRecord(siteExplorer?.aiCitations);
  const engines = aiCitations
    ? Object.entries(aiCitations).flatMap(([engine, value]) => {
      const row = asRecord(value);
      const citations = typeof row?.citations === "number" ? row.citations : undefined;
      const pages = typeof row?.pages === "number" ? row.pages : undefined;
      if (typeof citations !== "number" || typeof pages !== "number") return [];
      return [{
        engine,
        citations,
        pages,
      }];
    })
    : [];

  const rows = Array.isArray(record?.rows) ? record.rows.filter(asRecord) : [];
  const citationDomains = rows
    .map((row) => {
      const domain = stringValue(row["referring domain"]);
      if (!domain) return null;
      const spam = row.spam === true;
      const dofollowLinks = numberValue(row["dofollow links"]) ?? 0;
      if (spam || dofollowLinks <= 0) return null;
      return {
        domain,
        links: numberValue(row["links to target"]) ?? dofollowLinks,
        domainRating: numberValue(row["domain rating"]) ?? undefined,
      };
    })
    .filter(isDefined)
    .sort((a, b) => b.links - a.links || (b.domainRating ?? 0) - (a.domainRating ?? 0))
    .slice(0, 8);

  return { engines, citationDomains };
}

export function inspectLlmsFiles(paths: string[]): AeoCitationInput["llmsFiles"] {
  return paths.map((filePath) => {
    if (!fs.existsSync(filePath)) {
      return { path: filePath, exists: false, lines: 0, bytes: 0 };
    }

    const raw = fs.readFileSync(filePath, "utf8");
    return {
      path: filePath,
      exists: true,
      lines: raw.split(/\r?\n/).filter((line) => line.trim().length > 0).length,
      bytes: Buffer.byteLength(raw),
    };
  });
}

/**
 * A run whose method could not be reproduced is marked void rather than deleted,
 * so the evidence survives. Voiding is opt-in text in the report itself: a `(VOID)`
 * heading or a `Status: void` line, per `docs/seo/AEO_CITATION_AUDIT.md`.
 */
export function isVoidAeoCitationReport(markdown: string): boolean {
  if (/^#.*\(VOID\)/im.test(markdown)) return true;
  const status = markdown.match(/^Status:\s*(.+)$/im)?.[1]?.trim();
  return status ? /^voids?$/i.test(status) : false;
}

/**
 * Newest non-void report. A void run must not become the weekly report's
 * baseline: folding an unreproducible rate into the AEO section is worse than
 * reporting the older number, because it publishes a method change as a trend.
 */
export function discoverLatestAeoCitationReport(dir: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
    .sort();

  for (let index = files.length - 1; index >= 0; index -= 1) {
    const candidate = path.join(dir, files[index]);
    if (!isVoidAeoCitationReport(fs.readFileSync(candidate, "utf8"))) return candidate;
  }

  return null;
}

export function parseAeoCitationReport(
  markdown: string,
  reportPath = "",
): AeoCitationNarrativeBaseline {
  const dateFromHeading = markdown
    .match(/#\s*AEO Citation Tracking\s*-\s*(\d{4}-\d{2}-\d{2})/i)?.[1];
  const dateFromPath = path.basename(reportPath).match(/(\d{4}-\d{2}-\d{2})/)?.[1];
  const reportDate = dateFromHeading ?? dateFromPath ?? "";
  const status = markdown.match(/^Status:\s*(.+)$/im)?.[1]?.trim();

  const segments: AeoCitationBaselineSegment[] = [];
  let overall: AeoCitationBaselineSegment | undefined;

  for (const line of markdown.split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length < 4) continue;
    const segment = cells[0] ?? "";
    if (!segment || /^segment$/i.test(segment) || /^:?-{2,}:?$/.test(segment)) {
      continue;
    }

    const cited = parseIntCell(cells[1]);
    const total = parseIntCell(cells[2]);
    if (cited === null || total === null || total <= 0) continue;
    const rate = parseRateCell(cells[3]) ?? cited / total;
    const row: AeoCitationBaselineSegment = {
      segment,
      cited,
      total,
      rate,
    };
    if (/^all( queries)?$/i.test(segment)) overall = row;
    else segments.push(row);
  }

  return { reportDate, reportPath, status, overall, segments };
}

export interface AeoQuerySet {
  brandDomains: string[];
  segments: Record<string, string[]>;
}

export interface AeoReportValidation {
  ok: boolean;
  problems: string[];
}

/**
 * Queries from the canonical set that appear under a given `## heading`.
 *
 * Two things make naive substring matching wrong here. Reports hard-wrap, so a
 * query is routinely split across a newline; and one canonical query is a
 * substring of another (`surfline alternative` inside `free surfline
 * alternative`), so a short query would match inside a longer one and land in
 * both lists. Whitespace is normalized first, then matches are taken
 * longest-first and consumed so a span can only be claimed once.
 *
 * `structuredOnly` restricts matching to table rows and list items. The
 * surfaced list uses it: that section carries explanatory prose which may name
 * other queries, and the surfaced list is precisely where an inflated run
 * shows up, so it has to be a structured list rather than a paragraph.
 */
export function extractAeoSectionQueries(
  markdown: string,
  heading: string,
  queries: string[],
  options: { structuredOnly?: boolean } = {},
): string[] {
  const pattern = new RegExp(`^##\\s*${escapeRegExp(heading)}\\s*$`, "im");
  const start = markdown.match(pattern);
  if (start?.index === undefined) return [];

  const body = markdown.slice(start.index + start[0].length);
  const end = body.search(/^##\s/m);
  const raw = end === -1 ? body : body.slice(0, end);

  const lines = raw.split(/\r?\n/);
  const source = options.structuredOnly
    ? lines.filter((line) => /^\s*(\||[-*+]\s)/.test(line)).join("\n")
    : raw;

  let haystack = normalizeQueryText(source);
  const found: string[] = [];

  for (const query of [...queries].sort((a, b) => b.length - a.length)) {
    const needle = normalizeQueryText(query);
    if (!needle || !haystack.includes(needle)) continue;
    found.push(query);
    haystack = haystack.split(needle).join(" \u0000 ");
  }

  return queries.filter((query) => found.includes(query));
}

function normalizeQueryText(value: string): string {
  return value.toLowerCase().replace(/[`*_]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Gate a run before it is published, not after it is reviewed.
 *
 * Three runs in seventeen days (2026-08-17, 2026-08-24, 2026-08-31) published a
 * rate produced by enumerating pages that exist instead of results that
 * appeared, and every one of them skipped the query lists that would have made
 * the error visible. The decisive rule is the last one: the counts in the
 * baseline table must equal the queries actually listed. A run that cannot name
 * the queries it counted cannot report a rate.
 */
export function validateAeoCitationReport(
  markdown: string,
  querySet: AeoQuerySet,
  options: { requireCapturePoints?: boolean } = {},
): AeoReportValidation {
  const problems: string[] = [];

  if (!/^#\s*AEO Citation Tracking\s*[—-]\s*\d{4}-\d{2}-\d{2}/im.test(markdown)) {
    problems.push("Missing or malformed H1 (expected `# AEO Citation Tracking — YYYY-MM-DD`).");
  }

  const required = ["Movement", "Queries that surfaced", "Queries that did not surface", "Action list"];
  // Required from 2026-09-02. A run that only reports the rate concludes [NO ACTION] forever.
  if (options.requireCapturePoints) required.push("Capture points");

  for (const heading of required) {
    if (!new RegExp(`^##\\s*${escapeRegExp(heading)}\\s*$`, "im").test(markdown)) {
      problems.push(`Missing required section \`## ${heading}\`.`);
    }
  }

  if (!/^##\s*Action list\s*$[\s\S]*?^-\s*\[(APPLY FIX|WRITE CONTENT|NO ACTION)\]/im.test(markdown)) {
    problems.push("Action list has no `[APPLY FIX]`, `[WRITE CONTENT]`, or `[NO ACTION]` entry.");
  }

  const allQueries = Object.values(querySet.segments).flat();
  const surfaced = extractAeoSectionQueries(markdown, "Queries that surfaced", allQueries, { structuredOnly: true });
  const notSurfaced = extractAeoSectionQueries(markdown, "Queries that did not surface", allQueries);

  const overlap = surfaced.filter((query) => notSurfaced.includes(query));
  if (overlap.length > 0) {
    problems.push(`Queries listed as both surfaced and not surfaced: ${overlap.join("; ")}.`);
  }

  const accounted = new Set([...surfaced, ...notSurfaced]);
  const unaccounted = allQueries.filter((query) => !accounted.has(query));
  if (unaccounted.length > 0) {
    problems.push(
      `${unaccounted.length} of ${allQueries.length} queries appear in neither list: ${unaccounted.join("; ")}.`,
    );
  }

  const baseline = parseAeoCitationReport(markdown);
  const rows = [
    ...(baseline.overall ? [baseline.overall] : []),
    ...baseline.segments,
  ];
  if (rows.length === 0) problems.push("Missing the citation baseline table.");

  for (const row of rows) {
    const segmentQueries = matchSegmentQueries(row.segment, querySet, allQueries);
    if (!segmentQueries) continue;

    if (row.total !== segmentQueries.length) {
      problems.push(
        `Baseline row "${row.segment}" reports a denominator of ${row.total}; the query set has ${segmentQueries.length}.`,
      );
    }

    const counted = surfaced.filter((query) => segmentQueries.includes(query)).length;
    if (row.cited !== counted) {
      problems.push(
        `Baseline row "${row.segment}" claims ${row.cited} cited but the surfaced list names ${counted}. `
        + "The rate and the list must agree; a count with no queries behind it is not auditable.",
      );
    }
  }

  return { ok: problems.length === 0, problems };
}

/**
 * Cheaper than the 20-point swing rule and fires where that rule does not.
 *
 * 2026-08-31 moved +16.6 points, stayed under the swing threshold, and was still
 * unreproducible — its surfaced set shared nothing with the run before it. A run
 * that surfaces none of the queries the previous valid run surfaced has almost
 * certainly changed method rather than found a result.
 */
export function detectAeoCitationRunAnomalies(
  markdown: string,
  previousMarkdown: string | null,
  querySet: AeoQuerySet,
): string[] {
  if (!previousMarkdown) return [];

  const anomalies: string[] = [];
  const allQueries = Object.values(querySet.segments).flat();
  const surfaced = extractAeoSectionQueries(markdown, "Queries that surfaced", allQueries, { structuredOnly: true });
  const previousSurfaced = extractAeoSectionQueries(previousMarkdown, "Queries that surfaced", allQueries, { structuredOnly: true });

  if (surfaced.length > 0 && previousSurfaced.length > 0) {
    const shared = surfaced.filter((query) => previousSurfaced.includes(query));
    if (shared.length === 0) {
      anomalies.push(
        "Surfaced list shares no query with the previous valid run. Investigate the method "
        + "before publishing: this is the signature of counting pages that exist rather than results that appeared.",
      );
    }
  }

  const current = parseAeoCitationReport(markdown).overall;
  const previous = parseAeoCitationReport(previousMarkdown).overall;
  const declaresMethodChange = /^##\s*Method change\s*$/im.test(markdown);

  if (current && previous && !declaresMethodChange) {
    const points = Math.abs(current.rate - previous.rate) * 100;
    if (points > 20) {
      anomalies.push(
        `All-query rate moved ${points.toFixed(1)} points with no \`## Method change\` section. `
        + "Per the runbook this is a defect in the run, not a finding.",
      );
    }
  }

  return anomalies;
}

function matchSegmentQueries(
  segment: string,
  querySet: AeoQuerySet,
  allQueries: string[],
): string[] | null {
  if (/^all( queries)?$/i.test(segment)) return allQueries;
  const normalized = segment.toLowerCase().replace(/\s*queries\s*$/, "").replace(/[^a-z]/g, "");
  for (const [key, queries] of Object.entries(querySet.segments)) {
    if (key.toLowerCase().replace(/[^a-z]/g, "") === normalized) return queries;
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function discoverLatestAhrefsSnapshot(auditDir: string): string | null {
  const explicit = path.join(auditDir, "AHREFS-SCREENSHOT-INPUT.json");
  if (fs.existsSync(explicit)) return explicit;

  const auditRoot = path.dirname(auditDir);
  const candidates = fs.existsSync(auditRoot)
    ? fs.readdirSync(auditRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(auditRoot, entry.name, "AHREFS-SCREENSHOT-INPUT.json"))
      .filter((candidate) => fs.existsSync(candidate))
      .sort()
    : [];

  return candidates.at(-1) ?? null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isDefined<T>(value: T | null): value is T {
  return value !== null;
}

function parseIntCell(value: string | undefined): number | null {
  if (typeof value !== "string") return null;
  const match = value.replace(/,/g, "").match(/-?\d+/);
  return match ? Number(match[0]) : null;
}

function parseRateCell(value: string | undefined): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/([\d.]+)\s*%/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed / 100 : null;
}
