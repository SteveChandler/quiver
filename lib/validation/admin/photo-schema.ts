/**
 * Photo Management Validation Schemas
 *
 * Zod schemas for photo moderation operations in the admin portal.
 * Validates operations on session_media and beach_photos tables.
 */

import { z } from "zod";

/**
 * Schema for caption updates
 */
export const photoCaptionSchema = z.object({
  caption: z
    .string()
    .max(500, "Caption must be less than 500 characters")
    .trim()
    .optional()
    .nullable(),
});

export type PhotoCaptionData = z.infer<typeof photoCaptionSchema>;

/**
 * Schema for approval status updates (beach_photos only)
 */
export const photoApprovalSchema = z.object({
  approved: z.boolean(),
});

export type PhotoApprovalData = z.infer<typeof photoApprovalSchema>;

/**
 * Schema for photo list filters
 */
export const photoFilterSchema = z.object({
  includeDeleted: z.boolean().default(false),
  approvedOnly: z.boolean().optional(), // beach_photos only
  search: z.string().optional(),
  sortBy: z.enum(["created_at", "file_size", "media_type"]).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
});

export type PhotoFilterData = z.infer<typeof photoFilterSchema>;
