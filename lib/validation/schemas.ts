import { z } from 'zod';

// ============================================================================
// Common Validators
// ============================================================================

export const uuidSchema = z.string().uuid('Invalid UUID format');
export const emailSchema = z.string().email('Invalid email address');
export const urlSchema = z.string().url('Invalid URL').optional();

// ============================================================================
// Boards
// ============================================================================

export const BoardCreateSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Board name is required')
    .max(100, 'Board name cannot exceed 100 characters'),
  board_type: z.string()
    .trim()
    .min(1, 'Board type is required')
    .max(50, 'Board type cannot exceed 50 characters'),
  dimensions: z.string()
    .trim()
    .min(1, 'Dimensions are required')
    .max(100, 'Dimensions cannot exceed 100 characters'),
  description: z.string()
    .trim()
    .max(1000, 'Description cannot exceed 1000 characters')
    .optional(),
  image_url: urlSchema,
  size: z.string()
    .trim()
    .max(50, 'Size cannot exceed 50 characters')
    .optional(),
  volume: z.number()
    .min(0, 'Volume must be non-negative')
    .max(500, 'Volume is unrealistic (max 500)')
    .optional(),
});

export type BoardCreateInput = z.infer<typeof BoardCreateSchema>;

// ============================================================================
// Comments
// ============================================================================

export const CommentSchema = z.object({
  content: z.string()
    .min(1, 'Comment cannot be empty')
    .max(2000, 'Comment cannot exceed 2000 characters')
    .trim(),
  session_id: uuidSchema,
});

export type CommentInput = z.infer<typeof CommentSchema>;

// ============================================================================
// Session Planning
// ============================================================================

export const SessionPlanSchema = z.object({
  beach_id: uuidSchema.optional(),
  beach_name: z.string()
    .min(1, 'Beach name is required')
    .max(100, 'Beach name too long')
    .optional(),
  session_date: z.string()
    .refine((val) => /^\d{4}-\d{2}-\d{2}$/.test(val), 'Invalid date format (YYYY-MM-DD)'),
  start_time: z.string()
    .refine((val) => /^\d{2}:\d{2}:\d{2}$/.test(val), 'Invalid time format (HH:MM:SS)')
    .optional(),
  notes: z.string()
    .max(1000, 'Notes cannot exceed 1000 characters')
    .optional(),
  board_id: uuidSchema.optional(),
}).refine(
  (val) => Boolean(val.beach_id || val.beach_name),
  { message: 'Beach is required', path: ['beach_name'] }
);

export type SessionPlanInput = z.infer<typeof SessionPlanSchema>;

// ============================================================================
// Intel Posts
// ============================================================================

export const IntelPostCreateSchema = z.object({
  latitude: z.number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z.number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  tag: z.enum(['parking', 'hazard', 'crowd', 'conditions', 'access', 'other']),
  title: z.string()
    .min(1, 'Title is required')
    .max(100, 'Title cannot exceed 100 characters')
    .trim(),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description cannot exceed 500 characters')
    .trim(),
  emoji_rating: z.enum(['fire', 'shaka', 'meh', 'thumbsdown']).optional(),
  photo_url: urlSchema,
  photo_storage_path: z.string().max(500, 'Storage path too long').optional(),
  wave_height: z.number()
    .min(0, 'Wave height must be non-negative')
    .max(100, 'Wave height unrealistic (max 100m)')
    .optional(),
  wind_speed: z.number()
    .min(0, 'Wind speed must be non-negative')
    .max(200, 'Wind speed unrealistic (max 200 mph)')
    .optional(),
  wind_direction: z.string().max(20, 'Wind direction too long').optional(),
  water_temp: z.number()
    .min(0, 'Water temperature must be non-negative')
    .max(120, 'Water temperature unrealistic (max 120°F)')
    .optional(),
  crowd_level: z.number()
    .int('Crowd level must be an integer')
    .min(1, 'Crowd level must be between 1-5')
    .max(5, 'Crowd level must be between 1-5')
    .optional(),
  wave_types: z.array(z.string())
    .max(10, 'Maximum 10 wave types')
    .optional(),
  forecast_accuracy: z.enum(['accurate', 'somewhat', 'inaccurate']).optional(),
});

export type IntelPostCreateInput = z.infer<typeof IntelPostCreateSchema>;

export const IntelReportSchema = z.object({
  reason: z.string()
    .max(500, 'Reason cannot exceed 500 characters')
    .trim()
    .optional(),
});

export type IntelReportInput = z.infer<typeof IntelReportSchema>;

// ============================================================================
// Beach Search
// ============================================================================

export const BeachSearchSchema = z.object({
  query: z.string()
    .min(1, 'Search query cannot be empty')
    .max(200, 'Search query too long')
    .trim(),
  limit: z.number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .optional(),
  page: z.number()
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .optional(),
});

