import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseAndValidateJson } from "@/lib/validation/middleware";
import { addFeaturedPhotoToSession } from "@/actions/session-actions";
import {
  withAuth,
  validateUuidParam,
  requireOwnership,
  createErrorResponse,
  createSuccessResponse,
  validateOrError,
  methodNotAllowed,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

const WaveCharacteristicSchema = z.enum([
  "clean",
  "choppy",
  "glassy",
  "blown_out",
  "fat",
  "mushy",
  "peaky",
  "powerful",
  "closeouts",
  "barreling",
  "reform",
  "walled",
  "rights",
  "lefts",
  "steep",
]);

const SessionUpdateSchema = z
  .object({
    arrival_time: z
      .string()
      .datetime({ offset: true })
      .refine((value) => new Date(value).getTime() <= Date.now(), {
        message: "Session time cannot be in the future",
      })
      .optional(),
    duration_minutes: z.number().int().min(1).max(1440).optional(),
    board_id: z.string().uuid().nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
    is_public: z.boolean().optional(),
    rating: z.number().int().min(0).max(5).optional(),
    wave_height_ft: z.number().min(0).max(100).nullable().optional(),
    wave_characteristics: z
      .array(WaveCharacteristicSchema)
      .max(15)
      .nullable()
      .optional(),
    tide_height_ft: z.number().min(-20).max(30).nullable().optional(),
    tide_status: z.enum(["rising", "falling", "high", "low"]).nullable().optional(),
    rip_current_observed: z.enum(["none", "light", "strong"]).nullable().optional(),
    crowd_level: z.number().int().min(1).max(5).nullable().optional(),
  })
  .strict();

const WAVE_QUALITY_BY_CHARACTERISTIC: Partial<
  Record<z.infer<typeof WaveCharacteristicSchema>, number>
> = {
  blown_out: 1,
  choppy: 2,
  clean: 4,
  glassy: 5,
};

function deriveWaveQuality(
  characteristics: z.infer<typeof WaveCharacteristicSchema>[] | null
): number | null {
  if (!characteristics) return null;
  const qualityCharacteristic = characteristics.find(
    (characteristic) => WAVE_QUALITY_BY_CHARACTERISTIC[characteristic] !== undefined
  );
  return qualityCharacteristic
    ? WAVE_QUALITY_BY_CHARACTERISTIC[qualityCharacteristic] ?? null
    : null;
}

const SESSION_ROW_SELECT = `
  id,
  user_id,
  beach_id,
  beach_name,
  board_id,
  board_snapshot,
  arrival_time,
  created_at,
  duration_minutes,
  status,
  is_public,
  rating,
  wave_quality,
  crowd_level,
  parking_ease,
  description,
  notes,
  image_url,
  water_temp,
  wave_height_ft,
  wind_speed_mph,
  wind_direction,
  tide_status,
  tide_height_ft,
  tide_rate_ft_per_hr,
  tide_data_source,
  forecast_accuracy,
  goals,
  invitee_ids,
  comments_count,
  likes_count,
  share_count,
  muted,
  rip_current_observed,
  rip_current_risk,
  session_board_fit,
  session_decomposition,
  session_skill_fit,
  skill_ratings,
  source,
  wave_characteristics,
  custom_spot_id
`;

/**
 * PATCH /api/sessions/[id] - Update a session
 */
export const PATCH = withAuth(
  async (request: NextRequest, { user, supabase, params }: AuthenticatedContext) => {
    // Validate UUID
    const uuidResult = validateUuidParam(params.id, "session");
    if ("error" in uuidResult) return uuidResult.error;
    const sessionId = uuidResult.value;

    // Parse and validate request body
    const parseResult = await parseAndValidateJson(request);
    if ("error" in parseResult) return parseResult.error;

    const validation = validateOrError(SessionUpdateSchema, parseResult.data);
    if ("error" in validation) return validation.error;

    // Check ownership
    const ownership = await requireOwnership(supabase, "sessions", sessionId, user.id, "Session");
    if ("error" in ownership) return ownership.error;

    // Build update payload
    const updatePayload: Record<string, unknown> = {};
    if (validation.data.arrival_time !== undefined) {
      updatePayload.arrival_time = validation.data.arrival_time;
    }
    if (validation.data.duration_minutes !== undefined) {
      updatePayload.duration_minutes = validation.data.duration_minutes;
    }
    if (validation.data.notes !== undefined) updatePayload.notes = validation.data.notes;
    if (validation.data.is_public !== undefined) updatePayload.is_public = validation.data.is_public;
    if (validation.data.rating !== undefined) updatePayload.rating = validation.data.rating;
    if (validation.data.wave_height_ft !== undefined) {
      updatePayload.wave_height_ft = validation.data.wave_height_ft;
    }
    if (validation.data.wave_characteristics !== undefined) {
      updatePayload.wave_characteristics = validation.data.wave_characteristics;
      updatePayload.wave_quality = deriveWaveQuality(validation.data.wave_characteristics);
    }
    if (validation.data.tide_height_ft !== undefined) {
      updatePayload.tide_height_ft = validation.data.tide_height_ft;
    }
    if (validation.data.tide_status !== undefined) {
      updatePayload.tide_status = validation.data.tide_status;
    }
    if (validation.data.rip_current_observed !== undefined) {
      updatePayload.rip_current_observed = validation.data.rip_current_observed;
    }
    if (validation.data.crowd_level !== undefined) {
      updatePayload.crowd_level = validation.data.crowd_level;
    }

    if (validation.data.board_id !== undefined) {
      updatePayload.board_id = validation.data.board_id;
      updatePayload.board_snapshot = null;

      if (validation.data.board_id) {
        const { data: board, error: boardError } = await supabase
          .from("boards")
          .select("name, board_type, size, volume, dimensions")
          .eq("id", validation.data.board_id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (boardError) throw boardError;
        if (!board) {
          return createErrorResponse(
            "Board not found",
            "Choose a board from your quiver",
            400
          );
        }
        updatePayload.board_snapshot = board;
      }
    }

    const { data: updated, error: updateError } = await (supabase as any)
      .from("sessions")
      .update(updatePayload)
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .select(SESSION_ROW_SELECT)
      .single();

    if (updateError) throw updateError;

    return createSuccessResponse({ session: updated });
  },
  { errorMessage: "Failed to update session" }
);

/**
 * GET /api/sessions/[id] - Get a session by ID
 */
export const GET = withAuth(
  async (_request: NextRequest, { user, supabase, params }: AuthenticatedContext) => {
    // Validate UUID
    const uuidResult = validateUuidParam(params.id, "session");
    if ("error" in uuidResult) return uuidResult.error;
    const sessionId = uuidResult.value;

    // Check ownership
    const ownership = await requireOwnership(supabase, "sessions", sessionId, user.id, "Session");
    if ("error" in ownership) return ownership.error;

    const { data, error } = await (supabase as any)
      .from("sessions")
      .select(
        `
        ${SESSION_ROW_SELECT},
        session_date:arrival_time,
        beach:beaches(id, name, lat, lon),
        board:boards(id, name, board_type, dimensions, description, image_url, size, volume),
        user:profiles(id, full_name, avatar_url),
        forecast_snapshot:session_forecast_snapshots(
          forecast_snapshot,
          actual_conditions,
          forecast_vs_actual,
          forecast_confidence_score,
          data_source
        )
      `
      )
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (error) throw error;

    // Transform the forecast_snapshot array to a single object (it's 1:1 relationship)
    const sessionWithSnapshot = {
      ...data,
      forecast_snapshot: Array.isArray(data.forecast_snapshot) && data.forecast_snapshot.length > 0
        ? data.forecast_snapshot[0]
        : null,
    };

    const enriched = await addFeaturedPhotoToSession(supabase, sessionWithSnapshot);
    return createSuccessResponse({ session: enriched ?? sessionWithSnapshot });
  },
  { errorMessage: "Failed to load session" }
);

export function POST() {
  return methodNotAllowed(["GET", "PATCH", "DELETE"]);
}

export function PUT() {
  return methodNotAllowed(["GET", "PATCH", "DELETE"]);
}

/**
 * DELETE /api/sessions/[id] - Delete a session
 */
export const DELETE = withAuth(
  async (_request: NextRequest, { user, supabase, params }: AuthenticatedContext) => {
    // Validate UUID
    const uuidResult = validateUuidParam(params.id, "session");
    if ("error" in uuidResult) return uuidResult.error;
    const sessionId = uuidResult.value;

    // Check ownership
    const ownership = await requireOwnership(supabase, "sessions", sessionId, user.id, "Session");
    if ("error" in ownership) return ownership.error;

    const { error } = await supabase
      .from("sessions")
      .delete()
      .eq("id", sessionId)
      .eq("user_id", user.id);

    if (error) throw error;

    return createSuccessResponse({ deleted: true });
  },
  { errorMessage: "Failed to delete session" }
);
