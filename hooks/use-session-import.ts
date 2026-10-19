"use client";

import { importErrorCopy } from "@/components/garmin/import-error-copy";
import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ImportBeach } from "@/lib/sessions/imports/resolve-import-beach";

type ImportPhase = "idle" | "uploading" | "processing" | "needs_beach" | "done" | "error";

type ImportState = {
  phase: ImportPhase;
  sessionId?: string;
  candidates?: ImportBeach[];
  error?: string;
  attached?: boolean;
  waveCount?: number;
  beachName?: string;
  arrivalTime?: string;
  duplicateSessionId?: string;
};

type ImportResult =
  | { status: "completed"; sessionId: string; attached: boolean; summary: { waveCount: number } }
  | { status: "needs_beach"; importId: string; candidates: ImportBeach[] };

type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: { sessionId?: string } };

const GENERIC_ERROR_COPY = "Could not import this surf. Try again.";
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

class SessionImportError extends Error {
  constructor(code?: string, readonly sessionId?: string) {
    super(importErrorCopy(code, GENERIC_ERROR_COPY));
  }
}

function importFailure(cause: unknown): Pick<ImportState, "error" | "duplicateSessionId"> {
  if (!(cause instanceof SessionImportError)) return { error: GENERIC_ERROR_COPY };
  return { error: cause.message, duplicateSessionId: cause.sessionId };
}

function contentTypeFor(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "gpx") return "application/gpx+xml";
  if (extension === "zip") return "application/zip";
  return "application/octet-stream";
}

async function postImport<T>(url: string, body?: Record<string, string>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const result = await response.json().catch(() => null) as ApiEnvelope<T> | null;
  if (!response.ok || !result?.success) {
    const failure = result?.success === false ? result : null;
    const sessionId = failure?.error === "duplicate" && typeof failure.details?.sessionId === "string"
      ? failure.details.sessionId
      : undefined;
    throw new SessionImportError(failure?.error, sessionId);
  }
  return result.data;
}

export function useSessionImport(): {
  start: (file: File) => Promise<void>;
  state: ImportState;
  chooseBeach: (beachId: string) => Promise<void>;
} {
  const [state, setState] = useState<ImportState>({ phase: "idle" });
  const importIdRef = useRef<string | null>(null);

  const finish = useCallback(async (result: ImportResult): Promise<void> => {
    if (result.status === "needs_beach") {
      setState({ phase: "needs_beach", candidates: result.candidates });
      return;
    }

    let beachName: string | undefined;
    let arrivalTime: string | undefined;
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(result.sessionId)}`, { cache: "no-store" });
      if (response.ok) {
        const detail = await response.json();
        beachName = detail?.data?.session?.beach_name ?? detail?.data?.session?.beach?.name;
        arrivalTime = detail?.data?.session?.arrival_time;
      }
    } catch {
      // The import is complete even when its confirmation details are unavailable.
    }
    setState({
      phase: "done",
      sessionId: result.sessionId,
      attached: result.attached,
      waveCount: result.summary.waveCount,
      beachName,
      arrivalTime,
    });
  }, []);

  const start = useCallback(async (file: File): Promise<void> => {
    if (file.size > MAX_IMPORT_BYTES) {
      setState({ phase: "error", error: "This file is over 10 MB. Export just the one activity and try again." });
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["fit", "gpx", "zip"].includes(extension)) {
      setState({ phase: "error", error: importErrorCopy("unsupported_format") });
      return;
    }

    setState({ phase: "uploading" });
    try {
      const created = await postImport<{ importId: string; uploadPath: string; uploadToken: string }>(
        "/api/v1/session-imports", { filename: file.name },
      );
      importIdRef.current = created.importId;
      const { error } = await createClient().storage.from("session-tracks").uploadToSignedUrl(created.uploadPath, created.uploadToken, file, {
        contentType: contentTypeFor(file.name),
      });
      if (error) throw error;

      setState({ phase: "processing" });
      const result = await postImport<ImportResult>(`/api/v1/session-imports/${encodeURIComponent(created.importId)}/process`);
      await finish(result);
    } catch (error) {
      setState({ phase: "error", ...importFailure(error) });
    }
  }, [finish]);

  const chooseBeach = useCallback(async (beachId: string): Promise<void> => {
    const importId = importIdRef.current;
    if (!importId) return;
    const candidates = state.candidates ?? [];
    setState({ phase: "processing" });
    try {
      const result = await postImport<ImportResult>(
        `/api/v1/session-imports/${encodeURIComponent(importId)}/beach`, { beachId },
      );
      await finish(result);
    } catch (error) {
      setState({ phase: "needs_beach", candidates, ...importFailure(error) });
    }
  }, [finish, state.candidates]);

  return { start, state, chooseBeach };
}