export type BeachSearchInput = z.infer<typeof BeachSearchSchema>;

// ============================================================================
// Profile Updates
// ============================================================================

export const ProfileUpdateSchema = z.object({
  full_name: z.string()
    .max(100, 'Name cannot exceed 100 characters')
    .optional(),
  bio: z.string()
    .max(500, 'Bio cannot exceed 500 characters')
    .optional(),
  preferred_wave_size: z.enum(['small', 'medium', 'large', 'any']).optional(),
  preferred_break_type: z.enum(['beach', 'point', 'reef', 'any']).optional(),
  crowd_preference: z.enum(['quiet', 'moderate', 'social', 'any']).optional(),
});

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;

// ============================================================================
// Generic Pagination
// ============================================================================

export const PaginationSchema = z.object({
  page: z.number()
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .default(1),
  limit: z.number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(20),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;

// ============================================================================
// Device Registration (for push notifications)
// ============================================================================

export const DeviceRegistrationSchema = z.object({
  fcm_token: z.string()
    .min(1, 'FCM token is required')
    .max(500, 'FCM token too long'),
  platform: z.enum(['ios', 'android', 'web']),
  device_id: z.string()
    .min(1, 'Device ID is required')
    .max(200, 'Device ID too long')
    .optional(),
  app_version: z.string()
    .max(50, 'App version too long')
    .optional(),
});

export type DeviceRegistrationInput = z.infer<typeof DeviceRegistrationSchema>;

// ============================================================================
// Session Wizard URL Parameters
// ============================================================================

/**
 * Validation schema for Session Wizard URL parameters
 *
 * Used to validate and parse URL parameters when prefilling the Session Wizard
 * from "Plan Session" CTAs (Personalized Forecast, Surf Discovery, etc.)
 *
 * Security: All parameters are validated before use to prevent XSS and injection
 * Compatibility: Missing/invalid params are handled gracefully with defaults
 *
 * @example
 * ```typescript
 * const result = SessionWizardPrefillSchema.safeParse({
 *   mode: 'plan',
 *   beach: 'abc-123-def-456',
 *   beachName: 'Pacific Beach',
 *   startTime: '2025-11-22T06:00:00.000Z',
 *   endTime: '2025-11-22T10:00:00.000Z',
 *   step: '3',
 * });
 *
 * if (result.success) {
 *   // Use validated data
 *   const { mode, beach, startTime, endTime } = result.data;
 * }
 * ```
 */
export const SessionWizardPrefillSchema = z.object({
  // Session mode (required, defaults to 'plan')
  mode: z.enum(['plan', 'log']).default('plan'),

  // Quick log mode flag (optional, defaults to false)
  quick: z.enum(['true', 'false'])
    .default('false')
    .transform((val) => val === 'true')
    .describe('Enable streamlined 2-step quick log flow'),

  // Beach UUID (optional - wizard can work without prefill)
  beach: z.string()
    .uuid('Invalid beach ID format')
    .optional()
    .describe('Beach UUID from database'),

  // Beach name (optional, for display only)
  beachName: z.string()
    .min(1, 'Beach name cannot be empty')
    .max(200, 'Beach name too long')
    .trim()
    .optional()
    .describe('Beach display name (not trusted for DB operations)'),

  // Start time (optional, ISO 8601)
  startTime: z.string()
    .datetime({ message: 'Invalid start time format (must be ISO 8601)' })
    .optional()
    .describe('Session start time in ISO 8601 format'),

  // End time (optional, ISO 8601)
  endTime: z.string()
    .datetime({ message: 'Invalid end time format (must be ISO 8601)' })
    .optional()
    .describe('Session end time in ISO 8601 format'),

  // Target wizard step (optional, defaults to 1)
  step: z.string()
    .default('1')
    .refine((val) => /^\d+$/.test(val), 'Step must be a number')
    .transform((val) => parseInt(val, 10))
    .refine(
      (num) => num >= 1 && num <= 4,
      'Step must be between 1 and 4'
    )
    .describe('Target wizard step (1-indexed)'),
})
  // Cross-field validation: end time must be after start time
  .refine(
    (data) => {
      if (!data.startTime || !data.endTime) return true; // Skip if either is missing
      return new Date(data.startTime) < new Date(data.endTime);
    },
    {
      message: 'End time must be after start time',
      path: ['endTime'],
    }
  )
  // Validate reasonable time window (max 12 hours)
  .refine(
    (data) => {
      if (!data.startTime || !data.endTime) return true; // Skip if either is missing
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      return durationHours <= 12;
    },
    {
      message: 'Session duration cannot exceed 12 hours',
      path: ['endTime'],
    }
  );

export type SessionWizardPrefillInput = z.infer<typeof SessionWizardPrefillSchema>;
