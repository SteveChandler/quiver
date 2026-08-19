import {
  SESSION_PHOTO_ACCEPTED_MIME_TYPES,
  SESSION_PHOTO_ACCEPT_ATTRIBUTE,
  SESSION_PHOTO_MAX_INPUT_BYTES,
  SESSION_PHOTO_MAX_PER_SESSION,
  SESSION_PHOTO_MAX_STORAGE_BYTES,
  validateSessionPhotoFile,
  validateSessionPhotoInput,
  validateSessionPhotoStorage,
} from "@/lib/media/session-photo-policy";

describe("session photo upload policy", () => {
  it("keeps the accepted MIME types and browser accept value in sync", () => {
    expect(SESSION_PHOTO_ACCEPTED_MIME_TYPES).toEqual([
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ]);
    expect(SESSION_PHOTO_ACCEPT_ATTRIBUTE).toBe(
      "image/jpeg,image/jpg,image/png,image/webp",
    );
    expect(SESSION_PHOTO_MAX_PER_SESSION).toBe(5);
  });

  it("accepts input at 10 MiB and rejects larger input", () => {
    expect(
      validateSessionPhotoInput({
        type: "image/jpeg",
        size: SESSION_PHOTO_MAX_INPUT_BYTES,
      }),
    ).toBeNull();
    expect(
      validateSessionPhotoInput({
        type: "image/jpeg",
        size: SESSION_PHOTO_MAX_INPUT_BYTES + 1,
      }),
    ).toBe("file_too_large");
  });

  it("accepts storage at 5 MiB and rejects larger uncompressed storage", () => {
    expect(
      validateSessionPhotoStorage({
        type: "image/webp",
        size: SESSION_PHOTO_MAX_STORAGE_BYTES,
      }),
    ).toBeNull();
    expect(
      validateSessionPhotoStorage({
        type: "image/webp",
        size: SESSION_PHOTO_MAX_STORAGE_BYTES + 1,
      }),
    ).toBe("file_too_large");
  });

  it("rejects unsupported MIME types at either validation boundary", () => {
    expect(
      validateSessionPhotoFile({ type: "image/gif", size: 1 }),
    ).toBe("invalid_file_type");
    expect(
      validateSessionPhotoStorage({ type: "image/gif", size: 1 }),
    ).toBe("invalid_file_type");
  });
});
