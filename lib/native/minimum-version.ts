import { createPublicReadClient } from "@/lib/supabase/server";

export type NativePlatform = "ios" | "android";

export interface NativeMinimumVersion {
  platform: NativePlatform;
  minimum_version: string | null;
  minimum_bundle_created_at: string | null;
}

/**
 * found / missing: the read worked, so the response may be cached.
 * table-missing / error: nothing is known, so the response must not be cached.
 */
export type NativeMinimumReadOutcome = "found" | "missing" | "table-missing" | "error";

export interface NativeMinimumRead {
  result: NativeMinimumVersion;
  outcome: NativeMinimumReadOutcome;
}

interface NativeMinimumRow {
  minimum_version: unknown;
  minimum_bundle_created_at: unknown;
}

const TABLE = "native_app_minimums";
export const MINIMUM_READ_TIMEOUT_MS = 2000;
// PGRST205: PostgREST has no such table in its schema cache. 42P01: Postgres undefined_table.
const TABLE_MISSING_CODES = new Set(["PGRST205", "42P01"]);

const VERSION_PATTERN = /^\d+(\.\d+){0,3}$/;
// Date.parse alone accepts "2026" or "Nov 12 2026". A date-only value parses as UTC; a
// date-time needs a zone so the value never depends on the server's local time zone.
const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2}))?$/;

let tableMissingWarned = false;

export function parseNativePlatform(value: string | null): NativePlatform | null {
  if (value === "ios" || value === "android") return value;
  return null;
}

function emptyMinimum(platform: NativePlatform): NativeMinimumVersion {
  return { platform, minimum_version: null, minimum_bundle_created_at: null };
}

function readText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function warnInvalid(field: string): void {
  // The value is not logged: only the field name reaches the logs.
  console.warn(`[minimum-version] ${field} is invalid; ignoring it`);
}

export function parseMinimumVersion(field: string, raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const value = readText(raw);
  if (value === null) {
    if (typeof raw !== "string") warnInvalid(field);
    return null;
  }
  if (!VERSION_PATTERN.test(value)) {
    warnInvalid(field);
    return null;
  }
  return value;
}

export function parseMinimumBundleCreatedAt(field: string, raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const value = readText(raw);
  if (value === null) {
    if (typeof raw !== "string") warnInvalid(field);
    return null;
  }
  // PostgREST returns timestamptz as "2026-11-12T00:00:00+00:00".
  if (!ISO_DATE_TIME_PATTERN.test(value)) {
    warnInvalid(field);
    return null;
  }
  const ms = Date.parse(value);
  // A future date would block every install, including ones built after the typo.
  if (Number.isNaN(ms) || ms > Date.now()) {
    warnInvalid(field);
    return null;
  }
  return new Date(ms).toISOString();
}

export function parseNativeMinimumRow(
  platform: NativePlatform,
  row: NativeMinimumRow | null,
): NativeMinimumVersion {
  if (row === null) return emptyMinimum(platform);
  return {
    platform,
    minimum_version: parseMinimumVersion(`${TABLE}.minimum_version (${platform})`, row.minimum_version),
    minimum_bundle_created_at: parseMinimumBundleCreatedAt(
      `${TABLE}.minimum_bundle_created_at (${platform})`,
      row.minimum_bundle_created_at,
    ),
  };
}

class MinimumReadTimeoutError extends Error {}

// The app's own fetch times out at 5 s, so two 2 s attempts still answer in time.
const READ_ATTEMPTS = 2;
// supabase-js turns an aborted fetch into an error whose message starts with the error name.
const STALL_MESSAGE_PATTERN = /^(AbortError|TimeoutError)\b/;

type AttemptResult = NativeMinimumRead | "stalled";

function isTableMissing(error: { code?: unknown } | null): boolean {
  return typeof error?.code === "string" && TABLE_MISSING_CODES.has(error.code);
}

function isStall(error: { message?: unknown }): boolean {
  return typeof error.message === "string" && STALL_MESSAGE_PATTERN.test(error.message);
}

async function readOnce(platform: NativePlatform): Promise<AttemptResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const supabase = createPublicReadClient();
    const query = supabase
      .from(TABLE)
      .select("minimum_version, minimum_bundle_created_at")
      .eq("platform", platform)
      .abortSignal(AbortSignal.timeout(MINIMUM_READ_TIMEOUT_MS))
      .maybeSingle();
    // The race bounds the read even when the client does not honor the abort signal.
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new MinimumReadTimeoutError()), MINIMUM_READ_TIMEOUT_MS);
    });
    const { data, error } = await Promise.race([query, timeout]);

    if (error) {
      if (isTableMissing(error)) {
        if (!tableMissingWarned) {
          tableMissingWarned = true;
          console.warn(`[minimum-version] table ${TABLE} is missing; returning nulls`);
        }
        return { result: emptyMinimum(platform), outcome: "table-missing" };
      }
      if (isStall(error)) return "stalled";
      console.error("[minimum-version] read failed; returning nulls", {
        code: error.code,
        message: error.message,
      });
      return { result: emptyMinimum(platform), outcome: "error" };
    }

    if (data === null) return { result: emptyMinimum(platform), outcome: "missing" };
    return { result: parseNativeMinimumRow(platform, data), outcome: "found" };
  } catch (error) {
    if (error instanceof MinimumReadTimeoutError) return "stalled";
    console.error("[minimum-version] read threw; returning nulls", error);
    return { result: emptyMinimum(platform), outcome: "error" };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Reads the platform row with the cookie-less anon client: the values are public
 * (RLS SELECT policy for anon), so no service role is needed. A stalled read is
 * tried once more; every other failure fails open to nulls, because a wrong forced
 * update locks users out of the app.
 */
export async function readNativeMinimumVersion(platform: NativePlatform): Promise<NativeMinimumRead> {
  for (let attempt = 1; attempt <= READ_ATTEMPTS; attempt += 1) {
    const result = await readOnce(platform);
    if (result !== "stalled") return result;
  }
  console.error(
    `[minimum-version] read timed out ${READ_ATTEMPTS} times after ${MINIMUM_READ_TIMEOUT_MS} ms; returning nulls`,
  );
  return { result: emptyMinimum(platform), outcome: "error" };
}

/** Test hook: the table-missing warning is logged once per server instance. */
export function resetMinimumVersionWarningsForTests(): void {
  tableMissingWarned = false;
}
