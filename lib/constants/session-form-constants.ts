/**
 * Session form constants for consistent language and options across planning and logging modes
 */

export type SessionFormMode = "plan" | "log";

// Mode-specific text configurations
export const SESSION_FORM_TEXT = {
  plan: {
    pageTitle: "Plan Session",
    pageDescription:
      "Plan your upcoming surf session - set your goals, choose your spot, and get ready to charge!",

    // Section headers
    location: "Where will you surf?",
    dateTime: "When will you surf?",
    equipment: "Which board will you use?",
    goals: "What are your goals?",
    notes: "Notes & Invite Friends",

    // Form labels and placeholders
    notesPlaceholder: "Any notes about your upcoming session...",
    durationLabel: "Expected Duration",
    submitButton: "Plan Session",
    successMessage: "Session planned successfully!",

    // Specific features
    showInviteFriends: true,
    showConditions: false,
    showPerformanceRating: false,
    showPhotos: false,
  },
  log: {
    pageTitle: "Log Session",
    pageDescription:
      "Record your completed surf session - share how it went, rate the conditions, and track your progress.",

    // Section headers
    location: "Where did you surf?",
    dateTime: "When did you surf?",
    equipment: "Which board did you use?",
    goals: "How did you perform?",
    notes: "Session Notes",
    conditions: "Session Conditions",
    photos: "Session Photos",

    // Form labels and placeholders
    notesPlaceholder: "How was your session? Share your experience...",
    durationLabel: "Session Duration",
    submitButton: "Log Session",
    successMessage: "Session logged successfully!",
    finishMessage: "You can now finish by going to your profile.",

    // Specific features
    showInviteFriends: false,
    showConditions: true,
    showPerformanceRating: true,
    showPhotos: true,
  },
} as const;

// Common form options
export const SKILL_GOALS = [
  "Pop-ups",
  "Tube Riding",
  "Cutbacks",
  "Duck Dives",
  "Bottom Turns",
  "Carving",
  "Reading Waves",
  "Endurance",
] as const;

export const DURATION_OPTIONS = [
  { value: 30, label: "30 minutes" },
  { value: 45, label: "45 minutes" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
  { value: 150, label: "2.5 hours" },
  { value: 180, label: "3 hours" },
  { value: 240, label: "4+ hours" },
] as const;

// Rating descriptions
export const RATING_DESCRIPTIONS = {
  waveQuality: {
    1: "Poor - Blown out/Flat",
    2: "Below Average - Choppy",
    3: "Average - Decent waves",
    4: "Good - Quality waves",
    5: "Excellent - Epic session",
  },
  crowdLevel: {
    1: "Empty - Solo session",
    2: "Light - Few people",
    3: "Moderate - Some crowd",
    4: "Busy - Crowded lineup",
    5: "Packed - Very crowded",
  },
  parkingEase: {
    1: "Difficult - No spots",
    2: "Hard - Long walk",
    3: "Moderate - Some walking",
    4: "Easy - Close parking",
    5: "Perfect - Right there",
  },
  overallRating: {
    1: "Poor Performance",
    2: "Below Goals",
    3: "Met Some Goals",
    4: "Achieved Goals",
    5: "Exceeded Goals",
  },
} as const;

// Form sections configuration
export const FORM_SECTIONS = {
  location: {
    icon: "MapPin",
    required: true,
    order: 1,
  },
  dateTime: {
    icon: "CalendarDays",
    required: true,
    order: 2,
  },
  equipment: {
    icon: "Surfboard",
    required: false,
    order: 3,
  },
  goals: {
    icon: "Target",
    required: false,
    order: 4,
  },
  conditions: {
    icon: "Activity",
    required: false,
    order: 5,
    showOnlyFor: "log" as SessionFormMode,
  },
  photos: {
    icon: "Camera",
    required: false,
    order: 6,
    showOnlyFor: "log" as SessionFormMode,
  },
  notes: {
    icon: "ClipboardList",
    required: false,
    order: 7,
  },
} as const;

// Mode-specific styling
export const MODE_STYLES = {
  plan: {
    headerBg: "bg-blue-50",
    headerText: "text-blue-800",
    headerBorder: "border-blue-200",
    accentColor: "text-blue-600",
    buttonColor: "bg-blue-600 hover:bg-blue-700",
    iconColor: "text-blue-500",
  },
  log: {
    headerBg: "bg-green-50",
    headerText: "text-green-800",
    headerBorder: "border-green-200",
    accentColor: "text-green-600",
    buttonColor: "bg-green-600 hover:bg-green-700",
    iconColor: "text-green-500",
  },
} as const;

// Validation messages
export const VALIDATION_MESSAGES = {
  location: "Please select a beach location",
  date: "Please select a date",
  time: "Please select a time",
  board: "Please select a board",
  notes: "Please add some notes about your session",
} as const;

// Helper functions
export function getFormText(mode: SessionFormMode) {
  return SESSION_FORM_TEXT[mode];
}

export function getModeStyles(mode: SessionFormMode) {
  return MODE_STYLES[mode];
}

export function getSectionConfig(
  section: keyof typeof FORM_SECTIONS,
  mode: SessionFormMode
) {
  const config = FORM_SECTIONS[section];

  // Check if section should be shown for this mode
  if (config.showOnlyFor && config.showOnlyFor !== mode) {
    return null;
  }

  return config;
}

export function getRatingDescription(
  type: keyof typeof RATING_DESCRIPTIONS,
  rating: number
) {
  return (
    RATING_DESCRIPTIONS[type][
      rating as keyof (typeof RATING_DESCRIPTIONS)[typeof type]
    ] || ""
  );
}
