import { createClient } from "@supabase/supabase-js";

export const INTERNAL_ANALYTICS_PROFILE_IDS: ReadonlyMap<string, string> = new Map([
  ["610a5745-1fac-429c-8f5a-8d085783a5ea", "founder_primary"],
  ["73040cff-afe9-4fa0-a874-2016203fc015", "founder_android"],
  ["c15c2ab3-275c-49d1-ac4f-dcc493db0653", "founder_or_maestro"],
  ["3290f65d-b474-49e2-ac5e-27de2db3fc9e", "system_poster"],
]);

export const POSTHOG_INTERNAL_COHORT_ID = 309795;
// Larger per-user event batches can exceed PostgREST's 8-second statement timeout.
export const USER_EVENT_USER_CHUNK_SIZE = 25;

export interface ReportProfile {
  id: string;
  deleted_at?: string | null;
  is_mock?: boolean | null;
  is_system_account?: boolean | null;
  analytics_is_real_user?: boolean | null;
}

export type ProfileExclusionReason =
  | "internal_account"
  | "deleted_profile"
  | "mock_profile"
  | "system_account"
  | "not_real_user"
  | "missing_profile";

export function profileExclusionReason(
  profile: ReportProfile | undefined,
  userId: string,
): ProfileExclusionReason | null {
  if (INTERNAL_ANALYTICS_PROFILE_IDS.has(userId)) return "internal_account";
  if (!profile) return "missing_profile";
  if (profile.deleted_at != null) return "deleted_profile";
  if (profile.is_mock === true) return "mock_profile";
  if (profile.is_system_account === true) return "system_account";
  if (profile.analytics_is_real_user === false) return "not_real_user";
  return null;
}

export type ReadOnlySupabase = { from(table: string): { select: (...args: any[]) => any } };

function readOnlyError(): Error {
  return new Error("Analytics report client is read-only");
}

export function readOnlySupabase(client: { from: (table: string) => any }): ReadOnlySupabase {
  return new Proxy({
    from(table: string) {
      return new Proxy({
        select(...args: any[]) {
          return client.from(table).select(...args);
        },
      }, {
        get(target, property, receiver) {
          if (property === "select") return Reflect.get(target, property, receiver);
          throw readOnlyError();
        },
      });
    },
  }, {
    get(target, property, receiver) {
      if (property === "from") return Reflect.get(target, property, receiver);
      throw readOnlyError();
    },
  });
}

export function createReadOnlySupabaseFromEnv(env: NodeJS.ProcessEnv = process.env): ReadOnlySupabase {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() || env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url) throw new Error("Missing required env var: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
  if (!serviceRoleKey) throw new Error("Missing required env var: SUPABASE_SERVICE_ROLE_KEY");
  return readOnlySupabase(createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }));
}

export async function loadProfileExclusions(
  client: ReadOnlySupabase,
  userIds: Iterable<string>,
): Promise<Map<string, ProfileExclusionReason | null>> {
  const ids = [...new Set(userIds)];
  const profiles = new Map<string, ReportProfile>();
  for (let index = 0; index < ids.length; index += 200) {
    const chunk = ids.slice(index, index + 200);
    const { data, error } = await client.from("profiles")
      .select("id,deleted_at,is_mock,is_system_account,analytics_is_real_user")
      .in("id", chunk) as { data: ReportProfile[] | null; error: { message: string } | null };
    if (error) throw new Error(error.message);
    for (const profile of data ?? []) profiles.set(profile.id, profile);
  }
  return new Map(ids.map((id) => [id, profileExclusionReason(profiles.get(id), id)]));
}

export function hogqlInternalPersonExclusion(personIdExpr = "person_id"): string {
  const ids = [...INTERNAL_ANALYTICS_PROFILE_IDS.keys()].map((id) => `'${id}'`).join(",");
  return `${personIdExpr} NOT IN COHORT ${POSTHOG_INTERNAL_COHORT_ID} AND ${personIdExpr} NOT IN (SELECT person_id FROM person_distinct_ids WHERE distinct_id IN (${ids}))`;
}

export const HOGQL_NOT_BOT = "NOT coalesce(properties.$virt_is_bot, false)";
export const HOGQL_NOT_EMULATOR = "coalesce(properties.$is_emulator, false) = false";

