"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { isChunkLoadError } from "@/components/error-boundaries/utils/error-categorizer";

const STORAGE_KEY = "quiver:chunk_reload_count";
const MAX_RELOADS = 2;
const RESET_DELAY_MS = 60_000;

function getReloadCount(): number {
  try {
    return parseInt(sessionStorage.getItem(STORAGE_KEY) || "0", 10) || 0;
  } catch {
    return 0;
  }
}

function setReloadCount(count: number): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(count));
  } catch {
    // Storage unavailable — silently degrade
  }
}

function removeReloadCount(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable — silently degrade
  }
}

/**
 * Global handler that detects stale-chunk errors after Vercel deployments
 * and auto-reloads the page to fetch fresh assets.
 *
 * Includes a retry limit (MAX_RELOADS per session) to prevent infinite loops.
 * Resets the counter after RESET_DELAY_MS of no chunk errors.
 */
export function ChunkErrorHandler() {
  useEffect(() => {
    // Reset counter after a successful load (no chunk errors for RESET_DELAY_MS)
    const resetTimer = setTimeout(() => {
      removeReloadCount();
    }, RESET_DELAY_MS);

    function handleChunkError(error: Error) {
      const count = getReloadCount();
      if (count >= MAX_RELOADS) return;

      Sentry.captureException(error, {
        tags: {
          errorCategory: "chunk_load",
          chunk_reload_attempt: count + 1,
        },
      });

      // sessionStorage.setItem is synchronous — safe to reload immediately after
      setReloadCount(count + 1);
      window.location.reload();
    }

    function onError(event: ErrorEvent) {
      if (isChunkLoadError(event.error)) {
        handleChunkError(event.error);
      }
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      if (isChunkLoadError(event.reason)) {
        handleChunkError(event.reason);
      }
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      clearTimeout(resetTimer);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
