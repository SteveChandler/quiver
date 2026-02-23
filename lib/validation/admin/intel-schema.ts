import { z } from "zod";

/**
 * Intel Post Tag enum for validation
 */
const intelPostTagSchema = z.enum([
  "parking",
  "hazard",
  "crowd",
  "conditions",
  "access",
  "other",
]);

/**
 * Schema for toggling intel post active status
 */
export const toggleIntelActiveSchema = z.object({
  intelPostId: z.string().uuid("Invalid intel post ID"),
  isActive: z.boolean(),
});

/**
 * Schema for updating intel post content
 */
export const updateIntelContentSchema = z.object({
  intelPostId: z.string().uuid("Invalid intel post ID"),
  title: z.string().min(1, "Title is required").max(100, "Title too long (max 100)"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(500, "Description too long (max 500)"),
  tag: intelPostTagSchema,
});

export type ToggleIntelActiveData = z.infer<typeof toggleIntelActiveSchema>;
export type UpdateIntelContentData = z.infer<typeof updateIntelContentSchema>;
