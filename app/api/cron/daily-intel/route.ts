import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { IntelGenerationService } from "@/lib/services/intel-generation-service";
import { getTimezoneFromCoords } from "@/lib/utils/timezone-utils.server";
import { DEFAULT_TIMEZONE } from "@/lib/utils/timezone-utils";
import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabaseConfig() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, serviceKey };
}

/**
 * GET /api/cron/daily-intel
 *
 * Generates + upserts `beach_daily_intel` for beaches that have the required preferences.
 *
 * Query params:
 * - generationTime: HH:MM (default "06:00") - used for the record key and analysis time anchor
 * - maxBeaches: number (default 60) - hard cap on beaches processed per run
 */
async function _GET(request: Request): Promise<Response> {
  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
    }

    const { url, serviceKey } = getSupabaseConfig();
    if (!url || !serviceKey) {
      return createErrorResponse(
        "Missing Supabase configuration",
        "Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY",
        500
      );
    }

    const { searchParams } = new URL(request.url);
    const generationTime = (searchParams.get("generationTime") || "06:00").trim();
    const maxBeaches = Math.max(
      1,
      Math.min(500, Number.parseInt(searchParams.get("maxBeaches") || "60", 10) || 60)
    );

    const startMs = Date.now();
    const timeBudgetMs = Math.max(
      10_000,
      Number.parseInt(process.env.DAILY_INTEL_CRON_TIME_BUDGET_MS || "250000", 10) ||
        250_000
    );

    const supabase = await createSupabaseServiceRoleClient();
    const { data: beaches, error: beachesError } = await supabase
      .from("beaches")
      .select("id, lat, lon, preferred_tide_ft_min, preferred_tide_ft_max")
      .not("preferred_tide_ft_min", "is", null)
      .not("preferred_tide_ft_max", "is", null)
      .order("id", { ascending: true })
      .limit(maxBeaches);

    if (beachesError) {
      throw beachesError;
    }

    const generator = new IntelGenerationService(url, serviceKey);

    const results: Array<{
      beachId: string;
      timezone: string;
      ok: boolean;
      error?: string;
    }> = [];

    for (const beach of beaches || []) {
      if (Date.now() - startMs > timeBudgetMs) break;

      const beachId = beach.id as string;
      const lat = beach.lat as number | null;
      const lon = beach.lon as number | null;
      const timezone =
        lat != null && lon != null ? getTimezoneFromCoords(lat, lon) : DEFAULT_TIMEZONE;

      console.log(`[daily-intel cron] Processing beach ${beachId}:`, {
        hasCoordinates: lat != null && lon != null,
        lat,
        lon,
        timezone,
        generationTime,
      });

      try {
        const intel = await generator.generateIntel(beachId, generationTime, timezone);
        await generator.saveIntel(beachId, intel, generationTime, timezone);
        results.push({ beachId, timezone, ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`[daily-intel cron] Error processing beach ${beachId}:`, message);
        results.push({ beachId, timezone, ok: false, error: message });
      }
    }

    const successful = results.filter((r) => r.ok).length;
    const failed = results.length - successful;
    const outcome = await withCronOutcome(
      {
        job: "/api/cron/daily-intel",
        unit: "intel_published",
        expectedMin: 1,
        getProduced: (value) => value.summary.successful,
        legitimatelyZero: (value) =>
          value.summary.processed === 0
            ? { reason: "No beaches with configured daily-intel preferences were eligible" }
            : undefined,
      },
      async () => ({
        summary: {
          maxBeaches,
          processed: results.length,
          successful,
          failed,
          durationMs: Date.now() - startMs,
        },
        results,
      }),
    );

    return createSuccessResponse(outcome);
  } catch (error) {
    return handleApiError(error, "Failed to run daily intel cron");
  }
}

export const GET = withObservedCron("/api/cron/daily-intel", _GET);
