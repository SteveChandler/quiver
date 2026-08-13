type MediaUploadStatus =
  | "idle"
  | "transcoding"
  | "uploading"
  | "pending-review"
  | "error";

interface MediaUploadState {
  status: MediaUploadStatus;
  progress: number;
  error: string | null;
}

export const initialMediaUploadState: MediaUploadState = {
  status: "idle",
  progress: 0,
  error: null,
};

type MediaUploadAction =
  | { type: "start-transcoding" }
  | { type: "start-uploading" }
  | { type: "progress"; value: number }
  | { type: "pending-review" }
  | { type: "error"; message: string }
  | { type: "reset" };

export function mediaUploadReducer(
  state: MediaUploadState,
  action: MediaUploadAction,
): MediaUploadState {
  switch (action.type) {
    case "start-transcoding":
      return { status: "transcoding", progress: 0, error: null };
    case "start-uploading":
      return { status: "uploading", progress: 0, error: null };
    case "progress":
      return {
        ...state,
        status: "uploading",
        progress: Math.min(100, Math.max(0, action.value)),
        error: null,
      };
    case "pending-review":
      return { status: "pending-review", progress: 100, error: null };
    case "error":
      return { status: "error", progress: 0, error: action.message };
    case "reset":
      return initialMediaUploadState;
    default:
      return state;
  }
}
