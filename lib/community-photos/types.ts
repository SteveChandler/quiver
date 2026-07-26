export type CommunityPhotoTargetType = "beach" | "custom_spot";
export type CommunityPhotoVisibility = "public" | "private";
export type CommunityPhotoVote = "up" | "down" | null;
export type CommunityPhotoReportReason =
  | "explicit"
  | "privacy"
  | "safety"
  | "wrong_spot"
  | "stale";

export interface CommunityPhotoTarget {
  type: CommunityPhotoTargetType;
  id: string;
}

export interface CommunityPhotoAttribution {
  kind: "profile" | "community";
  displayName: string;
  profileId: string | null;
}

export interface ResolvedSpotPhoto {
  id: string;
  source: "curated" | "community";
  visibility: CommunityPhotoVisibility;
  imageUrl: string;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
  title: string | null;
  creatorName: string | null;
  attributionHtml: string | null;
  attribution: CommunityPhotoAttribution | null;
  community: {
    voteScore: number;
    upvotes: number;
    downvotes: number;
    viewerVote: CommunityPhotoVote;
    canVote: boolean;
    canReport: boolean;
    canRemove: boolean;
    isPinned: boolean;
  } | null;
  createdAt: string;
}

export interface CommunityPhotoFeatureFlags {
  readEnabled: boolean;
  writeEnabled: boolean;
  termsVersion: string;
}

export interface RecoverableCommunityPhoto {
  id: string;
  targetType: CommunityPhotoTargetType;
  targetId: string;
  imageUrl: string;
  thumbUrl: string;
  recoverableUntil: string;
  moderationStatus: "visible" | "hidden";
  hasActiveHold: boolean;
}

export interface CommunityPhotoApiError {
  error: string;
  code: string;
  retryable: boolean;
}
