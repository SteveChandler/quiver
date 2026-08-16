import {
  initialMediaUploadState,
  mediaUploadReducer,
} from "@/lib/media/upload-state";

describe("media upload state machine", () => {
  it("supports video preparation, progress, and pending review states", () => {
    const transcoding = mediaUploadReducer(initialMediaUploadState, {
      type: "start-transcoding",
    });
    expect(transcoding).toEqual({
      status: "transcoding",
      progress: 0,
      error: null,
    });

    const uploading = mediaUploadReducer(transcoding, {
      type: "start-uploading",
    });
    const progress = mediaUploadReducer(uploading, {
      type: "progress",
      value: 48,
    });
    expect(progress).toEqual({ status: "uploading", progress: 48, error: null });
    expect(mediaUploadReducer(progress, { type: "pending-review" })).toEqual({
      status: "pending-review",
      progress: 100,
      error: null,
    });
  });

  it("preserves a visible retry error and resets cleanly", () => {
    const failed = mediaUploadReducer(initialMediaUploadState, {
      type: "error",
      message: "Videos must be 60 MB or smaller.",
    });
    expect(failed).toEqual({
      status: "error",
      progress: 0,
      error: "Videos must be 60 MB or smaller.",
    });
    expect(mediaUploadReducer(failed, { type: "reset" })).toEqual(
      initialMediaUploadState,
    );
  });

  it("clamps progress so a broken progress event cannot overflow the UI", () => {
    expect(
      mediaUploadReducer(initialMediaUploadState, {
        type: "progress",
        value: 140,
      }).progress,
    ).toBe(100);
    expect(
      mediaUploadReducer(initialMediaUploadState, {
        type: "progress",
        value: -10,
      }).progress,
    ).toBe(0);
  });
});
