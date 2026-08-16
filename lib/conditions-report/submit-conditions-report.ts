import type { User } from "@supabase/supabase-js";
import type { ActionResult } from "@/lib/action-utils";
import { emitSessionCreatedEvent } from "@/lib/analytics/session-created";
import type { SupabaseServerClient } from "@/types/supabase";
import { submitForecastFeedback } from "@/lib/forecast-feedback/submit-feedback";
import type {
  ConditionsReportInput,
  WaveSizeRange,
  Vibe,
} from "@/types/conditions-report";
import {
  buildConditionsContent,
  WAVE_SIZE_OPTIONS,
  VIBE_OPTIONS,
} from "@/types/conditions-report";

export interface SubmitConditionsReportInput extends ConditionsReportInput {
  photoStoragePath?: string;
}

export interface SubmitConditionsReportData {
  intelPostId: string;
  sessionId: string | null;
  expiresAt: string;
}

const VALID_WAVE_SIZES = new Set<string>(WAVE_SIZE_OPTIONS.map((o) => o.value));
const VALID_VIBES = new Set<string>(VIBE_OPTIONS.map((o) => o.value));
const NOTE_MAX_LENGTH = 280;

function waveSizeMidpoint(waveSizeRange: WaveSizeRange): number | null {
  const option = WAVE_SIZE_OPTIONS.find(({ value }) => value === waveSizeRange);
  const match = option?.value.match(/^(\d+)(?:-(\d+)|\+)?ft$/);
  if (!match) return null;

  const min = Number(match[1]);
  const max = match[2] ? Number(match[2]) : min + 1;
  return (min + max) / 2;
}

function validateInput(input: SubmitConditionsReportInput): string | null {
  if (!input.beachId?.trim()) return "Beach ID is required";
  if (!VALID_WAVE_SIZES.has(input.waveSizeRange)) {
    return "Invalid wave size selection";
  }
  if (!VALID_VIBES.has(input.vibe)) return "Invalid vibe selection";
  if (input.note && input.note.length > NOTE_MAX_LENGTH) {
    return `Note must be ${NOTE_MAX_LENGTH} characters or fewer`;
  }
  return null;
}

