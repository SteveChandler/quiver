export const SESSION_PHOTO_MAX_INPUT_BYTES = 10 * 1024 * 1024;
/** Maximum size permitted after compression and before storage. */
export const SESSION_PHOTO_MAX_STORAGE_BYTES = 5 * 1024 * 1024;
export const SESSION_PHOTO_MAX_PER_SESSION = 5;

export const SESSION_PHOTO_ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export const SESSION_PHOTO_ACCEPT_ATTRIBUTE =
  SESSION_PHOTO_ACCEPTED_MIME_TYPES.join(",");

export type SessionPhotoValidationError =
  | "invalid_file_type"
  | "file_too_large";

export function isSessionPhotoMimeType(
  mimeType: string,
): mimeType is (typeof SESSION_PHOTO_ACCEPTED_MIME_TYPES)[number] {
  return (SESSION_PHOTO_ACCEPTED_MIME_TYPES as readonly string[]).includes(
    mimeType,
  );
}

export function validateSessionPhotoFile(
  file: Pick<File, "size" | "type">,
  maxBytes: number = SESSION_PHOTO_MAX_INPUT_BYTES,
): SessionPhotoValidationError | null {
  if (!isSessionPhotoMimeType(file.type)) return "invalid_file_type";
  if (file.size > maxBytes) return "file_too_large";
  return null;
}

export function validateSessionPhotoInput(
  file: Pick<File, "size" | "type">,
): SessionPhotoValidationError | null {
  return validateSessionPhotoFile(file, SESSION_PHOTO_MAX_INPUT_BYTES);
}

export function validateSessionPhotoStorage(
  file: Pick<File, "size" | "type">,
): SessionPhotoValidationError | null {
  return validateSessionPhotoFile(file, SESSION_PHOTO_MAX_STORAGE_BYTES);
}
