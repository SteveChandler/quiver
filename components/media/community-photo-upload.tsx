"use client";

import { useEffect, useId, useReducer, useState } from "react";
import { AlertCircle, Camera, CheckCircle2, Loader2, Upload } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import { COMMUNITY_PHOTO_TERMS_VERSION } from "@/lib/community-photos/contracts";
import type { ResolvedSpotPhoto } from "@/lib/community-photos";
import {
  COMMUNITY_PHOTO_ACCEPTED_MIME_TYPES,
  COMMUNITY_PHOTO_MAX_INPUT_BYTES,
} from "@/lib/community-photos/upload-constraints";
import {
  formatFileSize,
  validateCommunityPhotoFile,
} from "@/lib/media/upload-constraints";
import {
  initialMediaUploadState,
  mediaUploadReducer,
} from "@/lib/media/upload-state";
import { cn } from "@/lib/utils";

type CommunityPhotoTargetType = "beach" | "custom_spot";

interface CommunityPhotoUploadProps {
  targetType: CommunityPhotoTargetType;
  targetId: string;
  initialFile?: File | null;
  className?: string;
  onUploaded?: (photo: ResolvedSpotPhoto) => void;
}

interface CommunityPhotoUploadResponse {
  photo?: ResolvedSpotPhoto;
  code?: string;
  error?: string;
}

function errorMessageForResponse(payload: CommunityPhotoUploadResponse): string {
  const messages: Record<string, string> = {
    consent_required: "Confirm that you took this photo or have permission to share it.",
    feature_disabled: "Community photo uploads are paused right now.",
    image_too_large: `Images must be ${formatFileSize(COMMUNITY_PHOTO_MAX_INPUT_BYTES)} or smaller.`,
    invalid_image: "That image could not be processed. Try another photo.",
    rolling_upload_limit: "You have reached today's community upload limit.",
    target_active_limit: "You already have the maximum number of photos for this spot.",
    upload_in_progress: "That upload is still being processed. Try again in a moment.",
  };
  return (payload.code && messages[payload.code]) || payload.error || "Photo upload failed. Try again.";
}

function uploadCommunityPhotoRequest(
  file: File,
  fields: {
    targetType: CommunityPhotoTargetType;
    targetId: string;
    idempotencyKey: string;
  },
  onProgress: (progress: number) => void,
): Promise<ResolvedSpotPhoto> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("photo", file, file.name);
    formData.append("targetType", fields.targetType);
    formData.append("targetId", fields.targetId);
    formData.append("visibility", "public");
    formData.append("termsVersion", COMMUNITY_PHOTO_TERMS_VERSION);
    formData.append("rightsConfirmed", "true");
    formData.append("idempotencyKey", fields.idempotencyKey);

    request.open("POST", "/api/community-photos/upload");
    request.setRequestHeader("Idempotency-Key", fields.idempotencyKey);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress((event.loaded / event.total) * 100);
    });
    request.addEventListener("error", () => reject(new Error("network_error")));
    request.addEventListener("abort", () => reject(new Error("upload_aborted")));
    request.addEventListener("load", () => {
      let payload: CommunityPhotoUploadResponse = {};
      try {
        payload =
          typeof request.response === "object" && request.response
            ? request.response
            : JSON.parse(request.responseText || "{}");
      } catch {
        reject(new Error("upload_failed"));
        return;
      }

      if (request.status < 200 || request.status >= 300 || !payload.photo) {
        reject(new Error(errorMessageForResponse(payload)));
        return;
      }
      resolve(payload.photo);
    });
    request.responseType = "json";
    request.send(formData);
  });
}