/** Shared submission logic used by the web action and native API route. */
export async function submitConditionsReportCore(
  input: SubmitConditionsReportInput,
  user: User,
  supabase: SupabaseServerClient,
): Promise<ActionResult<SubmitConditionsReportData>> {
  const validationError = validateInput(input);
  if (validationError) return { success: false, error: validationError };

  const { beachId, waveSizeRange, vibe, note, photoStoragePath } = input;
  const trimmedNote = note?.trim() || null;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data: existing, error: dupCheckError } = await supabase
    .from("intel_posts")
    .select("id")
    .eq("user_id", user.id)
    .eq("beach_id", beachId)
    .not("wave_size_range", "is", null)
    .gte("created_at", todayStart.toISOString())
    .limit(1);

  if (dupCheckError) {
    console.error("[submitConditionsReport] Dedup check failed:", dupCheckError);
  } else if (existing && existing.length > 0) {
    return { success: false, error: "ALREADY_REPORTED_TODAY" };
  }

  const content = buildConditionsContent(
    waveSizeRange as WaveSizeRange,
    vibe as Vibe,
    trimmedNote ?? undefined,
  );

  const { data: beach, error: beachError } = await supabase
    .from("beaches")
    .select("lat, lon, name")
    .eq("id", beachId)
    .single();

  if (beachError || !beach) {
    console.error("[submitConditionsReport] Beach lookup failed:", beachError);
    return { success: false, error: "Beach not found" };
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: intelPost, error: intelError } = await supabase
    .from("intel_posts")
    .insert({
      user_id: user.id,
      beach_id: beachId,
      latitude: beach.lat ?? 0,
      longitude: beach.lon ?? 0,
      tag: "conditions" as const,
      title: `${waveSizeRange}, ${vibe}`,
      description: content,
      wave_size_range: waveSizeRange,
      vibe,
      is_active: true,
      expires_at: expiresAt,
      // Photo URLs are supplied by the existing intel upload flow; this path
      // is persisted for later resolution and photo_url remains null here.
      photo_storage_path: photoStoragePath ?? null,
      photo_url: null,
    })
    .select("id")
    .single();

  if (intelError || !intelPost) {
    console.error("[submitConditionsReport] Intel post insert failed:", intelError);
    return { success: false, error: "Failed to submit conditions report" };
  }

  const forecastAt = new Date();
  forecastAt.setUTCMinutes(0, 0, 0);
  const observedFaceHeightFt = waveSizeMidpoint(waveSizeRange as WaveSizeRange);

  void (async () => {
    try {
      const feedbackResult = await submitForecastFeedback(
        { user, supabase },
        {
          beachId,
          forecastAt: forecastAt.toISOString(),
          windowStart: null,
          windowEnd: null,
          issuedAt: null,
          predictedAt: null,
          forecastHorizonHours: null,
          feedbackKind: "condition_report",
          feedbackValue: waveSizeRange,
          feedbackNote: note ?? null,
          observedFaceHeightFt,
          displayedContext: {
            source: "conditions_report",
            waveSizeRange,
            vibe,
          },
          sourceModelContext: {},
          calibrationContext: {},
          surfCallContext: {},
          missingFlags: {},
          auditMetadata: {},
          clientSource: "quiver-web",
          clientVersion: null,
          sessionId: null,
          anonymousClientId: null,
          correlationId: null,
          requestId: null,
          extraContext: null,
        },
        {
          ingestPath: "quiver-web/conditions-report",
          requireForecast: true,
        },
      );

      if (!feedbackResult.success) {
        console.warn("[submitConditionsReport] Forecast feedback skipped", {
          beachId,
          forecastAt: forecastAt.toISOString(),
          reason: feedbackResult.reason,
          feedbackKind: "condition_report",
        });
      }
    } catch (error) {
      console.warn("[submitConditionsReport] Forecast feedback failed", {
        beachId,
        forecastAt: forecastAt.toISOString(),
        reason: "unexpected_forwarding_error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();

  void (async () => {
    const { error: evtErr } = await supabase.from("user_events").insert({
      user_id: user.id,
      event_type: "intel_post_created",
      beach_id: beachId,
      metadata: {
        source: "web-conditions-report",
        wave_size_range: waveSizeRange,
        vibe,
        intel_post_id: intelPost.id,
      },
    });
    if (evtErr) console.warn("[submitConditionsReport] user_events intel insert failed:", evtErr);
  })();

  let sessionId: string | null = null;
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      beach_id: beachId,
      beach_name: beach.name,
      arrival_time: new Date().toISOString(),
      status: "completed",
      source: "conditions_report",
      // Conditions reports are public content; their hidden session must be
      // public so approved report videos satisfy the public media RLS arm.
      is_public: true,
      notes: content,
      duration_minutes: 0,
      wave_height_ft: observedFaceHeightFt,
    })
    .select("id")
    .single();

  if (sessionError) {
    console.warn("[submitConditionsReport] Session insert failed (non-fatal):", sessionError);
  } else {
    const createdSessionId = session?.id ?? null;
    sessionId = createdSessionId;
    if (createdSessionId) {
      try {
        const { error: linkageError } = await (supabase.from("intel_posts") as any)
          .update({ session_id: createdSessionId })
          .eq("id", intelPost.id);
        if (linkageError) {
          console.warn("[submitConditionsReport] Intel/session linkage failed (non-fatal):", linkageError);
          sessionId = null;
        }
      } catch (error) {
        console.warn("[submitConditionsReport] Intel/session linkage threw (non-fatal):", error);
        sessionId = null;
      }
    }
    if (createdSessionId) {
      await emitSessionCreatedEvent(supabase, {
        userId: user.id,
        session: { id: createdSessionId, beach_id: beachId },
        source: "web-conditions-report",
        surface: "conditions-report",
      });
    }
  }

  return {
    success: true,
    data: { intelPostId: intelPost.id, sessionId, expiresAt },
  };
}
