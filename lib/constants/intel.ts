import type { IntelPostTag } from "@/types/database";

// Intel post tag configuration
export const INTEL_TAGS: Record<
  IntelPostTag,
  { label: string; emoji: string; color: string; description: string }
> = {
  parking: {
    label: "Parking",
    emoji: "🅿️",
    color: "bg-blue-500",
    description: "Parking availability and conditions",
  },
  hazard: {
    label: "Hazard",
    emoji: "⚠️",
    color: "bg-red-500",
    description: "Safety hazards and warnings",
  },
  crowd: {
    label: "Crowd",
    emoji: "👥",
    color: "bg-purple-500",
    description: "Crowd levels and busy spots",
  },
  conditions: {
    label: "Conditions",
    emoji: "🌊",
    color: "bg-teal-500",
    description: "Current surf and water conditions",
  },
  access: {
    label: "Access",
    emoji: "🚪",
    color: "bg-orange-500",
    description: "Beach access and entry points",
  },
  other: {
    label: "Other",
    emoji: "💭",
    color: "bg-gray-500",
    description: "General intel and tips",
  },
};

// Intel post configuration
export const INTEL_CONFIG = {
  MAX_TITLE_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_PHOTO_SIZE: 5 * 1024 * 1024, // 5MB
  DEFAULT_RADIUS_MILES: 5,
  MAX_RADIUS_MILES: 50,
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
  PHOTO_UPLOAD_BUCKET: "intel-photos",
  ALLOWED_PHOTO_TYPES: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  // Posts expire after 7 days by default for time-sensitive intel
  DEFAULT_EXPIRY_DAYS: 7,
  // Tags that should expire faster (conditions are more time-sensitive)
  FAST_EXPIRY_TAGS: ["conditions", "crowd"] as IntelPostTag[],
  FAST_EXPIRY_DAYS: 1,
};

// UI text constants
export const INTEL_UI_TEXT = {
  TITLE: "Local Intel Club",
  SUBTITLE: "Share and discover real-time surf intel",
  POST_BUTTON: "+ Intel",
  CONFIRM_BUTTON: "Confirm",
  CONFIRMED_BUTTON: "Confirmed",
  PLAN_SESSION_BUTTON: "Plan Session Here",
  FILTER_ALL: "All Tags",
  EMPTY_STATE: {
    TITLE: "No intel posts found",
    DESCRIPTION: "Be the first to share intel for this area!",
  },
  FORM: {
    TITLE: "Share Intel",
    DESCRIPTION: "Help the community with real-time information",
    LOCATION_PROMPT: "Getting your location...",
    LOCATION_ERROR: "Unable to get location. Please enable location services.",
    TAG_LABEL: "Intel Type",
    TAG_PLACEHOLDER: "What type of intel?",
    TITLE_LABEL: "Title",
    TITLE_PLACEHOLDER: "Brief title for your intel",
    DESCRIPTION_LABEL: "Description",
    DESCRIPTION_PLACEHOLDER: "Share the details...",
    PHOTO_LABEL: "Photo (optional)",
    PHOTO_PLACEHOLDER: "Add a photo to support your intel",
    SUBMIT_BUTTON: "Share Intel",
    CANCEL_BUTTON: "Cancel",
  },
  VALIDATION: {
    TITLE_REQUIRED: "Title is required",
    TITLE_TOO_LONG: "Title must be 100 characters or less",
    DESCRIPTION_REQUIRED: "Description is required",
    DESCRIPTION_TOO_LONG: "Description must be 500 characters or less",
    INVALID_TAG: "Invalid tag selected",
    LOCATION_REQUIRED: "Location is required",
    PHOTO_TOO_LARGE: "Photo must be smaller than 5MB",
    PHOTO_INVALID_TYPE: "Photo must be JPEG, PNG, or WebP",
  },
  SUCCESS: {
    POST_CREATED: "Intel posted successfully!",
    POST_CONFIRMED: "Intel confirmed!",
    POST_CONFIRMATION_REMOVED: "Confirmation removed",
  },
  ERROR: {
    POST_FAILED: "Failed to post intel",
    CONFIRM_FAILED: "Failed to confirm intel",
    LOAD_FAILED: "Failed to load intel posts",
    LOCATION_FAILED: "Failed to get location",
    PHOTO_UPLOAD_FAILED: "Failed to upload photo",
  },
};

// Map configuration
export const INTEL_MAP_CONFIG = {
  DEFAULT_ZOOM: 13,
  CLUSTER_MAX_ZOOM: 16,
  PIN_COLORS: {
    parking: "#3b82f6",
    hazard: "#ef4444",
    crowd: "#8b5cf6",
    conditions: "#14b8a6",
    access: "#f97316",
    other: "#6b7280",
  },
  PIN_SIZE: {
    DEFAULT: 32,
    SELECTED: 40,
    CLUSTER: 48,
  },
};

// Filter options
export const INTEL_FILTERS = {
  RADIUS_OPTIONS: [
    { value: 1, label: "1 mile" },
    { value: 2, label: "2 miles" },
    { value: 5, label: "5 miles" },
    { value: 10, label: "10 miles" },
    { value: 25, label: "25 miles" },
    { value: 50, label: "50 miles" },
  ],
  TAG_OPTIONS: [
    { value: "all", label: "All Tags" },
    ...Object.entries(INTEL_TAGS).map(([key, value]) => ({
      value: key,
      label: value.label,
      emoji: value.emoji,
    })),
  ],
};

// Confirmation thresholds
export const INTEL_CONFIRMATION_CONFIG = {
  // Number of confirmations needed for different trust levels
  THRESHOLDS: {
    LOW: 1,
    MEDIUM: 3,
    HIGH: 5,
  },
  // Colors for confidence indicators
  CONFIDENCE_COLORS: {
    LOW: "text-gray-500",
    MEDIUM: "text-yellow-500",
    HIGH: "text-green-500",
  },
  // Labels for confidence levels
  CONFIDENCE_LABELS: {
    LOW: "Needs confirmation",
    MEDIUM: "Somewhat reliable",
    HIGH: "Highly reliable",
  },
};

// Helper functions
export const getIntelTagConfig = (tag: IntelPostTag) => INTEL_TAGS[tag];

export const getConfidenceLevel = (confirmations: number) => {
  if (confirmations >= INTEL_CONFIRMATION_CONFIG.THRESHOLDS.HIGH) return "HIGH";
  if (confirmations >= INTEL_CONFIRMATION_CONFIG.THRESHOLDS.MEDIUM)
    return "MEDIUM";
  return "LOW";
};

export const getConfidenceColor = (confirmations: number) => {
  const level = getConfidenceLevel(confirmations);
  return INTEL_CONFIRMATION_CONFIG.CONFIDENCE_COLORS[level];
};

export const getConfidenceLabel = (confirmations: number) => {
  const level = getConfidenceLevel(confirmations);
  return INTEL_CONFIRMATION_CONFIG.CONFIDENCE_LABELS[level];
};

export const shouldExpireFast = (tag: IntelPostTag) => {
  return INTEL_CONFIG.FAST_EXPIRY_TAGS.includes(tag);
};

export const getExpiryDate = (tag: IntelPostTag) => {
  const days = shouldExpireFast(tag)
    ? INTEL_CONFIG.FAST_EXPIRY_DAYS
    : INTEL_CONFIG.DEFAULT_EXPIRY_DAYS;

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  return expiryDate;
};
