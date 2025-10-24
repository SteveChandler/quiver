import { z } from "zod";

/**
 * Review Validation Schemas
 *
 * Zod validation for admin beach review management operations.
 * Reviews are read-only in admin (no edit schema needed).
 */

/**
 * Review list filtering options
 */
export const reviewFilterSchema = z.object({
  includeDeleted: z.boolean().optional().default(false),
  search: z.string().optional().default(""),
  beachId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  minRating: z.number().min(1).max(5).optional(),
  maxRating: z.number().min(1).max(5).optional(),
  minWaveQuality: z.number().min(1).max(5).optional(),
  maxWaveQuality: z.number().min(1).max(5).optional(),
});

export type ReviewFilterOptions = z.infer<typeof reviewFilterSchema>;

/**
 * Review statistics response
 */
export const reviewStatsSchema = z.object({
  total: z.number(),
  deleted: z.number(),
  avgOverallRating: z.number().nullable(),
  avgWaveQuality: z.number().nullable(),
  avgCrowdDensity: z.number().nullable(),
  avgParking: z.number().nullable(),
  avgAccessibility: z.number().nullable(),
  totalHelpfulVotes: z.number(),
});

export type ReviewStats = z.infer<typeof reviewStatsSchema>;
