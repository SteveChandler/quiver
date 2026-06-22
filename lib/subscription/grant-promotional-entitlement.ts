const REVENUECAT_API_BASE_URL = "https://api.revenuecat.com";
const DEFAULT_PRO_ENTITLEMENT_ID = "Quiver Pro";
const ACTIVE_GRANT_SKIP_WINDOW_MS = 24 * 60 * 60 * 1000;
const WEEKLY_PROMO_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const EARN_PRO_REASON = "weekly_session_streak";

export interface EarnProStreakSnapshot {
  weeklySessionStreakCurrent: number;
  dailyCallStreakCurrent: number;
  weeklySessionStreakBest?: number;
  dailyCallStreakBest?: number;
}

interface GrantPromotionalEntitlementOptions {
  supabase: unknown;
  userId: string;
  streakSnapshot: EarnProStreakSnapshot;
  now?: Date;
  fetchImpl?: typeof fetch;
}

export type GrantPromotionalEntitlementResult =
  | {
      status: "granted";
      expiresAt: string;
    }
  | {
      status: "skipped_active";
      expiresAt: string;
    }
  | {
      status: "failed";
      error: string;
      statusCode?: number;
    };

interface QueryBuilder {
  select(columns: string): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  is(column: string, value: unknown): QueryBuilder;
  gt(column: string, value: unknown): QueryBuilder;
  order(column: string, options: { ascending: boolean }): QueryBuilder;
  limit(count: number): QueryBuilder;
  maybeSingle(): Promise<{
    data: { expires_at?: string | null } | null;
    error: { message: string } | null;
  }>;
  insert(row: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
}

interface SupabaseEarnedProClient {
  from(table: "earned_pro_grants"): QueryBuilder;
}

function asEarnedProClient(supabase: unknown): SupabaseEarnedProClient {
  return supabase as SupabaseEarnedProClient;
}

export function isEarnProEnabled(value = process.env.EARN_PRO_ENABLED): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function parseEarnProTestUserIds(
  value = process.env.EARN_PRO_TEST_USER_IDS,
): string[] {
  const uniqueIds = new Set(
    (value ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
  return Array.from(uniqueIds);
}

export function isEarnProEligible(snapshot: EarnProStreakSnapshot): boolean {
  return snapshot.weeklySessionStreakCurrent >= 2 && snapshot.dailyCallStreakCurrent >= 1;
}

export function getEarnProEntitlementId(): string {
  return process.env.EARN_PRO_ENTITLEMENT_ID?.trim() || DEFAULT_PRO_ENTITLEMENT_ID;
}

function getRevenueCatSecretApiKey(): string | null {
  return process.env.REVENUECAT_SECRET_API_KEY?.trim() || null;
}

function computeWeeklyPromoExpiresAt(now: Date): string {
  return new Date(now.getTime() + WEEKLY_PROMO_DURATION_MS).toISOString();
}

async function readActiveGrant(
  supabase: SupabaseEarnedProClient,
  userId: string,
  entitlementId: string,
  now: Date,
): Promise<GrantPromotionalEntitlementResult | null> {
  const threshold = new Date(now.getTime() + ACTIVE_GRANT_SKIP_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from("earned_pro_grants")
    .select("expires_at")
    .eq("user_id", userId)
    .eq("entitlement_id", entitlementId)
    .is("revoked_at", null)
    .gt("expires_at", threshold)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { status: "failed", error: `active grant lookup failed: ${error.message}` };
  }

  if (!data?.expires_at) return null;
  return { status: "skipped_active", expiresAt: data.expires_at };
}

async function readRevenueCatError(response: Response): Promise<string> {
  try {
    const body = await response.text();
    return body.trim() || response.statusText || "RevenueCat request failed";
  } catch {
    return response.statusText || "RevenueCat request failed";
  }
}

export async function grantPromotionalEntitlement({
  supabase,
  userId,
  streakSnapshot,
  now = new Date(),
  fetchImpl = fetch,
}: GrantPromotionalEntitlementOptions): Promise<GrantPromotionalEntitlementResult> {
  const entitlementId = getEarnProEntitlementId();
  const activeGrant = await readActiveGrant(
    asEarnedProClient(supabase),
    userId,
    entitlementId,
    now,
  );
  if (activeGrant) return activeGrant;

  const secretApiKey = getRevenueCatSecretApiKey();
  if (!secretApiKey) {
    return { status: "failed", error: "REVENUECAT_SECRET_API_KEY is not configured" };
  }

  const expiresAt = computeWeeklyPromoExpiresAt(now);
  const response = await fetchImpl(
    `${REVENUECAT_API_BASE_URL}/v1/subscribers/${encodeURIComponent(
      userId,
    )}/entitlements/${encodeURIComponent(entitlementId)}/promotional`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ end_time_ms: Date.parse(expiresAt) }),
    },
  );

  if (!response.ok) {
    return {
      status: "failed",
      statusCode: response.status,
      error: await readRevenueCatError(response),
    };
  }

  const { error } = await asEarnedProClient(supabase)
    .from("earned_pro_grants")
    .insert({
      user_id: userId,
      entitlement_id: entitlementId,
      expires_at: expiresAt,
      reason: EARN_PRO_REASON,
      streak_snapshot: streakSnapshot,
    });

  if (error) {
    return { status: "failed", error: `grant audit insert failed: ${error.message}` };
  }

  return { status: "granted", expiresAt };
}
