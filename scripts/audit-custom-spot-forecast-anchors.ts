import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import path from "node:path";

import {
  buildCustomSpotAnchorAudit,
  DEFAULT_CUSTOM_SPOT_ANCHOR_AUDIT_CONFIG,
  formatCustomSpotAnchorAuditMarkdown,
  type CustomSpotAnchorAuditBeach,
  type CustomSpotAnchorAuditCustomSpot,
  type CustomSpotAnchorAuditForecast,
} from "../lib/services/forecast/custom-spot-anchor-audit";

loadEnv({ path: path.resolve(process.cwd(), ".env") });
loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: true });
loadEnv({
  path: path.resolve(process.cwd(), ".env.production.local"),
  override: true,
});

type CliOptions = {
  maxAnchorDistanceMi: number;
  closerAnchorMinDeltaMi: number;
  closerAnchorMaxDistanceMi: number;
  forecastFreshnessHours: number;
  limit: number;
  includeMock: boolean;
  json: boolean;
  failOnCritical: boolean;
  help: boolean;
};

type CustomSpotRow = {
  id: string;
  user_id: string;
  name: string | null;
  lat: number | null;
  lon: number | null;
  nearest_beach_id: string | null;
  nearest_beach_distance_mi: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type BeachRow = {
  id: string;
  name: string | null;
  slug: string | null;
  lat: number | null;
  lon: number | null;
  deleted_at: string | null;
};

type ForecastRow = {
  beach_id: string;
  updated_at: string | null;
  data_source: string | null;
};

type ProfileRow = {
  id: string;
  is_mock: boolean | null;
  analytics_is_real_user: boolean | null;
  deleted_at: string | null;
};

const PAGE_SIZE = 1000;

function printUsage(): void {
  console.log(`Usage: yarn qa:custom-spot-anchors [options]

Options:
  --max-anchor-distance-mi <number>   Critical when current anchor is farther away
  --freshness-hours <number>          Critical when latest forecast update is older
  --closer-anchor-min-delta-mi <n>    Watch when a closer beach improves by at least n miles
  --closer-anchor-max-distance-mi <n> Watch only when the closer beach is within n miles
  --limit <number>                    Number of issue rows to print
  --include-mock                      Include mock/test profiles
  --json                              Print JSON instead of markdown
  --fail-on-critical                  Exit nonzero when critical issues exist
  --help                              Show this help
`);
}

function parseNumberOption(
  args: string[],
  index: number,
  name: string
): { value: number; nextIndex: number } {
  const arg = args[index];
  const inlinePrefix = `${name}=`;
  const rawValue = arg.startsWith(inlinePrefix)
    ? arg.slice(inlinePrefix.length)
    : args[index + 1];
  const nextIndex = arg.startsWith(inlinePrefix) ? index : index + 1;
  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    throw new Error(`Invalid numeric value for ${name}: ${rawValue ?? ""}`);
  }

  return { value, nextIndex };
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    maxAnchorDistanceMi:
      DEFAULT_CUSTOM_SPOT_ANCHOR_AUDIT_CONFIG.maxAnchorDistanceMi,
    closerAnchorMinDeltaMi:
      DEFAULT_CUSTOM_SPOT_ANCHOR_AUDIT_CONFIG.closerAnchorMinDeltaMi,
    closerAnchorMaxDistanceMi:
      DEFAULT_CUSTOM_SPOT_ANCHOR_AUDIT_CONFIG.closerAnchorMaxDistanceMi,
    forecastFreshnessHours:
      DEFAULT_CUSTOM_SPOT_ANCHOR_AUDIT_CONFIG.forecastFreshnessHours,
    limit: 25,
    includeMock: false,
    json: false,
    failOnCritical: false,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--include-mock") {
      options.includeMock = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--fail-on-critical") {
      options.failOnCritical = true;
    } else if (
      arg === "--max-anchor-distance-mi" ||
      arg.startsWith("--max-anchor-distance-mi=")
    ) {
      const parsed = parseNumberOption(args, index, "--max-anchor-distance-mi");
      options.maxAnchorDistanceMi = parsed.value;
      index = parsed.nextIndex;
    } else if (
      arg === "--freshness-hours" ||
      arg.startsWith("--freshness-hours=")
    ) {
      const parsed = parseNumberOption(args, index, "--freshness-hours");
      options.forecastFreshnessHours = parsed.value;
      index = parsed.nextIndex;
    } else if (
      arg === "--closer-anchor-min-delta-mi" ||
      arg.startsWith("--closer-anchor-min-delta-mi=")
    ) {
      const parsed = parseNumberOption(
        args,
        index,
        "--closer-anchor-min-delta-mi"
      );
      options.closerAnchorMinDeltaMi = parsed.value;
      index = parsed.nextIndex;
    } else if (
      arg === "--closer-anchor-max-distance-mi" ||
      arg.startsWith("--closer-anchor-max-distance-mi=")
    ) {
      const parsed = parseNumberOption(
        args,
        index,
        "--closer-anchor-max-distance-mi"
      );
      options.closerAnchorMaxDistanceMi = parsed.value;
      index = parsed.nextIndex;
    } else if (arg === "--limit" || arg.startsWith("--limit=")) {
      const parsed = parseNumberOption(args, index, "--limit");
      options.limit = parsed.value;
      index = parsed.nextIndex;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} before running this audit`);
  return value;
}

function createSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url) throw new Error("Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchCustomSpots(
  supabase: SupabaseClient
): Promise<CustomSpotRow[]> {
  const rows: CustomSpotRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("custom_spots")
      .select(
        "id,user_id,name,lat,lon,nearest_beach_id,nearest_beach_distance_mi,created_at,updated_at"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`custom_spots query failed: ${error.message}`);

    const page = (data ?? []) as CustomSpotRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function fetchBeaches(supabase: SupabaseClient): Promise<BeachRow[]> {
  const rows: BeachRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("beaches")
      .select("id,name,slug,lat,lon,deleted_at")
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`beaches query failed: ${error.message}`);

    const page = (data ?? []) as BeachRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function fetchForecasts(
  supabase: SupabaseClient
): Promise<ForecastRow[]> {
  const rows: ForecastRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("v_enhanced_forecast_latest")
      .select("beach_id,updated_at,data_source")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`v_enhanced_forecast_latest query failed: ${error.message}`);
    }

    const page = (data ?? []) as ForecastRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function fetchProfiles(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, ProfileRow>> {
  const profiles = new Map<string, ProfileRow>();
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

  for (const idChunk of chunk(uniqueUserIds, PAGE_SIZE)) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,is_mock,analytics_is_real_user,deleted_at")
      .in("id", idChunk);

    if (error) throw new Error(`profiles query failed: ${error.message}`);

    for (const profile of (data ?? []) as ProfileRow[]) {
      profiles.set(profile.id, profile);
    }
  }

  return profiles;
}

function hasFiniteCoordinates(row: {
  lat: number | null;
  lon: number | null;
}): row is { lat: number; lon: number } {
  return Number.isFinite(row.lat) && Number.isFinite(row.lon);
}

function shouldExcludeProfile(
  profile: ProfileRow | undefined,
  includeMock: boolean
): { excluded: boolean; reason: string | null } {
  if (includeMock) return { excluded: false, reason: null };
  if (!profile) return { excluded: false, reason: null };
  if (profile.deleted_at) return { excluded: true, reason: "deleted_profile" };
  if (profile.is_mock) return { excluded: true, reason: "mock_profile" };
  if (profile.analytics_is_real_user === false) {
    return { excluded: true, reason: "non_real_user_profile" };
  }

  return { excluded: false, reason: null };
}

function mapCustomSpot(
  row: CustomSpotRow,
  profile: ProfileRow | undefined,
  includeMock: boolean
): CustomSpotAnchorAuditCustomSpot | null {
  if (!hasFiniteCoordinates(row)) return null;

  const exclusion = shouldExcludeProfile(profile, includeMock);

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name ?? "Unnamed custom spot",
    lat: row.lat,
    lon: row.lon,
    nearestBeachId: row.nearest_beach_id,
    nearestBeachDistanceMi: row.nearest_beach_distance_mi,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    excluded: exclusion.excluded,
    exclusionReason: exclusion.reason,
  };
}

function mapBeach(row: BeachRow): CustomSpotAnchorAuditBeach | null {
  if (!hasFiniteCoordinates(row)) return null;

  return {
    id: row.id,
    name: row.name ?? "Unnamed beach",
    slug: row.slug,
    lat: row.lat,
    lon: row.lon,
    deletedAt: row.deleted_at,
  };
}

function mapForecast(row: ForecastRow): CustomSpotAnchorAuditForecast {
  return {
    beachId: row.beach_id,
    updatedAt: row.updated_at,
    dataSource: row.data_source,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const supabase = createSupabase();
  const customSpotRows = await fetchCustomSpots(supabase);
  const profileById = await fetchProfiles(
    supabase,
    customSpotRows.map((row) => row.user_id)
  );
  const customSpots = customSpotRows
    .map((row) =>
      mapCustomSpot(row, profileById.get(row.user_id), options.includeMock)
    )
    .filter((spot): spot is CustomSpotAnchorAuditCustomSpot => Boolean(spot));
  const beaches = (await fetchBeaches(supabase))
    .map(mapBeach)
    .filter((beach): beach is CustomSpotAnchorAuditBeach => Boolean(beach));
  const forecasts = (await fetchForecasts(supabase)).map(mapForecast);

  const audit = buildCustomSpotAnchorAudit({
    customSpots,
    beaches,
    forecasts,
    config: {
      maxAnchorDistanceMi: options.maxAnchorDistanceMi,
      closerAnchorMinDeltaMi: options.closerAnchorMinDeltaMi,
      closerAnchorMaxDistanceMi: options.closerAnchorMaxDistanceMi,
      forecastFreshnessHours: options.forecastFreshnessHours,
      now: new Date(),
    },
  });

  if (options.json) {
    console.log(JSON.stringify(audit, null, 2));
  } else {
    console.log(
      formatCustomSpotAnchorAuditMarkdown(audit, { limit: options.limit })
    );
  }

  if (options.failOnCritical && audit.summary.critical > 0) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
