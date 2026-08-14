import { createHash } from "node:crypto";
import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { withCronOutcome } from "@/lib/cron/outcome";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { SupabaseServiceClient } from "@/types/supabase";
import {
  areSystemCardsEnabled,
  MAX_SYSTEM_CARDS_PER_DAY,
  SYSTEM_VOICE_LABEL,
  TARGET_SYSTEM_CARDS_PER_DAY,
} from "@/lib/npc/system-card-config";
import {
  buildSystemCardCopy,
  fetchLatestSystemForecast,
  type SystemCardCandidate,
} from "@/lib/npc/system-cards";
import { planSystemCardClasses } from "@/lib/npc/system-card-types";
import { selectSystemCardCandidates } from "@/lib/npc/system-card-selection";
import { fetchBeachTrafficWeights } from "@/lib/npc/traffic-weights";
import { isSystemCardBlocked, type SystemCardDedupeRecord } from "@/lib/npc/post-quality";
import { insertSystemFeedPost } from "@/lib/npc/system-feed-posts";
import { resolveSystemIdentity } from "@/lib/system-identity";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SystemCardHistoryRow {
  beach_id: string | null;
  title: string | null;
  description: string | null;
  created_at: string;
  dedupe_hash: string | null;
  surf_conditions: unknown;
}

async function _GET(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) {
    return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
  }

  try {
    const payload = await withCronOutcome(
      {
        job: "/api/cron/system-cards",
        unit: "cards_published",
        expectedMin: 1,
        getProduced: (result) => result.summary.successful,
        legitimatelyZero: (result) =>
          ("paused" in result.summary && result.summary.paused === true)
            ? { reason: "QUIVER_SYSTEM_CARDS_ENABLED=false" }
            : undefined,
      },
      async () => {
        if (!areSystemCardsEnabled()) {
          return {
            summary: { paused: true, reason: "QUIVER_SYSTEM_CARDS_ENABLED=false", successful: 0 },
            results: [],
          };
        }

        const startedAt = Date.now();
        const supabase = await createSupabaseServiceRoleClient();
        const now = new Date();
        const systemProfileId = await resolveSystemIdentity(supabase);

        const history = await fetchSystemCardHistory(supabase, now);
        const cardsToday = history.filter((row) => isSameUtcDay(row.created_at, now)).length;
        if (cardsToday >= MAX_SYSTEM_CARDS_PER_DAY || cardsToday >= TARGET_SYSTEM_CARDS_PER_DAY) {
          return {
            summary: {
              paused: false,
              cardsToday,
              target: TARGET_SYSTEM_CARDS_PER_DAY,
              hardCeiling: MAX_SYSTEM_CARDS_PER_DAY,
              successful: 0,
              durationMs: Date.now() - startedAt,
            },
            results: [],
          };
        }

        const candidates = await fetchSystemCardCandidates(supabase);
        const trafficWeights = await fetchBeachTrafficWeights(
          supabase,
          candidates.map((candidate) => candidate.id),
        );
        const weightByBeach = new Map(
          (trafficWeights ?? []).map((weight) => [weight.beachId.toLowerCase(), weight]),
        );
        const weightedCandidates = candidates.map((candidate) => {
          const weight = weightByBeach.get(candidate.id.toLowerCase());
          return {
            ...candidate,
            marketKey: weight?.marketKey || candidate.marketKey,
            allocationTier: weight?.allocationTier ?? (trafficWeights ? "exploration" : "proven"),
            trafficWeight: weight?.weight ?? 1,
          } satisfies SystemCardCandidate;
        });

        const contentClass = planSystemCardClasses(1, history.length)[0];
        const [planned] = await selectSystemCardCandidates({
          candidates: weightedCandidates,
          contentClasses: [contentClass],
          history: history.flatMap(toSelectionRecord),
          asOf: now,
          sequenceOffset: history.length,
        });
        if (!planned) {
          return {
            summary: { cardsToday, successful: 0, skipped: "no_safe_candidate", durationMs: Date.now() - startedAt },
            results: [],
          };
        }

        const forecast = await fetchLatestSystemForecast(supabase, planned.candidate.id);
        if (!forecast) {
          return {
            summary: { cardsToday, successful: 0, skipped: "no_forecast_data", durationMs: Date.now() - startedAt },
            results: [],
          };
        }

        const copy = buildSystemCardCopy({
          candidate: planned.candidate,
          forecast,
          contentClass: planned.contentClass,
        });
        const dedupeCandidate: SystemCardDedupeRecord = {
          beachId: planned.candidate.id,
          contentClass: copy.contentClass,
          title: copy.title,
          description: copy.description,
          semanticClaim: copy.semanticClaim,
          createdAt: now.toISOString(),
        };
        const dedupeHistory = history.flatMap(toDedupeRecord);
        const sentenceHash = hashSentence(copy.description);
        if (isSystemCardBlocked(dedupeCandidate, dedupeHistory, now)) {
          return {
            summary: { cardsToday, successful: 0, skipped: "duplicate", durationMs: Date.now() - startedAt },
            results: [],
          };
        }

        const post = await insertSystemFeedPost(supabase, {
          userId: systemProfileId,
          beachId: planned.candidate.id,
          latitude: planned.candidate.lat,
          longitude: planned.candidate.lon,
          title: copy.title,
          description: copy.description,
          dedupeHash: sentenceHash,
          surfConditions: copy.surfConditions as unknown as import("@/types/database").Json,
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          createdAt: now.toISOString(),
        });
        if (post.status !== "inserted") {
          return {
            summary: {
              cardsToday,
              successful: 0,
              skipped: post.status,
              durationMs: Date.now() - startedAt,
            },
            results: [],
          };
        }

        return {
          summary: {
            cardsToday: cardsToday + 1,
            target: TARGET_SYSTEM_CARDS_PER_DAY,
            hardCeiling: MAX_SYSTEM_CARDS_PER_DAY,
            successful: 1,
            durationMs: Date.now() - startedAt,
          },
          results: [{
            postId: post.postId,
            voice: SYSTEM_VOICE_LABEL,
            beachId: planned.candidate.id,
            contentClass: copy.contentClass,
            prompt: copy.prompt,
          }],
        };
      },
    );
    return createSuccessResponse(payload);
  } catch (error) {
    return handleApiError(error, "Failed to generate Quiver Forecast system card");
  }
}

