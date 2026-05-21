import { normalizeSeoPath } from "./dashboard";
import type {
  GscCountryRow,
  GscDeviceRow,
  GscExportInput,
  GscPageRow,
  GscQueryRow,
} from "./types";

export function parseGscExport(raw: unknown): GscExportInput {
  if (!isRecord(raw)) throw new Error("GSC export must be an object");

  const dateRanges = isRecord(raw.dateRanges) ? raw.dateRanges : {};

  return {
    generatedAt: stringValue(raw.generatedAt, "generatedAt"),
    siteUrl: stringValue(raw.siteUrl, "siteUrl"),
    dateRanges: {
      last7d: parseRange(dateRanges.last7d, "dateRanges.last7d"),
      prior7d: parseRange(dateRanges.prior7d, "dateRanges.prior7d"),
      last28d: parseRange(dateRanges.last28d, "dateRanges.last28d"),
    },
    last7d: arrayValue(raw.last7d, "last7d").map(parsePageRow),
    prior7d: arrayValue(raw.prior7d, "prior7d").map(parsePageRow),
    last28d: arrayValue(raw.last28d, "last28d").map(parsePageRow),
    sitemapPaths: arrayValue(raw.sitemapPaths, "sitemapPaths").map((value) =>
      normalizeSeoPath(stringFromUnknown(value, "sitemapPaths[]")),
    ),
    topQueries: arrayValue(raw.topQueries, "topQueries").map(parseQueryRow),
    topPages: arrayValue(raw.topPages, "topPages").map(parsePageRow),
    byDevice: arrayValue(raw.byDevice, "byDevice").map(parseDeviceRow),
    byCountry: arrayValue(raw.byCountry, "byCountry").map(parseCountryRow),
  };
}

export function toGscRefreshInput(exportInput: GscExportInput): Pick<
  GscExportInput,
  "last7d" | "prior7d" | "last28d" | "sitemapPaths"
> {
  return {
    last7d: exportInput.last7d,
    prior7d: exportInput.prior7d,
    last28d: exportInput.last28d,
    sitemapPaths: exportInput.sitemapPaths,
  };
}

function parseRange(raw: unknown, field: string): { start: string; end: string } {
  if (!isRecord(raw)) throw new Error(`${field} must be an object`);
  return {
    start: stringValue(raw.start, `${field}.start`),
    end: stringValue(raw.end, `${field}.end`),
  };
}

function parsePageRow(raw: unknown): GscPageRow {
  if (!isRecord(raw)) throw new Error("GSC page row must be an object");
  return {
    page: normalizeSeoPath(stringValue(raw.page, "page")),
    clicks: numberValue(raw.clicks, "clicks"),
    impressions: numberValue(raw.impressions, "impressions"),
    ctr: optionalNumber(raw.ctr, "ctr"),
    position: optionalNumber(raw.position, "position"),
  };
}

function parseQueryRow(raw: unknown): GscQueryRow {
  if (!isRecord(raw)) throw new Error("GSC query row must be an object");
  return {
    query: stringValue(raw.query, "query"),
    clicks: numberValue(raw.clicks, "clicks"),
    impressions: numberValue(raw.impressions, "impressions"),
    ctr: optionalNumber(raw.ctr, "ctr"),
    position: optionalNumber(raw.position, "position"),
  };
}

function parseDeviceRow(raw: unknown): GscDeviceRow {
  if (!isRecord(raw)) throw new Error("GSC device row must be an object");
  return {
    device: stringValue(raw.device, "device"),
    clicks: numberValue(raw.clicks, "clicks"),
    impressions: numberValue(raw.impressions, "impressions"),
    ctr: optionalNumber(raw.ctr, "ctr"),
    position: optionalNumber(raw.position, "position"),
  };
}

function parseCountryRow(raw: unknown): GscCountryRow {
  if (!isRecord(raw)) throw new Error("GSC country row must be an object");
  return {
    country: stringValue(raw.country, "country"),
    clicks: numberValue(raw.clicks, "clicks"),
    impressions: numberValue(raw.impressions, "impressions"),
    ctr: optionalNumber(raw.ctr, "ctr"),
    position: optionalNumber(raw.position, "position"),
  };
}

function arrayValue(raw: unknown, field: string): unknown[] {
  if (!Array.isArray(raw)) throw new Error(`${field} must be an array`);
  return raw;
}

function stringValue(raw: unknown, field: string): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return raw;
}

function stringFromUnknown(raw: unknown, field: string): string {
  if (typeof raw !== "string") throw new Error(`${field} must be a string`);
  return raw;
}

function numberValue(raw: unknown, field: string): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    throw new Error(`${field} must be a finite number`);
  }
  return raw;
}

function optionalNumber(raw: unknown, field: string): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  return numberValue(raw, field);
}

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}
