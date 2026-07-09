import type { SessionWithDetails, Session } from "@/types/database";
import type { SessionFormState } from "@/hooks/use-session-form";
import { normalizeSessionDecomposition } from "@/lib/session-fit";
import { getStaticMapImageUrl, resolveBeachCoordinates } from "@/lib/map-utils";

type SessionWithWaveCharacteristics = Partial<Session> & {
  wave_characteristics?: string[] | null;
  rip_current_observed?: string | null;
};

// Helper function to format session description with additional details
export const formatSessionDescription = (session: SessionWithDetails) => {
  const parts = [];

  // Add notes if available
  if (session.notes) {
    parts.push(session.notes);
  }

  // Add wave conditions
  const conditions = [];
  if (session.wave_height_ft) {
    conditions.push(`Wave Height: ${session.wave_height_ft}ft`);
  }
  if (session.water_temp) {
    conditions.push(`Water Temp: ${session.water_temp}`);
  }
  if (session.wave_quality) {
    conditions.push(`Wave Quality: ${session.wave_quality}/5`);
  }
  if (session.crowd_level) {
    conditions.push(`Crowd Level: ${session.crowd_level}/5`);
  }

  if (conditions.length > 0) {
    parts.push(`Conditions: ${conditions.join(", ")}`);
  }

  // Add goals if available
  if (session.goals && session.goals.length > 0) {
    parts.push(`Goals: ${session.goals.join(", ")}`);
  }

  // Add duration if available
  if (session.duration_minutes) {
    const hours = Math.floor(session.duration_minutes / 60);
    const minutes = session.duration_minutes % 60;
    const durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    parts.push(`Duration: ${durationStr}`);
  }

  return parts.length > 0 ? parts.join(" • ") : "No description provided.";
};

