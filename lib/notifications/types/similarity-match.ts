/**
 * similarity_match notification payload schema + type.
 *
 * Producer: app/api/cron/condition-alert-deliver/route.ts (the similarity-row
 *   partition path). The cron reads similarity rows out of `alert_queue`
 *   (stamped by `try_insert_similarity_alert`) and calls
 *   `enqueueNotification({ type: "similarity_match", payload, ... })`.
 *
 * The registry imports the schema + type from here so payload validation has
 * one source of truth and the channel builders have a typed payload to
 * destructure.
 *
 * Plan V4 — Agent 3 (Notifications). The `queue_items` field carries
 * provenance from condition-alert-deliver to the registry's `onChannelOutcome`
 * hook so per-rule rows in `alert_delivery_attempts` can be reconciled after
 * the worker reaches a terminal push outcome — mirroring `forecast_alert`.
 */

import { z } from "zod";

export const similarityMatchSchema = z.object({
  beach_id: z.string().min(1),
  configured_beach_id: z.string().min(1).optional(),
  /**
   * Beach slug. Strict non-empty by design — a missing slug means the
   * upstream beach row was malformed at seed time and the cron's
   * producer-side guard (in similarity-alerts/route.ts) should have dropped
   * it before scoring. If a row ever lands here with an empty slug, that's
   * a real data bug we want to surface, not silently paper over.
   */
  beach_slug: z.string().min(1),
  beach_name: z.string().min(1),
  alert_date: z.string().min(1),
  forecast_at: z.string().min(1),
  score: z.number(),
  label: z.string().nullable().optional(),
  reason: z.string(),
  /** Optional richer conditions context stamped by newer similarity cron rows. */
  window_local: z.string().min(1).optional(),
  wave_height_ft: z.number().finite().optional(),
  wave_period_s: z.number().finite().optional(),
  wind_speed_mph: z.number().finite().optional(),
  wind_direction: z.string().min(1).optional(),
  tide_height_ft: z.number().finite().optional(),
  tide_status: z.string().min(1).optional(),
  confidence: z.number().finite().optional(),
  condition_summary: z.string().min(1).optional(),
  board_tip: z.string().min(1).optional(),
  setup_tip: z.string().min(1).optional(),
  /** Provenance for onChannelOutcome to reconcile alert_delivery_attempts. */
  queue_items: z
    .array(z.object({ queue_id: z.string(), rule_id: z.string() }))
    .optional(),
});

export type SimilarityMatchPayload = z.infer<typeof similarityMatchSchema>;
