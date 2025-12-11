/**
 * Beach Form Validation Schema
 *
 * Zod schema for beach creation and editing in the admin portal.
 * Focuses on core beach attributes with proper validation.
 */

import { z } from "zod";

export const beachFormSchema = z.object({
  name: z
    .string()
    .min(1, "Beach name is required")
    .max(100, "Beach name must be less than 100 characters")
    .trim(),

  location: z
    .string()
    .max(200, "Location must be less than 200 characters")
    .trim()
    .optional()
    .nullable(),

  region: z
    .string()
    .min(1, "Region is required")
    .max(100, "Region must be less than 100 characters")
    .trim(),

  country: z
    .string()
    .max(100, "Country must be less than 100 characters")
    .trim()
    .optional()
    .nullable(),

  latitude: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90")
    .optional()
    .nullable(),

  longitude: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180")
    .optional()
    .nullable(),

  break_type: z
    .enum(["beach", "point", "reef", "river", "other"], {
      message: "Invalid break type"
    })
    .optional()
    .nullable(),

  skill_level: z
    .enum(["beginner", "intermediate", "advanced", "expert"], {
      message: "Invalid skill level"
    })
    .optional()
    .nullable(),

  is_private: z
    .boolean()
    .default(false),

  hazards: z
    .array(z.string())
    .optional()
    .nullable(),
});

// Type inference for TypeScript
export type BeachFormData = z.infer<typeof beachFormSchema>;

// Type for beach updates (all fields optional except those we want to enforce)
export const beachUpdateSchema = beachFormSchema.partial().required({ name: true, region: true });
export type BeachUpdateData = z.infer<typeof beachUpdateSchema>;
