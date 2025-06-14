import type { SessionWithDetails } from "@/types/database";
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
  // Get beach coordinates using the unified resolution function
  const coords = session.beach ? resolveBeachCoordinates(session.beach) : null;

  // Generate the map image URL
  return getStaticMapImageUrl(coords?.latitude, coords?.longitude, {
    width: 500,
    height: 350,
    zoom: 12,
  });
};