// Helper function to format date consistently
export const formatSessionDate = (session: SessionWithDetails) => {
  const date = session.arrival_time ? new Date(session.arrival_time) : null;

  if (!date) return "No date set";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Helper function to get session map image URL
export const getSessionMapImageUrl = (session: SessionWithDetails) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Session map image generation:', { 
      sessionId: session.id, 
      beachId: session.beach_id,
      beachName: session.beach?.name || session.beach_name,
      hasBeach: !!session.beach,
      beachCoords: session.beach ? { lat: session.beach.lat, lng: session.beach.lon } : null
    });
  }
  
  // Get beach coordinates using the unified resolution function
  const coords = session.beach ? resolveBeachCoordinates(session.beach) : null;
  const beachName = session.beach?.name || session.beach_name;

  // If no coordinates from beach object, try beach_name fallback
  if (!coords && beachName) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`No coordinates for beach: ${beachName}, trying hardcoded fallback`);
    }
    
    // Use hardcoded coordinates for known beaches if available
    try {
      const { beachCoordinates } = require("@/lib/constants/beach-coordinates");
      const beachNameLower = beachName?.toLowerCase().trim();
      const hardcodedCoords = beachNameLower ? beachCoordinates[beachNameLower] : null;
      
      if (hardcodedCoords) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Found hardcoded coordinates for ${beachName}:`, hardcodedCoords);
        }
        return getStaticMapImageUrl(hardcodedCoords.lat, hardcodedCoords.lng, {
          width: 500,
          height: 350,
          zoom: 12,
        });
      }
    } catch (error) {
      console.warn("Could not load hardcoded beach coordinates:", error);
    }
  }

  // Generate the map image URL with coordinates or fallback
  // If we have coordinates: don't pass markerText (so we get real Mapbox maps)
  // If we don't have coordinates: pass beach name so it shows in placeholder
  const mapUrl = getStaticMapImageUrl(coords?.latitude, coords?.longitude, {
    width: 500,
    height: 350,
    zoom: 12,
    markerText: coords ? undefined : (beachName ?? undefined),
  });
  
  if (process.env.NODE_ENV === 'development') {
    console.log('Generated map URL:', mapUrl);
  }
  return mapUrl;
};

/**
 * Transform SessionFormState to database-compatible session data
 * Converts camelCase form field names to snake_case database column names
 */
export function transformSessionFormStateToDbSchema(
  formState: SessionFormState
): Partial<Session> {
  const dbData: SessionWithWaveCharacteristics & Record<string, unknown> = {};

  // Map camelCase form fields to snake_case database columns
  if (formState.selectedBeachId) {
    dbData.beach_id = formState.selectedBeachId;
  }

  if (formState.boardId) {
    dbData.board_id = formState.boardId;
  }

  // Handle beach name (from selectedBeach when no ID is available)
  if (formState.selectedBeach && !formState.selectedBeachId) {
    dbData.beach_name = formState.selectedBeach;
  }

  // Combine date and time into arrival_time
  if (formState.selectedDate) {
    let arrivalTime = formState.selectedDate;

    // If time is provided, combine it with date
    if (formState.selectedTime) {
      // selectedTime is in format "HH:MM"
      arrivalTime += `T${formState.selectedTime}:00.000Z`;
    } else {
      // Default to midnight if no time specified
      arrivalTime += `T00:00:00.000Z`;
    }

    dbData.arrival_time = arrivalTime;
  }

  // Handle duration (convert from "60m" format to minutes)
  if (formState.duration) {
    const durationStr = formState.duration.toLowerCase();
    if (durationStr.endsWith('m')) {
      const minutes = parseInt(durationStr.replace('m', ''), 10);
      if (!isNaN(minutes)) {
        dbData.duration_minutes = minutes;
      }
    } else if (durationStr.endsWith('h')) {
      const hours = parseInt(durationStr.replace('h', ''), 10);
      if (!isNaN(hours)) {
        dbData.duration_minutes = hours * 60;
      }
    }
  }

  // Handle rating fields
  if (formState.waveQuality) {
    const waveQuality = parseInt(formState.waveQuality, 10);
    if (!isNaN(waveQuality)) {
      dbData.wave_quality = waveQuality;
    }
  }

  if (formState.crowdLevel) {
    const crowdLevel = parseInt(formState.crowdLevel, 10);
    if (!isNaN(crowdLevel)) {
      dbData.crowd_level = crowdLevel;
    }
  }

  if (formState.parkingEase) {
    const parkingEase = parseInt(formState.parkingEase, 10);
    if (!isNaN(parkingEase)) {
      dbData.parking_ease = parkingEase;
    }
  }

  if (formState.overallRating) {
    const rating = parseInt(formState.overallRating, 10);
    if (!isNaN(rating)) {
      dbData.rating = rating;
    }
  }

  // Handle text fields
  if (formState.waterTemp) {
    const waterTemp = parseFloat(formState.waterTemp);
    if (!isNaN(waterTemp)) {
      dbData.water_temp = waterTemp;
    }
  }

  if (formState.notes) {
    dbData.notes = formState.notes;
  }

  // NEW FIELDS: Handle wave conditions data
  if (formState.waveHeight !== undefined) {
    dbData.wave_height_ft = formState.waveHeight;
  }

  if (formState.windSpeed !== undefined) {
    dbData.wind_speed_mph = formState.windSpeed;
  }

  if (formState.windDirection) {
    dbData.wind_direction = formState.windDirection;
  }

  if (formState.forecastAccuracy) {
    dbData.forecast_accuracy = formState.forecastAccuracy;
  }

  if (formState.recommendationId) {
    dbData.recommendation_id = formState.recommendationId;
  }

  if (formState.recommendationCallAccuracy) {
    dbData.recommendation_call_accuracy = formState.recommendationCallAccuracy;
  }

  if (formState.recommendationId && formState.forecastWaveHeightFt !== undefined) {
    dbData.forecast_wave_height_ft = formState.forecastWaveHeightFt;
    dbData.wave_height_correct = formState.waveHeightEdited === true ? false : true;
  }

  if (formState.recommendationId && formState.forecastTideStatus) {
    dbData.forecast_tide_status = formState.forecastTideStatus;
    dbData.tide_status_correct = formState.tideStatusEdited === true ? false : true;
  }

  // NEW FIELDS: Handle tide data
  if (!formState.recommendationId && formState.tideHeight !== undefined) {
    dbData.tide_height_ft = formState.tideHeight;
  }

  if (formState.tideStatus) {
    dbData.tide_status = formState.tideStatus;
  }

  if (formState.ripCurrentObserved) {
    dbData.rip_current_observed = formState.ripCurrentObserved;
  }

  dbData.session_decomposition = normalizeSessionDecomposition(
    formState.sessionDecomposition
  ) as unknown as Session["session_decomposition"];

  const waveCharacteristics =
    formState.waveCharacteristics?.length > 0
      ? formState.waveCharacteristics
      : formState.waveTypes?.length > 0
        ? formState.waveTypes
        : null;

  if (waveCharacteristics) {
    dbData.wave_characteristics = waveCharacteristics;
  }

  // Visibility and feed controls
  dbData.is_public = formState.isPublic ?? true;
  dbData.muted = formState.isMuted ?? false;

  // Clean up undefined/empty values
  const cleaned: Partial<Session> = {};
  for (const [key, value] of Object.entries(dbData)) {
    if (key === "session_decomposition" && value === null) {
      (cleaned as any)[key] = value;
      continue;
    }
    if (value !== undefined && value !== null && value !== "") {
      (cleaned as any)[key] = value;
    }
  }

  return cleaned;
}

/**
 * Sanitize session data payload for database insertion
 * This is a more comprehensive version of the existing sanitizePayload function
 */
export function sanitizeSessionPayload<T extends Record<string, any>>(input: T): T {
  const cleaned: Record<string, any> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === "$undefined") continue;

    if ((key === "board_id" || key === "beach_id") && value === "") continue;

    cleaned[key] = value;
  }

  return cleaned as T;
}

/**
 * Transform database Session to SessionFormState for editing
 * Converts snake_case database column names to camelCase form field names
 */
export function sessionToFormState(session: any): any {
  // Helper to format duration minutes back to string format
  const formatDuration = (minutes: number): string => {
    if (!minutes) return "60m"; // Default 1 hour
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  return {
    // Location
    selectedBeach: session.beach_name || "",
    selectedBeachId: session.beach_id || undefined,

    // Date & Time
    selectedDate: session.arrival_time ? session.arrival_time.split("T")[0] : "",
    selectedTime: session.arrival_time
      ? session.arrival_time.split("T")[1]?.substring(0, 5) || ""
      : "",

    // Equipment
    selectedBoard: "", // Will be populated from board data if needed
    boardId: session.board_id || undefined,

    // Duration
    duration: formatDuration(session.duration_minutes),

    // Wave conditions
    waveHeight: session.wave_height_ft || undefined,
    waveQuality: session.wave_quality?.toString() || "",
    waveCharacteristics: session.wave_characteristics || [],
    waveTypes: session.wave_characteristics || [],

    // Environmental conditions (NEW FIELDS)
    windSpeed: session.wind_speed_mph || undefined,
    windDirection: session.wind_direction || undefined,
    waterTemp: session.water_temp?.toString() || "",

    // Tide conditions (NEW FIELDS)
    tideHeight: session.tide_height_ft || undefined,
    tideStatus: session.tide_status || undefined,
    ripCurrentObserved: session.rip_current_observed || undefined,

    // Experience ratings
    crowdLevel: session.crowd_level?.toString() || "",
    parkingEase: session.parking_ease?.toString() || "",
    overallRating: session.rating?.toString() || "",

    // Forecast accuracy (NEW FIELD)
    forecastAccuracy: session.forecast_accuracy || undefined,

    sessionDecomposition: session.session_decomposition || null,

    // Notes
    notes: session.notes || "",

    // Visibility
    isPublic: session.is_public ?? true,
    isMuted: session.muted ?? false,

    // Photos (empty array for now - photos are handled separately)
    photos: [],
  };
}
