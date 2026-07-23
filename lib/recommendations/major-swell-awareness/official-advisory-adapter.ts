import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import type { OfficialSwellAdvisoryEvidence } from "./shadow-evaluator";

const FRESHNESS_MS = 36 * 60 * 60 * 1000;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const HORIZON_DAYS = 10;
const NWS_CACHE_MS = 5 * 60 * 1000;
const NWS_TIMEOUT_MS = 6_000;

interface NwsAlertProperties {
  id?: unknown;
  event?: unknown;
  onset?: unknown;
  effective?: unknown;
  expires?: unknown;
  ends?: unknown;
}

interface NwsAlertFeature {
  id?: unknown;
  properties?: unknown;
}

const nwsCache = new Map<string, {
  expiresAt: number;
  advisories: OfficialSwellAdvisoryEvidence[];
}>();

interface OfficialRiskRow {
  id: string;
  beach_id: string;
  valid_date: string;
  risk_level: string;
  source: string;
  fetched_at: string;
}

interface LoadOfficialAdvisoriesInput {
  supabase: {
    from: (table: string) => any;
  };
  beachId: string;
  timezone: string;
  now: Date;
}

function addCivilDays(localDate: string, days: number): string {
  const date = new Date(`${localDate}T12:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function officialRiskRowsToSwellAdvisories(input: {
  rows: readonly unknown[];
  beachId: string;
  timezone: string;
  now: Date;
}): OfficialSwellAdvisoryEvidence[] {
  const today = formatInTimeZone(input.now, input.timezone, "yyyy-MM-dd");
  const horizon = addCivilDays(today, HORIZON_DAYS);
  const earliestFetchedAt = input.now.getTime() - FRESHNESS_MS;
  const latestFetchedAt = input.now.getTime() + FUTURE_TOLERANCE_MS;

  return input.rows.flatMap((value): OfficialSwellAdvisoryEvidence[] => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
    const row = value as Partial<OfficialRiskRow>;
    const fetchedAt = Date.parse(row.fetched_at ?? "");
    if (
      typeof row.id !== "string"
      || typeof row.beach_id !== "string"
      || row.beach_id !== input.beachId
      || row.risk_level !== "high"
      || (row.source !== "srf" && row.source !== "alert")
      || typeof row.valid_date !== "string"
      || row.valid_date < today
      || row.valid_date > horizon
      || !Number.isFinite(fetchedAt)
      || fetchedAt < earliestFetchedAt
      || fetchedAt > latestFetchedAt
    ) {
      return [];
    }

    const nextDate = addCivilDays(row.valid_date, 1);
    const startsAt = fromZonedTime(
      `${row.valid_date}T00:00:00.000`,
      input.timezone,
    );
    const endsAt = fromZonedTime(`${nextDate}T00:00:00.000`, input.timezone);
    if (
      !nextDate
      || !Number.isFinite(startsAt.getTime())
      || !Number.isFinite(endsAt.getTime())
    ) {
      return [];
    }

    return [{
      evidenceRef: `official:rip_current_risks:${row.id}`,
      kind: "high_rip_current",
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      beachIds: [input.beachId],
    }];
  }).sort((left, right) => left.evidenceRef.localeCompare(right.evidenceRef));
}

export async function loadOfficialSwellAdvisories(
  input: LoadOfficialAdvisoriesInput,
): Promise<OfficialSwellAdvisoryEvidence[]> {
  const { data, error } = await input.supabase
    .from("rip_current_risks")
    .select("id, beach_id, valid_date, risk_level, source, fetched_at")
    .eq("beach_id", input.beachId)
    .eq("risk_level", "high");
  if (error) {
    throw new Error(`Failed to load official swell advisories: ${error.message}`);
  }
  return officialRiskRowsToSwellAdvisories({
    rows: data ?? [],
    beachId: input.beachId,
    timezone: input.timezone,
    now: input.now,
  });
}

function classifyNwsEvent(
  event: string,
): OfficialSwellAdvisoryEvidence["kind"] | null {
  if (/\bhigh surf\b/i.test(event)) return "high_surf";
  if (
    /\b(hurricane|tropical storm|tropical cyclone)\b/i.test(event)
  ) {
    return "tropical_cyclone";
  }
  if (/\b(rip current|beach hazards)\b/i.test(event)) {
    return "high_rip_current";
  }
  return null;
}

export function nwsAlertsToSwellAdvisories(input: {
  payload: unknown;
  beachId: string;
  now: Date;
}): OfficialSwellAdvisoryEvidence[] {
  if (
    typeof input.payload !== "object"
    || input.payload === null
    || !Array.isArray((input.payload as { features?: unknown }).features)
  ) {
    return [];
  }
  const features = (input.payload as { features: unknown[] }).features;
  return features.flatMap((value): OfficialSwellAdvisoryEvidence[] => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return [];
    }
    const feature = value as NwsAlertFeature;
    if (
      typeof feature.properties !== "object"
      || feature.properties === null
      || Array.isArray(feature.properties)
    ) {
      return [];
    }
    const properties = feature.properties as NwsAlertProperties;
    if (typeof properties.event !== "string") return [];
    const kind = classifyNwsEvent(properties.event);
    if (!kind) return [];
    const evidenceId = typeof properties.id === "string"
      ? properties.id
      : typeof feature.id === "string"
        ? feature.id
        : "";
    const startsAtValue = typeof properties.onset === "string"
      ? properties.onset
      : properties.effective;
    const endsAtValue = typeof properties.ends === "string"
      ? properties.ends
      : properties.expires;
    const startsAt = Date.parse(
      typeof startsAtValue === "string" ? startsAtValue : "",
    );
    const endsAt = Date.parse(
      typeof endsAtValue === "string" ? endsAtValue : "",
    );
    if (
      evidenceId.trim().length === 0
      || !Number.isFinite(startsAt)
      || !Number.isFinite(endsAt)
      || startsAt >= endsAt
      || endsAt <= input.now.getTime()
    ) {
      return [];
    }
    return [{
      evidenceRef: `official:nws_alert:${evidenceId}`,
      kind,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      beachIds: [input.beachId],
    }];
  }).sort((left, right) => left.evidenceRef.localeCompare(right.evidenceRef));
}

export async function loadNwsSwellAdvisories(input: {
  zone: string | null | undefined;
  beachId: string;
  now: Date;
  fetchImpl?: typeof fetch;
}): Promise<OfficialSwellAdvisoryEvidence[]> {
  const zone = input.zone?.trim().toUpperCase() ?? "";
  if (!/^[A-Z]{3}\d{3}$/.test(zone)) return [];
  const cacheKey = `${zone}:${input.beachId}`;
  const cached = nwsCache.get(cacheKey);
  if (cached && cached.expiresAt > input.now.getTime()) {
    return cached.advisories;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NWS_TIMEOUT_MS);
  try {
    const response = await (input.fetchImpl ?? fetch)(
      `https://api.weather.gov/alerts/active?zone=${encodeURIComponent(zone)}`,
      {
        headers: {
          Accept: "application/geo+json",
          "User-Agent": "Quiver Surf major-swell-shadow",
        },
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      throw new Error(`NWS alerts request failed with ${response.status}`);
    }
    const advisories = nwsAlertsToSwellAdvisories({
      payload: await response.json(),
      beachId: input.beachId,
      now: input.now,
    });
    nwsCache.set(cacheKey, {
      expiresAt: input.now.getTime() + NWS_CACHE_MS,
      advisories,
    });
    return advisories;
  } finally {
    clearTimeout(timeout);
  }
}
