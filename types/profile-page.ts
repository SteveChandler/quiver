/**
 * Profile Page Types
 *
 * Type definitions for the aggregated profile page API endpoint
 * that provides all profile page data in a single request.
 *
 * @see /app/api/me/profile-page/route.ts
 */

import type { Beach, Board, SessionWithDetails } from './database';
import type { UserSurfPreferences } from '@/lib/services/preference-learning-service';

/**
 * User stats data returned from the profile page endpoint
 */
export interface ProfilePageStats {
  sessionCount: number;
  boardCount: number;
  averageRating: number;
  homeBeachId: string | null;
  homeBeachName: string | null;
  mostVisitedBeach: string | null;
  mostVisitedBeachCount: number;
}

/**
 * Combined preferences data (learned from sessions + explicit from profile)
 */
export interface ProfilePagePreferences {
  learned: UserSurfPreferences | null;
  onboarding: {
    experience_level?: string;
    surf_styles?: string[];
  };
}

/**
 * Profile data returned by the profile-page endpoint
 * Contains the fields needed for the profile page UI
 */
export interface ProfilePageProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  instagram: string | null;
  home_beach_id: string | null;
  experience_level: string | null;
  surf_styles: string[] | null;
  homeBeachName: string | null;
  // Notification settings (used by ProfilePreferences)
  notif_reminders: boolean | null;
  notif_forecast_alerts: boolean | null;
  allow_implicit_tracking: boolean | null;
}

/**
 * Aggregated profile page data returned by /api/me/profile-page
 *
 * Combines all data needed for the profile page in a single response:
 * - profile: User profile with home beach name
 * - stats: Session/board counts, ratings, most visited beach
 * - learnedPreferences: Preferences learned from session analysis
 * - recentSessions: Last 5 sessions for quick display
 * - boards: User's board quiver
 * - beaches: Kept for response compatibility; editor surfaces fetch beaches lazily
 */
export interface ProfilePageData {
  profile: ProfilePageProfile;
  stats: ProfilePageStats;
  preferences: ProfilePagePreferences;
  recentSessions: SessionWithDetails[];
  boards: Board[];
  beaches: Beach[];
}
