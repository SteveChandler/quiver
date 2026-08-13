export const COMMUNITY_PHOTO_MAX_INPUT_BYTES = 15 * 1024 * 1024;

export const COMMUNITY_PHOTO_ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type CommunityPhotoMimeType =
  (typeof COMMUNITY_PHOTO_ACCEPTED_MIME_TYPES)[number];
