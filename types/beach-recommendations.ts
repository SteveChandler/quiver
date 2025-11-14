/**
 * Types for beach recommendation system
 */

export interface BeachRecommendation {
  id: string;
  name: string;
  location: string;
  distance_miles: string;
  score: number;
  reasons: string[];
  image_url: string | null;

  // URL generation fields
  slug: string | null;
  city: string | null;
  state: string | null;

  // Current conditions
  wave_height: string;
  wave_direction: string;
  wind_speed: number;
  wind_description: string;
  tide_status: string;
  tide_height: number;

  // Metadata
  skill_level: string;
  crowd_level: "Uncrowded" | "Moderate" | "Crowded";
  is_hidden_gem: boolean;
}