export const GET = _GET;

async function fetchSystemCardHistory(
  supabase: SupabaseServiceClient,
  asOf: Date,
): Promise<SystemCardHistoryRow[]> {
  const { data, error } = await supabase
    .from("intel_posts")
    .select(
      "beach_id, title, description, created_at, dedupe_hash, surf_conditions, profiles!intel_posts_user_id_fkey!inner(is_system_account)",
    )
    .eq("profiles.is_system_account", true)
    .gte("created_at", new Date(asOf.getTime() - 14 * 86400000).toISOString())
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as SystemCardHistoryRow[];
}

async function fetchSystemCardCandidates(
  supabase: SupabaseServiceClient,
): Promise<SystemCardCandidate[]> {
  const { data, error } = await supabase
    .from("beaches")
    .select("id, name, city, state, lat, lon")
    .not("lat", "is", null)
    .not("lon", "is", null)
    .limit(5000);
  if (error) throw error;

  return (data ?? []).flatMap((row) => {
    if (
      typeof row.id !== "string" ||
      typeof row.name !== "string" ||
      typeof row.lat !== "number" ||
      typeof row.lon !== "number"
    ) return [];
    return [{
      id: row.id,
      name: row.name,
      lat: row.lat,
      lon: row.lon,
      marketKey: `${normalize(row.state)}:${normalize(row.city)}`,
      allocationTier: "proven" as const,
      trafficWeight: 1,
    }];
  });
}

function toSelectionRecord(row: SystemCardHistoryRow): SystemCardSelectionRecord[] {
  if (!row.beach_id) return [];
  const metadata = asRecord(row.surf_conditions);
  const contentClass = metadata?.content_class;
  return [{
    beachId: row.beach_id,
    contentClass: isSystemCardClass(contentClass) ? contentClass : "legacy",
    createdAt: row.created_at,
  }];
}

function toDedupeRecord(row: SystemCardHistoryRow): SystemCardDedupeRecord[] {
  if (!row.beach_id) return [];
  const metadata = asRecord(row.surf_conditions);
  return [{
    beachId: row.beach_id,
    title: row.title,
    description: row.description,
    contentClass: typeof metadata?.content_class === "string" ? metadata.content_class : "legacy",
    semanticClaim: typeof metadata?.semantic_claim === "string" ? metadata.semantic_claim : null,
    createdAt: row.created_at,
  }];
}

function isSameUtcDay(value: string, asOf: Date): boolean {
  return value.slice(0, 10) === asOf.toISOString().slice(0, 10);
}

function hashSentence(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function normalize(value: string | null): string {
  return (value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isSystemCardClass(value: unknown): value is SystemCardClass {
  return value === "forecast_summary" || value === "wind_read" || value === "water_temperature" || value === "prompt" || value === "correction_request" || value === "forecast_vs_observation";
}

type SystemCardSelectionRecord = import("@/lib/npc/system-card-selection").SystemCardSelectionRecord;
type SystemCardClass = import("@/lib/npc/system-card-types").SystemCardClass;
