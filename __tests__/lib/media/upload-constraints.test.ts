import {
  SESSION_VIDEO_MAX_BYTES,
  buildSessionVideoStoragePath,
  getSessionVideoExtension,
  validateCommunityPhotoFile,
  validateSessionVideoDuration,
  validateSessionVideoFile,
} from "@/lib/media/upload-constraints";
import { COMMUNITY_PHOTO_MAX_INPUT_BYTES } from "@/lib/community-photos/upload-constraints";

describe("session video upload constraints", () => {
  it("accepts an MP4 at the exact size limit", () => {
    expect(
      validateSessionVideoFile({
        name: "dawn-patrol.mp4",
        size: SESSION_VIDEO_MAX_BYTES,
        type: "video/mp4",
      }),
    ).toBeNull();
  });

  it("rejects unsupported extensions and oversized files before upload", () => {
    expect(
      validateSessionVideoFile({
        name: "dawn-patrol.webm",
        size: 100,
        type: "video/webm",
      }),
    ).toBe("Choose an MP4 or MOV video.");
    expect(
      validateSessionVideoFile({
        name: "dawn-patrol.mov",
        size: SESSION_VIDEO_MAX_BYTES + 1,
        type: "video/quicktime",
      }),
    ).toBe("Videos must be 60 MB or smaller.");
  });

  it("rejects a duration above 60 seconds before storage upload", () => {
    expect(validateSessionVideoDuration(60)).toBeNull();
    expect(validateSessionVideoDuration(60.01)).toBe(
      "Videos must be 60 seconds or shorter.",
    );
  });

  it("builds the required session/user storage layout", () => {
    const path = buildSessionVideoStoragePath(
      "session-id",
      "user-id",
      "my wave!!.MP4",
      () => "upload-id",
    );

    expect(path).toBe("session-id/user-id/my-wave-upload-id.mp4");
    expect(path.split("/")[1]).toBe("user-id");
    expect(getSessionVideoExtension(path)).toBe("mp4");
    expect(path).not.toContain("..");
  });
});

describe("community photo upload constraints", () => {
  it.each([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ])("accepts route-supported MIME type %s at the exact size limit", (type) => {
    expect(
      validateCommunityPhotoFile({
        size: COMMUNITY_PHOTO_MAX_INPUT_BYTES,
        type,
      }),
    ).toBeNull();
  });

  it("rejects unsupported, empty, and oversized files before upload", () => {
    expect(
      validateCommunityPhotoFile({ size: 100, type: "image/gif" }),
    ).toBe("Choose a JPEG, PNG, WebP, HEIC, or HEIF image.");
    expect(
      validateCommunityPhotoFile({ size: 0, type: "image/jpeg" }),
    ).toBe("That image file is empty.");
    expect(
      validateCommunityPhotoFile({
        size: COMMUNITY_PHOTO_MAX_INPUT_BYTES + 1,
        type: "image/jpeg",
      }),
    ).toBe("Images must be 15.0 MB or smaller.");
  });
});
