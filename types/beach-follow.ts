/**
 * Remnants of the beach-follow surface, which was removed before release.
 *
 * `FollowTopic` survives because the BFR event taxonomy still names follow
 * topics; `BfrHoldoutAssignmentRecord` survives because the holdout assignment
 * function outlived the envelope that used to persist it. Everything else —
 * local follow state, tombstones, and the anonymous-to-account merge shapes —
 * went with the surface.
 */

export enum FollowTopic {
  Surf = "surf",
  WaterTemp = "water_temp",
  Tide = "tide",
  WaterQuality = "water_quality",
  Wind = "wind",
  General = "general",
}

export interface BfrHoldoutAssignmentRecord {
  subjectId: string;
  experimentKey: "bfr-follow-holdout-v1";
  arm: "holdout" | "treatment";
  assignedAt: string;
  version: 1;
}
