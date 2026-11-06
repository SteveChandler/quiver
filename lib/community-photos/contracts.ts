import { z } from "zod";

import type { CommunityPhotoFeatureFlags } from "./types";

export const COMMUNITY_PHOTO_TERMS_VERSION = "2026-07-25";

const uploadFieldsSchema = z
  .object({
    targetType: z.enum(["beach", "custom_spot"]),
    targetId: z.string().uuid(),
    visibility: z.enum(["public", "private"]),
    termsVersion: z.literal(COMMUNITY_PHOTO_TERMS_VERSION),
    rightsConfirmed: z.literal("true").transform(() => true),
    idempotencyKey: z.string().uuid(),
  })
  .strict();

const voteSchema = z
  .object({
    vote: z.enum(["up", "down"]).nullable(),
    idempotencyKey: z.string().uuid(),
  })
  .strict();

const reportSchema = z
  .object({
    reason: z.enum([
      "explicit",
      "privacy",
      "safety",
      "wrong_spot",
      "stale",
    ]),
    idempotencyKey: z.string().uuid(),
  })
  .strict();

const mutationSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
  })
  .strict();

type CommunityPhotoUploadFields = z.output<typeof uploadFieldsSchema>;
type CommunityPhotoVoteInput = z.output<typeof voteSchema>;
type CommunityPhotoReportInput = z.output<typeof reportSchema>;

// Always on since Aug 2026. Installed native binaries still read these fields.
export function getCommunityPhotoFeatureFlags(): CommunityPhotoFeatureFlags {
  return {
    readEnabled: true,
    writeEnabled: true,
    termsVersion: COMMUNITY_PHOTO_TERMS_VERSION,
  };
}

export function parseCommunityPhotoUploadFields(
  input: unknown,
): CommunityPhotoUploadFields {
  return uploadFieldsSchema.parse(input);
}

export function parseCommunityPhotoVote(
  input: unknown,
): CommunityPhotoVoteInput {
  return voteSchema.parse(input);
}

export function parseCommunityPhotoReport(
  input: unknown,
): CommunityPhotoReportInput {
  return reportSchema.parse(input);
}

export function parseCommunityPhotoMutation(input: unknown): {
  idempotencyKey: string;
} {
  return mutationSchema.parse(input);
}