export function CommunityPhotoUpload({
  targetType,
  targetId,
  initialFile = null,
  className,
  onUploaded,
}: CommunityPhotoUploadProps) {
  const { user } = useAuth();
  const inputId = useId();
  const headingId = useId();
  const [selectedFile, setSelectedFile] = useState<File | null>(initialFile);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [state, dispatch] = useReducer(
    mediaUploadReducer,
    initialMediaUploadState,
  );

  const busy = state.status === "uploading";

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(nextPreviewUrl);
    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [selectedFile]);

  if (!user) return null;

  const handleFileChange = (file: File | undefined): void => {
    if (!file) return;
    const validationError = validateCommunityPhotoFile(file);
    if (validationError) {
      dispatch({ type: "error", message: validationError });
      return;
    }
    setSelectedFile(file);
    dispatch({ type: "reset" });
  };

  const handleUpload = async (): Promise<void> => {
    if (!selectedFile) {
      dispatch({ type: "error", message: "Choose a photo first." });
      return;
    }
    if (!consent) {
      dispatch({
        type: "error",
        message: "Confirm that you took this photo or have permission to share it.",
      });
      return;
    }

    const validationError = validateCommunityPhotoFile(selectedFile);
    if (validationError) {
      dispatch({ type: "error", message: validationError });
      return;
    }

    try {
      dispatch({ type: "start-uploading" });
      const photo = await uploadCommunityPhotoRequest(
        selectedFile,
        {
          targetType,
          targetId,
          idempotencyKey: crypto.randomUUID(),
        },
        (progress) => dispatch({ type: "progress", value: progress }),
      );
      dispatch({ type: "pending-review" });
      onUploaded?.(photo);
    } catch (error) {
      dispatch({
        type: "error",
        message: error instanceof Error ? error.message : "Photo upload failed. Try again.",
      });
    }
  };

  const statusMessage =
    state.status === "uploading"
      ? `Uploading photo${state.progress > 0 ? ` — ${Math.round(state.progress)}%` : "…"}`
      : state.status === "pending-review"
        ? "Photo submitted. The community team can review it from the moderation queue."
        : state.status === "error"
          ? state.error
          : null;

  return (
    <section
      className={cn(
        "zine-tab torn torn-tb border-2 border-[var(--ink)] bg-[var(--paper)] text-[var(--ink)]",
        className,
      )}
      aria-labelledby={headingId}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#0B3A75]">
            Local proof
          </p>
          <h2
            id={headingId}
            className="mt-1 font-heading text-xl font-black uppercase tracking-tight"
          >
            Leave a spot photo
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-[#3F3A31]">
            Show the crew what this break looked like when you were here.
          </p>
        </div>
        <Camera className="h-7 w-7 text-[#0B3A75]" aria-hidden="true" />
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:items-start">
        <div className="relative aspect-[4/3] overflow-hidden border-2 border-[var(--ink)] bg-[#D9C49C]">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img src={previewUrl} alt="Selected community spot photo" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
              <Upload className="h-7 w-7 text-[#0B3A75]" aria-hidden="true" />
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]">
                Select a photo to preview
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor={inputId}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 border-2 border-[var(--ink)] bg-[#F4EBD8] px-4 py-2 font-mono text-xs font-black uppercase tracking-[0.1em] transition hover:bg-[#E5D4B3] focus-within:outline-none focus-within:ring-2 focus-within:ring-[#0B3A75] focus-within:ring-offset-2"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {selectedFile ? "Choose a different photo" : "Choose a photo"}
            </label>
            <input
              id={inputId}
              type="file"
              accept={COMMUNITY_PHOTO_ACCEPTED_MIME_TYPES.join(",")}
              className="sr-only"
              onChange={(event) => handleFileChange(event.target.files?.[0])}
              disabled={busy || state.status === "pending-review"}
            />
            <p className="mt-2 text-xs text-[#5F5646]">
              JPEG, PNG, WebP, HEIC, or HEIF · up to {formatFileSize(COMMUNITY_PHOTO_MAX_INPUT_BYTES)} · processed on upload
              {selectedFile ? ` · ${formatFileSize(selectedFile.size)}` : ""}
            </p>
          </div>

          <label className="flex min-h-11 items-start gap-3 text-sm leading-5">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              disabled={busy || state.status === "pending-review"}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#0B3A75]"
            />
            <span>
              I took this photo or have permission to share it with Quiver.
            </span>
          </label>

          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={busy || state.status === "pending-review"}
            className="inline-flex min-h-11 items-center justify-center gap-2 bg-ocean-blue px-4 py-2 font-mono text-xs font-black uppercase tracking-[0.1em] text-white transition hover:bg-ocean-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {state.status === "pending-review"
              ? "Submitted"
              : state.status === "error"
                ? "Try again"
                : "Share this photo"}
          </button>
        </div>
      </div>

      {state.status === "uploading" ? (
        <progress
          className="mt-4 h-2 w-full accent-[#0B3A75]"
          value={state.progress}
          max={100}
          aria-label="Community photo upload progress"
        />
      ) : null}

      {statusMessage ? (
        <p
          className={cn(
            "mt-4 flex items-start gap-2 text-sm leading-5",
            state.status === "error" ? "text-[#991B1B]" : "text-[#0B3A75]",
          )}
          role={state.status === "error" ? "alert" : undefined}
          aria-live="polite"
        >
          {state.status === "error" ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : state.status === "pending-review" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : null}
          <span>{statusMessage}</span>
        </p>
      ) : null}
    </section>
  );
}
