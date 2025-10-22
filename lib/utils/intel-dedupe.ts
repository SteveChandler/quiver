import { createHash } from "node:crypto";

const HASH_VERSION = "v1";

const DEFAULT_COORDINATE_PRECISION = 3;

/**
 * Normalize free text so that trivial formatting differences do not affect the dedupe hash.
 */
export function normalizeIntelText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const roundCoordinate = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "na";
  return value.toFixed(DEFAULT_COORDINATE_PRECISION);
};

export interface IntelDedupeParams {
  userId: string;
  tag: string;
  beachId?: string | null;
  title: string;
  description: string;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Generates a deterministic dedupe hash for an intel post. This allows us to detect
 * re-submissions that contain identical content during a short time window.
 */
export function createIntelDedupeHash({
  userId,
  tag,
  beachId,
  title,
  description,
  latitude,
  longitude,
}: IntelDedupeParams): string {
  const normalizedTitle = normalizeIntelText(title);
  const normalizedDescription = normalizeIntelText(description);

  const payload = [
    HASH_VERSION,
    userId,
    tag,
    beachId ?? "unknown",
    roundCoordinate(latitude),
    roundCoordinate(longitude),
    normalizedTitle,
    normalizedDescription,
  ].join("|");

  return createHash("sha256").update(payload).digest("hex");
}

export const DEFAULT_INTEL_DEDUPE_WINDOW_MINUTES = 12 * 60;
