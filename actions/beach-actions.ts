// Re-export focused modules for backward compatibility
export { getBeaches, getBeachById } from "./beach/beach-query-actions";

export {
  getNearbyBeaches,
  calculateDistanceInMiles,
  toRadians,
} from "./beach/beach-location-actions";

export {
  getFavoriteBeaches,
  addFavoriteBeach,
  removeFavoriteBeach,
} from "./beach/beach-favorite-actions";