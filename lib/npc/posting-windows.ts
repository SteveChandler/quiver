/**
 * NPC Posting Windows
 * Defines time-of-day rules for when each personality type posts
 */

export type PersonalityType =
  | 'rookie'
  | 'local'
  | 'traveler'
  | 'photographer'
  | 'tactical'
  | 'competitor'
  | 'forecaster';

export type ActivityLevel = 'high' | 'medium' | 'low';

export interface PostingWindow {
  primary: [number, number]; // Start and end hour (0-23)
  secondary: [number, number] | []; // Optional secondary window
  weekendBoost: boolean; // Posts more on weekends
}

/**
 * Default posting windows by personality type
 * Times are in local timezone (Pacific Time for California)
 */
const POSTING_WINDOWS: Record<PersonalityType, PostingWindow> = {
  local: {
    primary: [5, 8], // Dawn patrol: 5am-8am
    secondary: [16, 19], // After work: 4pm-7pm
    weekendBoost: true,
  },
  rookie: {
    primary: [9, 12], // Mid-morning: 9am-12pm
    secondary: [14, 17], // Afternoon: 2pm-5pm
    weekendBoost: true,
  },
  traveler: {
    primary: [7, 11], // Tourist hours: 7am-11am
    secondary: [15, 18], // Afternoon: 3pm-6pm
    weekendBoost: false, // Don't know what day it is
  },
  photographer: {
    primary: [5, 7], // Golden hour AM: 5am-7am
    secondary: [17, 20], // Golden hour PM: 5pm-8pm
    weekendBoost: false,
  },
  tactical: {
    primary: [5, 6], // Pre-dawn recon: 5am-6am
    secondary: [11, 13], // Midday assessment: 11am-1pm
    weekendBoost: false,
  },
  competitor: {
    primary: [6, 9], // Training block: 6am-9am
    secondary: [15, 18], // Afternoon session: 3pm-6pm
    weekendBoost: true,
  },
  forecaster: {
    primary: [5, 6], // 5:30am daily
    secondary: [],
    weekendBoost: false,
  },
};

/**
 * Check if the current hour falls within a posting window
 */
export function isWithinPostingWindow(
  currentHour: number,
  window: PostingWindow
): boolean {
  const inPrimary =
    currentHour >= window.primary[0] && currentHour < window.primary[1];
  const inSecondary =
    window.secondary.length === 2 &&
    currentHour >= window.secondary[0] &&
    currentHour < window.secondary[1];

  return inPrimary || inSecondary;
}

/**
 * Legacy compatibility: Check if personality is in posting window
 */
export function isInPostingWindow(personality: PersonalityType, date: Date): boolean {
  const hour = date.getHours();
  const window = POSTING_WINDOWS[personality];
  return isWithinPostingWindow(hour, window);
}

/**
 * Check if a personality type should be posting at the current time
 */
export function shouldPostAtTime(
  personalityType: PersonalityType,
  currentHour: number,
  isWeekend: boolean = false
): boolean {
  const window = POSTING_WINDOWS[personalityType];
  if (!window) return false;

  return isWithinPostingWindow(currentHour, window);
}

/**
 * Legacy compatibility: Should post now with probability
 */
function shouldPostNow(
  personality: PersonalityType,
  activityLevel: ActivityLevel,
  date: Date = new Date()
): boolean {
  if (!isInPostingWindow(personality, date)) return false;
  const probability = { high: 0.7, medium: 0.4, low: 0.2 }[activityLevel];
  return Math.random() < probability;
}

/**
 * Get the posting window for a personality type
 * Can be overridden by profile-specific settings from JSONB column
 */
export function getPostingWindow(
  personalityType: PersonalityType,
  profileWindow?: { primary?: number[]; secondary?: number[] } | null
): PostingWindow {
  const defaultWindow = POSTING_WINDOWS[personalityType];

  if (profileWindow) {
    return {
      primary:
        profileWindow.primary && profileWindow.primary.length === 2
          ? [profileWindow.primary[0], profileWindow.primary[1]]
          : defaultWindow.primary,
      secondary:
        profileWindow.secondary && profileWindow.secondary.length === 2
          ? [profileWindow.secondary[0], profileWindow.secondary[1]]
          : defaultWindow.secondary,
      weekendBoost: defaultWindow.weekendBoost,
    };
  }

  return defaultWindow;
}

/**
 * Describe the current time of day for content generation
 */
export function describeTimeOfDay(hour: number): string {
  if (hour < 5) return 'pre-dawn';
  if (hour < 7) return 'dawn patrol';
  if (hour < 9) return 'early morning';
  if (hour < 11) return 'morning';
  if (hour < 14) return 'late morning';
  if (hour < 17) return 'afternoon';
  if (hour < 20) return 'sunset session';
  return 'evening';
}

/**
 * Format clock time for display
 */
function formatClockTime(date: Date): string {
  return date
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    .replace(/\s/g, '');
}
