import type { SessionWithDetails, Session } from "@/types/database";
import type { SessionFormState } from "@/hooks/use-session-form";
import { getStaticMapImageUrl, resolveBeachCoordinates } from "@/lib/map-utils";

// Helper function to format session description with additional details
export const formatSessionDescription = (session: SessionWithDetails) => {
  const parts = [];

  // Add notes if available
  if (session.notes) {
    parts.push(session.notes);
  }

  // Add wave conditions
  const conditions = [];
  if (session.wave_height) {
    conditions.push(`Wave Height: ${session.wave_height}`);
  }
  if (session.water_temp) {
    conditions.push(`Water Temp: ${session.water_temp}`);
  }
  if (session.wave_quality) {
    conditions.push(`Wave Quality: ${session.wave_quality}/5`);
  }
  if (session.crowd_rating) {
    conditions.push(`Crowd Level: ${session.crowd_rating}/5`);
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
  console.log('Session map image generation:', { 
    sessionId: session.id, 
    beachId: session.beach_id,
    beachName: session.beach?.name || session.beach_name,
    hasBeach: !!session.beach,
    beachCoords: session.beach ? { lat: session.beach.latitude, lng: session.beach.longitude } : null
  });
  
  // Get beach coordinates using the unified resolution function
  const coords = session.beach ? resolveBeachCoordinates(session.beach) : null;

  // If no coordinates from beach object, try beach_name fallback
  if (!coords && (session.beach?.name || session.beach_name)) {
    const beachName = session.beach?.name || session.beach_name;
    console.log(`No coordinates for beach: ${beachName}, trying hardcoded fallback`);
    
    // Use hardcoded coordinates for known beaches if available
    try {
      const { beachCoordinates } = require("@/lib/constants/beach-coordinates");
      const beachNameLower = beachName?.toLowerCase().trim();
      const hardcodedCoords = beachNameLower ? beachCoordinates[beachNameLower] : null;
      
      if (hardcodedCoords) {
        console.log(`Found hardcoded coordinates for ${beachName}:`, hardcodedCoords);
        return getStaticMapImageUrl(hardcodedCoords.lat, hardcodedCoords.lng, {
          width: 500,
          height: 350,
          zoom: 12,
          markerText: beachName,
        });
      }
    } catch (error) {
      console.warn("Could not load hardcoded beach coordinates:", error);
    }
  }

  // Generate the map image URL with coordinates or fallback
  const mapUrl = getStaticMapImageUrl(coords?.latitude, coords?.longitude, {
    width: 500,
    height: 350,
    zoom: 12,
    markerText: session.beach?.name || session.beach_name || "Session Location",
  });
  
  console.log('Generated map URL:', mapUrl);
  return mapUrl;
};

/**
 * Transform SessionFormState to database-compatible session data
 * Converts camelCase form field names to snake_case database column names
 */
export function transformSessionFormStateToDbSchema(
  formState: SessionFormState
): Partial<Session> {
  const dbData: Partial<Session> = {};

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
    dbData.water_temp = formState.waterTemp;
  }

  if (formState.notes) {
    dbData.notes = formState.notes;
  }

  // Handle wave types as goals (session planning feature)
  if (formState.waveTypes && formState.waveTypes.length > 0) {
    dbData.goals = formState.waveTypes;
  }

  // Default to public sessions
  dbData.is_public = true;

  // Clean up undefined/empty values
  const cleaned: Partial<Session> = {};
  for (const [key, value] of Object.entries(dbData)) {
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
    // Skip values that are not actually set
    if (value === undefined || value === "$undefined") continue;

    // Remove empty strings for known optional foreign keys
    if ((key === "board_id" || key === "beach_id") && value === "") continue;

    // Security: never trust client-sent ownership/status fields
    if (key === "user_id" || key === "profile_id" || key === "status") continue;

    cleaned[key] = value;
  }
  
  return cleaned as T;
}