export async function selectAllPages<T>(makeQuery: () => any, pageSize = 1000): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error("pageSize must be a positive integer");
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery().range(from, from + pageSize - 1) as {
      data: T[] | null;
      error: { message: string } | null;
    };
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export interface ReportWindow {
  start: Date;
  end: Date;
  timeZone: string;
  startDate: string;
  endDate: string;
  days: number;
}

function dateParts(instant: Date, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal")
    .map((part) => [part.type, Number(part.value)]));
}

export function localDate(instant: Date, timeZone: string): string {
  const { year, month, day } = dateParts(instant, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseLocalDate(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid local date: ${value}`);
  const [year, month, day] = value.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  if (new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid local date: ${value}`);
  }
  return timestamp;
}

function dateAtOffset(value: string, days: number): string {
  return new Date(parseLocalDate(value) + days * 86_400_000).toISOString().slice(0, 10);
}

function localMidnight(value: string, timeZone: string): Date {
  const target = parseLocalDate(value);
  let instant = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { year, month, day, hour, minute, second } = dateParts(new Date(instant), timeZone);
    const observed = Date.UTC(year, month - 1, day, hour, minute, second);
    const correction = target - observed;
    if (correction === 0) return new Date(instant);
    instant += correction;
  }
  throw new Error(`Cannot resolve local midnight for ${value} in ${timeZone}`);
}

export function resolveCompleteDayWindow(opts: {
  startDate?: string;
  endDate?: string;
  days?: number;
  timeZone?: string;
  now?: Date;
}): ReportWindow {
  const timeZone = opts.timeZone ?? "America/Los_Angeles";
  const requestedDays = opts.days ?? 7;
  if (!Number.isInteger(requestedDays) || requestedDays < 1) {
    throw new Error("days must be a positive integer");
  }
  const endDate = opts.endDate ?? localDate(opts.now ?? new Date(), timeZone);
  const startDate = opts.startDate ?? dateAtOffset(endDate, -requestedDays);
  const days = (parseLocalDate(endDate) - parseLocalDate(startDate)) / 86_400_000;
  if (days < 1) throw new Error("startDate must be before endDate");
  return {
    start: localMidnight(startDate, timeZone),
    end: localMidnight(endDate, timeZone),
    timeZone,
    startDate,
    endDate,
    days,
  };
}

export async function runHogQL(
  query: string,
  opts: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<{ columns: string[]; results: unknown[][] }> {
  const queryCode = query
    .replace(/'(?:''|\\.|[^'])*'|"(?:""|\\.|[^"])*"/g, " ")
    .replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, " ");
  if (!/\bLIMIT\s+\d+\b/i.test(queryCode)) throw new Error("HogQL query requires a LIMIT clause");
  const env = opts.env ?? process.env;
  const apiKey = (env.POSTHOG_PERSONAL_API_KEY ?? env.POSTHOG_API_KEY)?.trim();
  if (!apiKey) throw new Error("Missing required env var: POSTHOG_PERSONAL_API_KEY or POSTHOG_API_KEY");
  const host = (env.POSTHOG_HOST || "https://us.posthog.com").replace(/\/$/, "");
  const projectId = env.POSTHOG_PROJECT_ID || "424662";
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const url = `${host}/api/projects/${projectId}/query/`;
  const init: RequestInit = {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  };
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetchImpl(url, init);
    if (response.ok) {
      const payload = await response.json() as { columns?: unknown; results?: unknown };
      if (!Array.isArray(payload.columns) || !Array.isArray(payload.results)) {
        throw new Error("PostHog query returned an invalid result");
      }
      return payload as { columns: string[]; results: unknown[][] };
    }
    if (![429, 502, 503, 504].includes(response.status) || attempt === 4) {
      throw new Error(`PostHog query failed: ${response.status} ${await response.text()}`);
    }
    const retryAfter = response.headers.get("retry-after");
    const retryAfterSeconds = Number(retryAfter);
    const delayMs = retryAfter !== null && Number.isFinite(retryAfterSeconds)
      ? retryAfterSeconds * 1000
      : 1000 * 2 ** attempt;
    await sleep(delayMs);
  }
  throw new Error("PostHog query retry limit reached");
}
