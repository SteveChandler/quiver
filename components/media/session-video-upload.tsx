"use client";

import { useId, useReducer, useState } from "react";
import { CheckCircle2, Film, Loader2, Upload } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  buildSessionVideoStoragePath,
  formatFileSize,
  getSessionVideoExtension,
  validateSessionVideoDuration,
  validateSessionVideoFile,
} from "@/lib/media/upload-constraints";
import {
  initialMediaUploadState,
  mediaUploadReducer,
} from "@/lib/media/upload-state";
import { cn } from "@/lib/utils";

interface SessionVideoUploadProps {
  sessionId: string;
  className?: string;
}

function probeVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      cleanup();
      resolve(duration);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("We couldn't read this video's duration. Try another file."));
    };
    video.src = objectUrl;
  });
}

async function finalizeSessionVideo(
  sessionId: string,
  storagePath: string,
  durationSec: number,
  sizeBytes: number,
): Promise<void> {
  const response = await fetch(`/api/sessions/${sessionId}/videos`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storagePath, durationSec, sizeBytes }),
  });
  if (response.ok) return;

  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  const messages: Record<string, string> = {
    too_long: "Videos must be 60 seconds or shorter.",
    too_large: "Videos must be 60 MB or smaller.",
    bad_type: "Choose an MP4 or MOV video.",
    bad_path: "That video could not be saved. Try choosing it again.",
  };
  throw new Error(messages[payload?.error ?? ""] ?? "Video upload could not be finalized. Try again.");
}

export function SessionVideoUpload({ sessionId, className }: SessionVideoUploadProps) {
  const { user } = useAuth();
  const inputId = useId();
  const headingId = useId();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, dispatch] = useReducer(
    mediaUploadReducer,
    initialMediaUploadState,
  );

  if (!user) return null;

  const busy = state.status === "transcoding" || state.status === "uploading";

  const handleFileChange = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    const fileError = validateSessionVideoFile(file);
    if (fileError) {
      setSelectedFile(null);
      setDurationSec(null);
      setError(fileError);
      dispatch({ type: "error", message: fileError });
      return;
    }

    setError(null);
    setSelectedFile(file);
    setDurationSec(null);
    dispatch({ type: "start-transcoding" });
    try {
      const duration = await probeVideoDuration(file);
      const durationError = validateSessionVideoDuration(duration);
      if (durationError) {
        setSelectedFile(null);
        setError(durationError);
        dispatch({ type: "error", message: durationError });
        return;
      }
      setDurationSec(duration);
      dispatch({ type: "reset" });
    } catch (probeError) {
      const message = probeError instanceof Error ? probeError.message : "We couldn't read this video's duration. Try another file.";
      setSelectedFile(null);
      setError(message);
      dispatch({ type: "error", message });
    }
  };

  const handleUpload = async (): Promise<void> => {
    if (!selectedFile || durationSec == null) {
      const message = "Choose a video that is 60 seconds or shorter.";
      setError(message);
      dispatch({ type: "error", message });
      return;
    }

    const fileError = validateSessionVideoFile(selectedFile);
    const durationError = validateSessionVideoDuration(durationSec);
    if (fileError || durationError) {
      const message = fileError ?? durationError ?? "Video selection is invalid.";
      setError(message);
      dispatch({ type: "error", message });
      return;
    }

    // Tracks an object that reached storage but has no session_media row yet.
    // Every attempt builds a fresh path (the builder appends a uuid), so without
    // this a failed finalize would strand a file up to 60 MB in a private bucket
    // with nothing referencing it and no retention job to reclaim it.
    let uploadedPath: string | null = null;
    const client = createClient();

    try {
      dispatch({ type: "start-uploading" });
      const extension = getSessionVideoExtension(selectedFile.name);
      if (!extension) throw new Error("Choose an MP4 or MOV video.");
      const storagePath = buildSessionVideoStoragePath(
        sessionId,
        user.id,
        selectedFile.name,
      );
      const { error: storageError } = await client
        .storage
        .from("session-videos")
        .upload(storagePath, selectedFile, {
          cacheControl: "3600",
          contentType: extension === "mp4" ? "video/mp4" : "video/quicktime",
          upsert: false,
        });
      if (storageError) throw new Error("Video could not be uploaded. Try again.");
      uploadedPath = storagePath;

      await finalizeSessionVideo(
        sessionId,
        storagePath,
        durationSec,
        selectedFile.size,
      );
      uploadedPath = null; // finalized — the row now owns the object
      dispatch({ type: "pending-review" });
      setError(null);
    } catch (uploadError) {
      if (uploadedPath) {
        // Best effort: never let cleanup failure mask the original error, and
        // never surface it to the user. A leftover object is recoverable; a
        // misleading message is not.
        try {
          await client.storage.from("session-videos").remove([uploadedPath]);
        } catch {
          /* orphan remains; the original upload error is what matters here */
        }
      }
      const message = uploadError instanceof Error ? uploadError.message : "Video upload failed. Try again.";
      setError(message);
      dispatch({ type: "error", message });
    }
  };

  return (
    <section
      className={cn(
        "zine-tab torn border-2 border-[var(--ink)] bg-[var(--paper)] text-[var(--ink)]",
        className,
      )}
      aria-labelledby={headingId}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#0B3A75]">
            One clean wave
          </p>
          <h2 id={headingId} className="mt-1 font-heading text-xl font-black uppercase tracking-tight">
            Add a session clip
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-[#3F3A31]">
            MP4 or MOV, up to 60 seconds and 60 MB. Clips stay private until a moderator approves them.
          </p>
        </div>
        <Film className="h-7 w-7 text-[#0B3A75]" aria-hidden="true" />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <label
          htmlFor={inputId}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 border-2 border-[var(--ink)] bg-[#F4EBD8] px-4 py-2 font-mono text-xs font-black uppercase tracking-[0.1em] transition hover:bg-[#E5D4B3] focus-within:outline-none focus-within:ring-2 focus-within:ring-[#0B3A75] focus-within:ring-offset-2"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          {selectedFile ? "Choose a different clip" : "Choose a clip"}
        </label>
        <input
          id={inputId}
          type="file"
          accept="video/mp4,video/quicktime,.mp4,.mov"
          className="sr-only"
          onChange={(event) => void handleFileChange(event.target.files?.[0])}
          disabled={busy || state.status === "pending-review"}
        />
        {selectedFile ? (
          <p className="text-xs text-[#5F5646]">
            {selectedFile.name} · {formatFileSize(selectedFile.size)}
            {durationSec != null ? ` · ${durationSec.toFixed(1)}s` : " · reading duration…"}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => void handleUpload()}
        disabled={busy || state.status === "pending-review" || !selectedFile || durationSec == null}
        className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 bg-ocean-blue px-4 py-2 font-mono text-xs font-black uppercase tracking-[0.1em] text-white transition hover:bg-ocean-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {state.status === "pending-review" ? "Submitted for review" : "Upload session clip"}
      </button>

      <p
        className={cn(
          "mt-4 text-sm leading-5",
          error ? "text-[#991B1B]" : "text-[#0B3A75]",
        )}
        aria-live="polite"
      >
        {state.status === "transcoding"
          ? "Reading the video's duration before upload…"
          : state.status === "uploading"
            ? "Uploading securely…"
            : state.status === "pending-review"
              ? "Your clip is pending moderation and is not public yet."
              : error ?? "Your clip will be saved under this session and your account."}
        {state.status === "pending-review" ? <CheckCircle2 className="ml-2 inline h-4 w-4" aria-hidden="true" /> : null}
      </p>
    </section>
  );
}
