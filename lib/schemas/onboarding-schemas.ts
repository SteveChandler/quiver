import { z } from 'zod';

// Step 2: Profile
export const profileSchema = z.object({
  fullName: z.string()
    .min(2, 'Full name must be at least 2 characters')
    .max(50, 'Full name must be less than 50 characters')
    .optional()
    .or(z.literal('')),
  displayName: z.string()
    .min(2, 'Display name must be at least 2 characters')
    .max(30, 'Display name must be less than 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores')
    .optional()
    .or(z.literal('')),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

// Step 3: Home Beach
export const homeBeachSchema = z.object({
  homeBeachId: z.string().min(1, 'Please select a beach'),
  homeBeachName: z.string().min(1, 'Please select a beach'),
});

export type HomeBeachFormData = z.infer<typeof homeBeachSchema>;

// Step 4: Preferences
export const preferencesSchema = z.object({
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced', 'expert'], {
    message: 'Please select your experience level',
  }),
  surfStyles: z.array(z.string()).min(1, 'Select at least one style'),
  preferredWaveSize: z.enum(['small', 'medium', 'large', 'any']).optional(),
  preferredBreakType: z.enum(['beach', 'point', 'reef', 'any']).optional(),
  crowdPreference: z.enum(['social', 'moderate', 'solitude']).optional(),
});

export type PreferencesFormData = z.infer<typeof preferencesSchema>;

// Step 5: Referral (optional)
export const referralSchema = z.object({
  referralCode: z.string().optional(),
});

export type ReferralFormData = z.infer<typeof referralSchema>;

// Step 6: Notifications
export const notificationsSchema = z.object({
  pushEnabled: z.boolean().default(false),
  emailEnabled: z.boolean().default(true),
});

export type NotificationsFormData = z.infer<typeof notificationsSchema>;
