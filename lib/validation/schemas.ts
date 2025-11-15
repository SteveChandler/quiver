import { z } from 'zod';

// ============================================================================
// Common Validators
// ============================================================================

export const uuidSchema = z.string().uuid('Invalid UUID format');
export const emailSchema = z.string().email('Invalid email address');
export const urlSchema = z.string().url('Invalid URL').optional();

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
  beach_name: z.string()
    .min(1, 'Beach name is required')
    .max(100, 'Beach name too long'),
  session_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  start_time: z.string()
    .regex(/^\d{2}:\d{2}:\d{2}$/, 'Invalid time format (HH:MM:SS)')
    .optional(),
  notes: z.string()
    .max(1000, 'Notes cannot exceed 1000 characters')
    .optional(),
  board_id: uuidSchema.optional(),
});

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
  tag: z.enum(['parking', 'hazard', 'crowd', 'conditions', 'access', 'other'], {
    errorMap: () => ({ message: 'Invalid tag. Must be one of: parking, hazard, crowd, conditions, access, other' }),
  }),
  title: z.string()
    .min(1, 'Title is required')
    .max(100, 'Title cannot exceed 100 characters')
    .trim(),
  description: z.string()
    .min(1, 'Description is required')
    .max(500, 'Description cannot exceed 500 characters')
    .trim(),
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
  forecast_accuracy: z.enum(['accurate', 'somewhat', 'inaccurate'], {
    errorMap: () => ({ message: 'Invalid accuracy. Must be: accurate, somewhat, or inaccurate' }),
  }).optional(),
});

export type IntelPostCreateInput = z.infer<typeof IntelPostCreateSchema>;

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
  preferred_wave_size: z.enum(['small', 'medium', 'large', 'any'], {
    errorMap: () => ({ message: 'Invalid wave size. Must be: small, medium, large, or any' }),
  }).optional(),
  preferred_break_type: z.enum(['beach', 'point', 'reef', 'any'], {
    errorMap: () => ({ message: 'Invalid break type. Must be: beach, point, reef, or any' }),
  }).optional(),
  crowd_preference: z.enum(['quiet', 'moderate', 'social', 'any'], {
    errorMap: () => ({ message: 'Invalid crowd preference. Must be: quiet, moderate, social, or any' }),
  }).optional(),
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
  platform: z.enum(['ios', 'android', 'web'], {
    errorMap: () => ({ message: 'Invalid platform. Must be: ios, android, or web' }),
  }),
  device_id: z.string()
    .min(1, 'Device ID is required')
    .max(200, 'Device ID too long')
    .optional(),
  app_version: z.string()
    .max(50, 'App version too long')
    .optional(),
});

export type DeviceRegistrationInput = z.infer<typeof DeviceRegistrationSchema>;
