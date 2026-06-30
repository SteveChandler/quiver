import fs from "node:fs";
import path from "node:path";

import type {
  CompetitorComparisonSignal,
  CompetitorIntelligenceInput,
  CompetitorTechnicalSurface,
} from "./types";

const COMPETITOR_AUTOMATION_ROOT = process.env.SEO_COMPETITOR_AUTOMATION_ROOT ??
  path.join(process.env.HOME ?? "", ".codex", "automations", "competitor-research-refresh");

export function buildCompetitorIntelligence(
  generatedAt: string,
  input: Partial<CompetitorIntelligenceInput>,
): CompetitorIntelligenceInput {
  return {
    generatedAt,
    runId: input.runId,
    technicalSurfaces: input.technicalSurfaces ?? [],
    comparisonSignals: input.comparisonSignals ?? [],
    materialDeltas: input.materialDeltas ?? [],
    missing: input.missing ?? [],
  };
}

export function readLatestCompetitorIntelligence(
  automationRoot: string = COMPETITOR_AUTOMATION_ROOT,
): CompetitorIntelligenceInput | null {
  const reportPath = findLatestCompetitorReportPath(automationRoot);
  if (!reportPath) return null;

  const markdown = fs.readFileSync(reportPath, "utf8");
  const runId = path.basename(path.dirname(reportPath));

  return buildCompetitorIntelligence(new Date().toISOString(), {
    runId,
    technicalSurfaces: parseTechnicalSurfaces(markdown),
    comparisonSignals: parseComparisonSignals(markdown),
    materialDeltas: extractSectionBullets(markdown, "## Material Changes Since Last Check"),
  });
}

export function parseTechnicalSurfaces(markdown: string): CompetitorTechnicalSurface[] {
  return extractCompetitorSections(markdown).map(({ competitor, bullets }) => {
    const combined = bullets.join(" ");

    return {
      competitor,
      robotsStatus: firstNumberMatch(combined, /robots(?:\.txt)? [` ]?(\d{3})/i),
      sitemapStatus: firstNumberMatch(combined, /sitemap(?:\.xml)? [` ]?(\d{3})/i),
      sitemapCount: parseCount(combined, /`?([\d,]+)`?\s+`?urls/i),
      schemaSupport: inferSchemaSupport(combined),
      notes: bullets,
    };
  });
}

export function parseComparisonSignals(markdown: string): CompetitorComparisonSignal[] {
  return extractCompetitorSections(markdown)
    .flatMap(({ competitor, bullets }) =>
      bullets
        .filter((bullet) => /compare\/quiver\.html|comparison page|head-to-head|attacks on/i.test(bullet))
        .map((bullet) => ({
          competitor,
          summary: bullet,
          url: extractUrl(bullet),
        })),
    );
}

function extractCompetitorSections(markdown: string): Array<{ competitor: string; bullets: string[] }> {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === "## Competitor-by-Competitor Findings");
  if (start === -1) return [];

  const sections: Array<{ competitor: string; bullets: string[] }> = [];
  let current: { competitor: string; bullets: string[] } | null = null;

  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    if (line.startsWith("## ")) break;

    if (line.startsWith("### ")) {
      if (current) sections.push(current);
      current = { competitor: line.replace(/^###\s+/, "").trim(), bullets: [] };
      continue;
    }

    if (!current || !line.startsWith("- ")) continue;
    current.bullets.push(line.replace(/^-+\s*/, "").trim());
  }

  if (current) sections.push(current);
  return sections;
}

function extractSectionBullets(markdown: string, heading: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) return [];

  const bullets: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    if (line.startsWith("## ")) break;
    if (!line.startsWith("- ")) continue;
    bullets.push(line.replace(/^-+\s*/, "").trim());
  }

  return bullets;
}

function firstNumberMatch(value: string, pattern: RegExp): number | undefined {
  const match = value.match(pattern);
  if (!match?.[1]) return undefined;
  return Number(match[1]);
}

function parseCount(value: string, pattern: RegExp): number | undefined {
  const match = value.match(pattern);
  if (!match?.[1]) return undefined;
  return Number(match[1].replace(/,/g, ""));
}

function inferSchemaSupport(value: string): CompetitorTechnicalSurface["schemaSupport"] {
  if (/no raw-html schema markers|no json-ld|no structured data markers/i.test(value)) {
    return "missing";
  }
  if (/schema markers|json-ld|structured data/i.test(value)) {
    return "present";
  }
  return "unknown";
}

function extractUrl(value: string): string | undefined {
  const match = value.match(/https?:\/\/\S+/);
  return match?.[0];
}

function findLatestCompetitorReportPath(automationRoot: string): string | null {
  const runsDir = path.join(automationRoot, "runs");
  if (!fs.existsSync(runsDir)) return null;

  const reportPaths = fs.readdirSync(runsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(runsDir, entry.name, "report.md"))
    .filter((reportPath) => fs.existsSync(reportPath))
    .sort();

  return reportPaths.at(-1) ?? null;
}
