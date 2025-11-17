/**
 * Centralized type exports
 *
 * This barrel file exports all custom types for easy importing throughout the app
 */

// Coordinate types
export type {
  Coordinates,
  CoordinatesVerbose,
  MapboxCoordinates,
  DatabaseCoordinates,
} from './coordinates';

export {
  isCoordinates,
  isCoordinatesVerbose,
  isLegacyLngLatFormat,
} from './coordinates';
