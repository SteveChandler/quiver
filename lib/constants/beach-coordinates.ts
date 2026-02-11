interface BeachCoordinates {
  lat: number;
  lng: number;
}

/**
 * Legacy hardcoded beach coordinates dictionary
 *
 * @deprecated This 27-entry coordinate dictionary is deprecated and should not be used for new code.
 *
 * **Retained only for:** Historical session map images of deleted beaches (beaches that no longer
 * exist in the `beaches` table but have associated session data).
 *
 * **For active beaches:** Use the `beaches` table directly via server actions or Supabase queries.
 * All active beaches have NOT NULL lat/lon columns in the database.
 *
 * **Migration path:** Any code using this dictionary for active beach lookups should be refactored
 * to query the `beaches` table instead. This provides accurate, up-to-date coordinates for all
 * active beaches without hardcoding.
 */
export const beachCoordinates: Record<string, BeachCoordinates> = {
  "oceanside pier": { lat: 33.1959, lng: -117.3795 },
  "oceanside harbor beach": { lat: 33.188, lng: -117.38 },
  "carlsbad state beach": { lat: 33.1581, lng: -117.3478 },
  "carlsbad reef": { lat: 33.1435, lng: -117.349 },
  "carlsbad point": { lat: 33.1628, lng: -117.344 },
  "leucadia state beach": { lat: 33.0423, lng: -117.2867 },
  grandview: { lat: 33.0373, lng: -117.2891 },
  "stone steps": { lat: 33.0374, lng: -117.2857 },
  encinitas: { lat: 33.0369, lng: -117.292 },
  "swami's": { lat: 33.0362, lng: -117.3032 },
  "cardiff reef": { lat: 33.0265, lng: -117.2822 },
  "moonlight state beach": { lat: 33.0673, lng: -117.2927 },
  "solana beach": { lat: 32.993, lng: -117.271 },
  "del mar beach": { lat: 32.9573, lng: -117.2653 },
  "torrey pines state beach": { lat: 32.9212, lng: -117.2628 },
  "blacks beach": { lat: 32.9016, lng: -117.2524 },
  "windansea beach": { lat: 32.8217, lng: -117.2837 },
  "la jolla shores": { lat: 32.8507, lng: -117.2726 },
  "tourmaline surf park": { lat: 32.8563, lng: -117.256 },
  "crystal pier": { lat: 32.811, lng: -117.2544 },
  "pacific beach": { lat: 32.803, lng: -117.2405 },
  "mission beach": { lat: 32.7801, lng: -117.2549 },
  "ocean beach": { lat: 32.7507, lng: -117.254 },
  "sunset cliffs": { lat: 32.7351, lng: -117.2519 },
  "coronado beach": { lat: 32.6859, lng: -117.1899 },
  "imperial beach": { lat: 32.5743, lng: -117.1131 },
  "silver strand": { lat: 32.6895, lng: -117.1332 },
};

/**
 * @deprecated See deprecation notice on `beachCoordinates` constant above.
 * Use the `beaches` table for active beach lookups.
 */
export const beachNames = Object.keys(beachCoordinates);
