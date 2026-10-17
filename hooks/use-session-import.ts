"use client";

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

const ERROR_COPY: Record<string, string> = {
  no_gps: "This file has no GPS track.",
  bad_time: "This file's date looks wrong.",
  unsupported_format: "Upload a .fit, .gpx or Garmin .zip file.",
  corrupt: "We couldn't read this file. Try exporting it again.",
  duplicate: "You've already uploaded this surf",
};

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
  const result = await response.json() as ApiEnvelope<T>;
  if (!response.ok || !result.success) {
    const failure = result as Extract<ApiEnvelope<T>, { success: false }>;
    const error = new Error(ERROR_COPY[failure.error] ?? "Could not import this surf. Try again.");
    Object.assign(error, { code: failure.error, sessionId: failure.details?.sessionId });
    throw error;
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

  const fail = useCallback((cause: unknown): void => {
    const error = cause instanceof Error ? cause : new Error("Could not import this surf. Try again.");
    setState({
      phase: "error",
      error: error.message,
      duplicateSessionId: "sessionId" in error && typeof error.sessionId === "string" ? error.sessionId : undefined,
    });
  }, []);

  const start = useCallback(async (file: File): Promise<void> => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["fit", "gpx", "zip"].includes(extension)) {
      setState({ phase: "error", error: ERROR_COPY.unsupported_format });
      return;
    }

    setState({ phase: "uploading" });
    try {
      const created = await postImport<{ importId: string; uploadPath: string }>(
        "/api/v1/session-imports", { filename: file.name },
      );
      importIdRef.current = created.importId;
      const { error } = await createClient().storage.from("session-tracks").upload(created.uploadPath, file, {
        contentType: contentTypeFor(file.name),
        upsert: false,
      });
      if (error) throw error;

      setState({ phase: "processing" });
      const result = await postImport<ImportResult>(`/api/v1/session-imports/${encodeURIComponent(created.importId)}/process`);
      await finish(result);
    } catch (error) {
      fail(error);
    }
  }, [fail, finish]);

  const chooseBeach = useCallback(async (beachId: string): Promise<void> => {
    const importId = importIdRef.current;
    if (!importId) return;
    setState({ phase: "processing" });
    try {
      const result = await postImport<ImportResult>(
        `/api/v1/session-imports/${encodeURIComponent(importId)}/beach`, { beachId },
      );
      await finish(result);
    } catch (error) {
      fail(error);
    }
  }, [fail, finish]);

  return { start, state, chooseBeach };
}
