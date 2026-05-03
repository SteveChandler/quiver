import { z } from "zod";
import {
  EXPERIENCE_LEVELS,
  SURF_STYLES,
} from "@/lib/constants/user-preferences";

// Extract valid values from constants for enum validation
const experienceLevelValues = EXPERIENCE_LEVELS.map((level) => level.value) as [string, ...string[]];
const surfStyleValues = SURF_STYLES.map((style) => style.value) as [string, ...string[]];

/**
 * Shared profile form schema used across all profile editing interfaces
 * including edit-profile-form, basic-profile-form, and onboarding
 */
export const profileFormSchema = z.object({
  // Basic Information
  full_name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),
  email: z.string().email("Please enter a valid email address").optional(),
  phone_number: z.string().optional(),
  bio: z.string().max(300, "Bio must be less than 300 characters").optional(),
  location: z
    .string()
    .max(100, "Location must be less than 100 characters")
    .optional(),

  // Surf Information with enum validation
  experience_level: z
    .enum(experienceLevelValues, { message: "Please select a valid experience level" })
    .optional()
    .or(z.literal("")),
  home_beach_id: z.string().uuid().nullable().optional(),
  surf_styles: z
    .array(
      z.enum(surfStyleValues, { message: "Please select valid surf styles" })
    )
    .optional(),

  // Social Media
  instagram: z
    .string()
    .max(30, "Instagram username must be less than 30 characters")
    .optional(),

  // Notification Preferences - Master toggles
  notif_push_enabled: z.boolean().optional(),
  notif_email_enabled: z.boolean().optional(),
  notif_inapp_enabled: z.boolean().optional(),

  // Notification Preferences - Feature toggles
  notif_likes: z.boolean().optional(),
  notif_follows: z.boolean().optional(),
  notif_reminders: z.boolean().optional(),
  notif_xp_updates: z.boolean().optional(),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

/**
 * Subset schema for basic profile information only (used in onboarding)
 */
const basicProfileSchema = profileFormSchema.pick({
  full_name: true,
  bio: true,
  location: true,
});

export type BasicProfileFormValues = z.infer<typeof basicProfileSchema>;
