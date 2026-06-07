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
  const pages = groupedTotals(responses.pages).map(([path, visits]) => ({ path, visits }));
  const referrers = groupedTotals(responses.referrers).map(([referrer, visits]) => ({
    referrer: referrer || "(direct)",
    visits,
  }));
  const countries = groupedTotals(responses.countries).map(([country, visits]) => ({ country, visits }));
  const devices = groupedTotals(responses.devices).map(([device, visits]) => ({ device, visits }));

  return {
    generatedAt,
    dateRange,
    rawPageViews,
    adjustedPageViews: Math.max(rawPageViews - botPageViews, 0),
    botPageViews,
    uniqueVisitors: optionalNumber(overview.devices),
    bounceRate: optionalNumber(overview.bounceRate),
    pages,
    referrers,
    countries,
    devices,
    lowConfidenceSegments: lowConfidenceSegments(referrers, countries, devices),
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

function lowConfidenceSegments(
  referrers: VercelExportInput["referrers"],
  countries: VercelExportInput["countries"],
  devices: VercelExportInput["devices"],
): VercelExportInput["lowConfidenceSegments"] {
  const segments: NonNullable<VercelExportInput["lowConfidenceSegments"]> = [];

  for (const referrer of referrers) {
    if (referrer.referrer === "(direct)" && referrer.visits > 0) {
      segments.push({
        segment: "referrer:(direct)",
        visits: referrer.visits,
        reason: "Direct/none referrers are raw acquisition context until tied to signup or activation.",
      });
    }
  }

  for (const country of countries) {
    const normalized = country.country.toLowerCase();
    if ((normalized === "sg" || normalized === "singapore") && country.visits > 0) {
      segments.push({
        segment: `country:${country.country}`,
        visits: country.visits,
        reason: "Singapore traffic is treated as acquisition context until linked to signup or activation.",
      });
    }
  }

  for (const device of devices) {
    if (device.device.toLowerCase() === "desktop" && device.visits > 0) {
      segments.push({
        segment: "device:desktop",
        visits: device.visits,
        reason: "Desktop-heavy traffic is raw demand context until qualified by signup and activation events.",
      });
    }
  }

  return segments;
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
