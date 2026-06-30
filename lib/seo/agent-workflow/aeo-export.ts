import fs from "node:fs";
import path from "node:path";

import type {
  AeoCitationDomainSnapshot,
  AeoCitationEngineSnapshot,
  AeoCitationInput,
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
