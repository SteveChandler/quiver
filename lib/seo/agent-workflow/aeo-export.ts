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
