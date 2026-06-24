import type { VercelExportInput, VercelReferrerMetric, VercelSeoPageMetric } from "./types";

export const DEFAULT_BOT_PATHS = [
  "/",
  "/map",
  "/features",
  "/ca/san-diego/blacks",
  "/ca/encinitas/swamis",
] as const;

export interface VercelRawResponses {
  overview: unknown;
  pages: unknown;
  referrers: unknown;
  countries: unknown;
  devices: unknown;
  botOverviews?: unknown[];
}

export function buildVercelExport(
  responses: VercelRawResponses,
  generatedAt: string,
  dateRange: { from: string; to: string },
): VercelExportInput {
  const overview = readObjectData(responses.overview);
  const rawPageViews = numberOrZero(overview.total);
  const botPageViews = (responses.botOverviews ?? [])
    .map((item) => numberOrZero(readObjectData(item).total))
    .reduce((sum, value) => sum + value, 0);

  return {
    generatedAt,
    dateRange,
    rawPageViews,
    adjustedPageViews: Math.max(rawPageViews - botPageViews, 0),
    botPageViews,
    uniqueVisitors: optionalNumber(overview.devices),
    bounceRate: optionalNumber(overview.bounceRate),
    pages: groupedTotals(responses.pages).map(([path, visits]) => ({ path, visits })),
    referrers: groupedTotals(responses.referrers).map(([referrer, visits]) => ({
      referrer: referrer || "(direct)",
      visits,
    })),
    countries: groupedTotals(responses.countries).map(([country, visits]) => ({ country, visits })),
    devices: groupedTotals(responses.devices).map(([device, visits]) => ({ device, visits })),
  };
}

export function toVercelSeoPages(exportInput: VercelExportInput): VercelSeoPageMetric[] {
  return exportInput.pages;
}

export function toVercelReferrers(exportInput: VercelExportInput): VercelReferrerMetric[] {
  return exportInput.referrers;
}

function groupedTotals(raw: unknown): Array<[string, number]> {
  const data = readObjectData(raw);
  if (Array.isArray(data.data)) {
    return data.data
      .map((row) => [
        isRecord(row) && typeof row.key === "string" ? row.key : "",
        numberOrZero(isRecord(row) ? row.total : undefined),
      ] as [string, number])
      .sort((a, b) => b[1] - a[1]);
  }

  const groups = data.groups;
  if (!isRecord(groups)) return [];

  return Object.entries(groups)
    .map(([key, rows]) => [
      key,
      Array.isArray(rows)
        ? rows.reduce((sum, row) => sum + numberOrZero(isRecord(row) ? row.total : undefined), 0)
        : 0,
    ] as [string, number])
    .sort((a, b) => b[1] - a[1]);
}

function readObjectData(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {};
  if (isRecord(raw.data)) return raw.data;
  return raw;
}

function optionalNumber(raw: unknown): number | undefined {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}

function numberOrZero(raw: unknown): number {
  return optionalNumber(raw) ?? 0;
}

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}
