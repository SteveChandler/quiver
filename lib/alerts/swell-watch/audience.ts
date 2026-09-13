import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";

export type SwellWatchAudienceReason = "home" | "favorite" | "rule";

interface SwellWatchAudienceMember {
  recipientUserId: string;
  beachId: string;
  reason: SwellWatchAudienceReason;
}

export interface SwellWatchAudienceRows {
  profiles: Array<{
    id: string;
    homeBeachId: string | null;
    notifPushEnabled: boolean;
    notifForecastAlerts: boolean;
  }>;
  favorites: Array<{
    userId: string;
    beachId: string | null;
    alertsEnabled: boolean;
  }>;
  rules: Array<{
    userId: string;
    beachId: string | null;
    enabled: boolean;
    notifyPush: boolean;
  }>;
  devices: Array<{ userId: string }>;
}

interface LoadSwellWatchAudienceOptions {
  pageSize?: number;
}

interface PagedResult<T> {
  data: T[] | null;
  count: number | null;
  error: { message: string } | null;
}

const DEFAULT_PAGE_SIZE = 500;

function audienceKey(userId: string, beachId: string): string {
  return `${userId}:${beachId}`;
}

function normalizeBeachIds(beachIds: readonly string[]): string[] {
  return [...new Set(beachIds.filter((beachId) => beachId.length > 0))].sort(
    (left, right) => left.localeCompare(right),
  );
}

async function loadCompletePages<T>(
  relation: string,
  pageSize: number,
  fetchPage: (from: number, to: number) => Promise<PagedResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  let expectedCount: number | null = null;

  while (true) {
    const result = await fetchPage(rows.length, rows.length + pageSize - 1);
    if (result.error) {
      throw new Error(`Failed to load ${relation}: ${result.error.message}`);
    }
    if (result.count === null) {
      throw new Error(`Incomplete ${relation} read: missing exact count`);
    }
    if (expectedCount === null) {
      expectedCount = result.count;
    } else if (expectedCount !== result.count) {
      throw new Error(`Incomplete ${relation} read: count changed while paging`);
    }

    const page = result.data ?? [];
    if (rows.length + page.length > expectedCount) {
      throw new Error(`Incomplete ${relation} read: received too many rows`);
    }
    rows.push(...page);
    if (rows.length === expectedCount) return rows;
    if (page.length === 0) {
      throw new Error(`Incomplete ${relation} read: page ended before exact count`);
    }
  }
}

export function selectSwellWatchAudience(
  beachIds: readonly string[],
  rows: SwellWatchAudienceRows,
): SwellWatchAudienceMember[] {
  const targetBeachIds = normalizeBeachIds(beachIds);
  if (targetBeachIds.length === 0) return [];

  const deviceUserIds = new Set(rows.devices.map((device) => device.userId));
  const favoriteKeys = new Set(
    rows.favorites
      .filter(
        (favorite) =>
          favorite.beachId !== null && favorite.alertsEnabled === true,
      )
      .map((favorite) => audienceKey(favorite.userId, favorite.beachId!)),
  );
  const ruleKeys = new Set(
    rows.rules
      .filter(
        (rule) =>
          rule.beachId !== null &&
          rule.enabled === true &&
          rule.notifyPush === true,
      )
      .map((rule) => audienceKey(rule.userId, rule.beachId!)),
  );

  const result: SwellWatchAudienceMember[] = [];
  for (const profile of [...rows.profiles].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    if (
      profile.notifPushEnabled !== true ||
      profile.notifForecastAlerts !== true ||
      !deviceUserIds.has(profile.id)
    ) {
      continue;
    }
    for (const beachId of targetBeachIds) {
      if (profile.homeBeachId === beachId) {
        result.push({ recipientUserId: profile.id, beachId, reason: "home" });
        continue;
      }
      const key = audienceKey(profile.id, beachId);
      if (favoriteKeys.has(key)) {
        result.push({ recipientUserId: profile.id, beachId, reason: "favorite" });
        continue;
      }
      if (ruleKeys.has(key)) {
        result.push({ recipientUserId: profile.id, beachId, reason: "rule" });
      }
    }
  }
  return result;
}

export async function loadSwellWatchAudience(
  supabase: SupabaseClient<Database>,
  beachIds: readonly string[],
  options: LoadSwellWatchAudienceOptions = {},
): Promise<SwellWatchAudienceMember[]> {
  const targetBeachIds = normalizeBeachIds(beachIds);
  if (targetBeachIds.length === 0) return [];

  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error("Swell Watch audience page size must be a positive integer");
  }

  const [profiles, favorites, rules, devices] = await Promise.all([
    loadCompletePages("profiles", pageSize, async (from, to) =>
      (await supabase
        .from("profiles")
        .select("id, home_beach_id, notif_push_enabled, notif_forecast_alerts", {
          count: "exact",
        })
        .eq("notif_push_enabled", true)
        .eq("notif_forecast_alerts", true)
        .order("id", { ascending: true })
        .range(from, to)) as unknown as PagedResult<{
        id: string;
        home_beach_id: string | null;
        notif_push_enabled: boolean;
        notif_forecast_alerts: boolean;
      }>,
    ),
    loadCompletePages("favorite_beaches", pageSize, async (from, to) =>
      (await supabase
        .from("favorite_beaches")
        .select("user_id, beach_id, alerts_enabled", { count: "exact" })
        .in("beach_id", targetBeachIds)
        .eq("alerts_enabled", true)
        .is("custom_spot_id", null)
        .order("id", { ascending: true })
        .range(from, to)) as unknown as PagedResult<{
        user_id: string;
        beach_id: string | null;
        alerts_enabled: boolean;
      }>,
    ),
    loadCompletePages("alert_rules", pageSize, async (from, to) =>
      (await supabase
        .from("alert_rules")
        .select("user_id, beach_id, enabled, notify_push", { count: "exact" })
        .in("beach_id", targetBeachIds)
        .eq("enabled", true)
        .eq("notify_push", true)
        .order("id", { ascending: true })
        .range(from, to)) as unknown as PagedResult<{
        user_id: string;
        beach_id: string | null;
        enabled: boolean;
        notify_push: boolean;
      }>,
    ),
    loadCompletePages("user_devices", pageSize, async (from, to) =>
      (await supabase
        .from("user_devices")
        .select("user_id", { count: "exact" })
        .is("retired_at", null)
        .order("id", { ascending: true })
        .range(from, to)) as unknown as PagedResult<{ user_id: string }>,
    ),
  ]);

  return selectSwellWatchAudience(targetBeachIds, {
    profiles: profiles.map((profile) => ({
      id: profile.id,
      homeBeachId: profile.home_beach_id,
      notifPushEnabled: profile.notif_push_enabled,
      notifForecastAlerts: profile.notif_forecast_alerts,
    })),
    favorites: favorites.map((favorite) => ({
      userId: favorite.user_id,
      beachId: favorite.beach_id,
      alertsEnabled: favorite.alerts_enabled,
    })),
    rules: rules.map((rule) => ({
      userId: rule.user_id,
      beachId: rule.beach_id,
      enabled: rule.enabled,
      notifyPush: rule.notify_push,
    })),
    devices: devices.map((device) => ({ userId: device.user_id })),
  });
}
