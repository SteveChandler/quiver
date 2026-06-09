import {
  normalizeSessionDecomposition,
  type SessionDecomposition,
} from "@/lib/session-fit";

/**
 * Shared session data builder — single source of truth for mapping form state
 * to the database payload shape used by createLoggedSession.
 *
 * CRITICAL: useSessionSubmission.ts MUST use this builder to keep the 6
 * condition fields in sync.
 *
 * Condition fields:
 *   wave_height_ft, wind_speed_mph, wind_direction,
 *   tide_height_ft, tide_status, forecast_accuracy
 */

/** Input shape accepted by the builder — matches SessionFormState field names. */
export interface SessionPayloadInput {
  // Core fields
  selectedBeach: string;
  selectedBeachId?: string;
  selectedDate?: string;
  selectedTime?: string;
  boardId?: string;
  notes?: string;

  // Duration (raw string like "2h30m")
  duration?: string;

  // Rating / quality fields
  waveQuality?: string;
  waterTemp?: string;
  crowdLevel?: string;
  parkingEase?: string;
  overallRating?: string;

  // 6 Condition fields (SAFETY-CRITICAL — keep in sync)
  waveHeight?: number;
  windSpeed?: number;
  windDirection?: string;
  tideHeight?: number;
  tideStatus?: string;
  forecastAccuracy?: "accurate" | "somewhat" | "inaccurate" | string;

  // Goals and skill ratings
  selectedGoals?: string[];
  skillRatings?: Record<string, number>;
  sessionDecomposition?: SessionDecomposition | null;

  // Visibility and feed controls
  isPublic?: boolean;
  isMuted?: boolean;
}

/** The shape sent to createLoggedSession server actions. */
export interface SessionPayload {
  beach_name: string;
  beach_id?: string;
  arrival_time?: string;
  board_id?: string;
  user_id: string;
  notes?: string;
  status: "completed";

  // Duration
  duration_minutes?: number;

  // Rating / quality fields
  wave_quality?: number;
  water_temp?: number;
  crowd_level?: number;
  parking_ease?: number;
  rating?: number;

  // 6 Condition fields
  wave_height_ft?: number;
  wind_speed_mph?: number;
  wind_direction?: string;
  tide_height_ft?: number;
  tide_status?: string;
  forecast_accuracy?: string;

  // Goals and skill ratings
  goals?: string[];
  skill_ratings?: Record<string, number>;
  session_decomposition: SessionDecomposition | null;

  // Visibility and feed controls
  is_public?: boolean;
  muted?: boolean;
}

/**
 * Parse a duration string like "2h30m" or "60m" into minutes.
 */
export function parseDurationToMinutes(
  duration: string | undefined
): number | undefined {
  if (!duration) return undefined;
  const hourMatch = duration.match(/(\d+)h/);
  const minuteMatch = duration.match(/(\d+)m/);
  const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
  const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;
  return hours * 60 + minutes;
}

/**
 * Combine date and time strings into a PostgreSQL timestamp string.
 */
export function combineDateAndTime(
  date?: string,
  time?: string
): string | undefined {
  if (!date) return undefined;

  if (date && time) {
    const dateTimeString = `${date}T${time}:00`;
    const dateTime = new Date(dateTimeString);
    return dateTime
      .toISOString()
      .replace("T", " ")
      .replace(/\.\d{3}Z$/, "+00");
  }

  const dateTime = new Date(`${date}T00:00:00`);
  return dateTime
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, "+00");
}

/**
 * Parse water temp string to a validated number or null.
 */
function parseWaterTemp(raw?: string): number | null {
  if (!raw || raw.trim().length === 0) return null;
  const parsed = Number.parseFloat(raw);
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

/**
 * Build the session payload for creating a logged session.
 *
 * @param input  - Form state fields (from SessionFormState or wizard sessionData)
 * @param userId - Authenticated user ID
 * @param arrivalTimeOverride - Optional pre-computed arrival time (if caller already combined date+time)
 */
export function buildSessionPayload(
  input: SessionPayloadInput,
  userId: string,
  arrivalTimeOverride?: string
): SessionPayload {
  const arrivalTime =
    arrivalTimeOverride ??
    combineDateAndTime(input.selectedDate, input.selectedTime);

  const base: SessionPayload = {
    beach_name: input.selectedBeach,
    beach_id: input.selectedBeachId,
    arrival_time: arrivalTime,
    board_id: input.boardId,
    user_id: userId,
    notes: input.notes || undefined,
    status: "completed",
    is_public: input.isPublic ?? true,
    muted: input.isMuted ?? false,
    session_decomposition: normalizeSessionDecomposition(input.sessionDecomposition),
  };

  // Add duration, ratings, and the 6 condition fields.
  const durationMinutes = parseDurationToMinutes(input.duration);
  const parsedWaterTemp = parseWaterTemp(input.waterTemp);

  return {
    ...base,
    // Duration
    ...(durationMinutes !== undefined && {
      duration_minutes: durationMinutes,
    }),
    // Rating / quality fields
    ...(input.waveQuality && {
      wave_quality: parseInt(input.waveQuality),
    }),
    ...(parsedWaterTemp !== null && {
      water_temp: parsedWaterTemp,
    }),
    ...(input.crowdLevel && {
      crowd_level: parseInt(input.crowdLevel),
    }),
    ...(input.parkingEase && {
      parking_ease: parseInt(input.parkingEase),
    }),
    ...(input.overallRating && {
      rating: parseInt(input.overallRating),
    }),
    // 6 Condition fields (SAFETY-CRITICAL)
    ...(input.waveHeight !== undefined && {
      wave_height_ft: input.waveHeight,
    }),
    ...(input.windSpeed !== undefined && {
      wind_speed_mph: input.windSpeed,
    }),
    ...(input.windDirection && {
      wind_direction: input.windDirection,
    }),
    ...(input.tideHeight !== undefined && {
      tide_height_ft: input.tideHeight,
    }),
    ...(input.tideStatus && {
      tide_status: input.tideStatus,
    }),
    ...(input.forecastAccuracy && {
      forecast_accuracy: input.forecastAccuracy,
    }),
    // Goals and skill ratings
    ...(input.selectedGoals && input.selectedGoals.length > 0 && {
      goals: input.selectedGoals,
    }),
    ...(input.skillRatings && Object.keys(input.skillRatings).length > 0 && {
      skill_ratings: input.skillRatings,
    }),
  };
}
