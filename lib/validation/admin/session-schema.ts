import { z } from "zod";

/**
 * Session Validation Schemas
 *
 * Zod validation for admin session management operations.
 * Sessions are read-only in admin (no edit schema needed).
 */

/**
 * Session list filtering options
 */
export const sessionFilterSchema = z.object({
  includeDeleted: z.boolean().optional().default(false),
  search: z.string().optional().default(""),
  userId: z.string().uuid().optional(),
  beachId: z.string().uuid().optional(),
  status: z.enum(["planned", "logged", "cancelled"]).optional(),
  isPublic: z.boolean().optional(),
  dateFrom: z.string().optional(), // ISO date string
  dateTo: z.string().optional(), // ISO date string
  minRating: z.number().min(1).max(5).optional(),
  maxRating: z.number().min(1).max(5).optional(),
});

export type SessionFilterOptions = z.infer<typeof sessionFilterSchema>;

/**
 * Session statistics response
 */
export const sessionStatsSchema = z.object({
  total: z.number(),
  public: z.number(),
  private: z.number(),
  planned: z.number(),
  logged: z.number(),
  cancelled: z.number(),
  deleted: z.number(),
  avgRating: z.number().nullable(),
  totalLikes: z.number(),
  totalComments: z.number(),
});

export type SessionStats = z.infer<typeof sessionStatsSchema>;
