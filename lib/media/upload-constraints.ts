import {
  COMMUNITY_PHOTO_ACCEPTED_MIME_TYPES,
  COMMUNITY_PHOTO_MAX_INPUT_BYTES,
} from "@/lib/community-photos/upload-constraints";

export const SESSION_VIDEO_MAX_BYTES = 60 * 1024 * 1024;
const SESSION_VIDEO_MAX_DURATION_SECONDS = 60;

const SESSION_VIDEO_MIME_TYPES = {
  mp4: "video/mp4",
  mov: "video/quicktime",
} as const;

type SessionVideoExtension = keyof typeof SESSION_VIDEO_MIME_TYPES;

interface MediaFileLike {
  name: string;
  size: number;
  type?: string;
}

function getFileExtension(fileName: string): string {
  const lastSegment = fileName.split(/[\\/]/).pop() ?? fileName;
  const extension = lastSegment.split(".").pop();
  return extension && extension !== lastSegment ? extension.toLowerCase() : "";
}

export function getSessionVideoExtension(
  fileName: string,
): SessionVideoExtension | null {
  const extension = getFileExtension(fileName);
  return extension === "mp4" || extension === "mov" ? extension : null;
}

export function validateCommunityPhotoFile(
  file: { size: number; type: string },
): string | null {
  if (!(COMMUNITY_PHOTO_ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return "Choose a JPEG, PNG, WebP, HEIC, or HEIF image.";
  }

  if (file.size <= 0) return "That image file is empty.";

  if (file.size > COMMUNITY_PHOTO_MAX_INPUT_BYTES) {
    return `Images must be ${formatFileSize(COMMUNITY_PHOTO_MAX_INPUT_BYTES)} or smaller.`;
  }

  return null;
}

export function validateSessionVideoFile(
  file: MediaFileLike,
): string | null {
  const extension = getSessionVideoExtension(file.name);
  if (!extension) return "Choose an MP4 or MOV video.";

  if (file.size > SESSION_VIDEO_MAX_BYTES) {
    return "Videos must be 60 MB or smaller.";
  }

  if (file.size <= 0) return "That video file is empty.";

  const expectedMimeType = SESSION_VIDEO_MIME_TYPES[extension];
  if (file.type && file.type !== expectedMimeType) {
    return `This .${extension} file has an unsupported media type.`;
  }

  return null;
}

export function validateSessionVideoDuration(
  durationSeconds: number,
): string | null {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return "We couldn't read this video's duration. Try another file.";
  }

  if (durationSeconds > SESSION_VIDEO_MAX_DURATION_SECONDS) {
    return "Videos must be 60 seconds or shorter.";
  }

  return null;
}

export function buildSessionVideoStoragePath(
  sessionId: string,
  userId: string,
  fileName: string,
  idFactory: () => string = () => crypto.randomUUID(),
): string {
  const extension = getSessionVideoExtension(fileName);
  if (!extension) throw new Error("unsupported_video_type");

  const lastSegment = fileName.split(/[\\/]/).pop() ?? "surf-video";
  const baseName = lastSegment
    .slice(0, Math.max(0, lastSegment.length - extension.length - 1))
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  const safeBaseName = baseName || "surf-video";

  return `${sessionId}/${userId}/${safeBaseName}-${idFactory()}.${extension}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
