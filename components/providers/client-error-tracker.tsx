"use client";

/**
 * ClientErrorTracker
 *
 * Captures uncaught browser errors and unhandled promise rejections and
 * emits them as `client_error` events via the implicit-events pipeline.
 *
 * Purpose: correlation with other event stream data (e.g. retention, funnel
 * analysis). Sentry is the source of truth for stack traces and alerting —
 * this tracker intentionally does NOT suppress Sentry and vice versa.
 *
 * Rate limiting: capped at 10 events per 10s rolling window per mount.
 * Prevents an infinite-render-loop bug from DDOSing the events endpoint.
 */

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { useTrackEvent } from "@/hooks/use-track-event";
import type { ClientErrorMetadata } from "@/types/implicit-preferences";

const MAX_MESSAGE_LENGTH = 200;
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_EVENTS = 10;
const IGNORED_UNHANDLED_REJECTION_MESSAGES = new Set([
  "Error: WKWebView API client did not respond to this postMessage",
]);
const IGNORED_UNHANDLED_REJECTION_PATTERNS = [
  /^Error: Server Action "[a-f0-9]+" was not found on the server\./,
  /^UnrecognizedActionError: Server Action "[a-f0-9]+" was not found on the server\./,
  /^String: Object Not Found Matching Id:\d+, MethodName:update, ParamCount:\d+$/,
];

// Module-scoped so the window survives React strict-mode double-effect runs.
const recentErrorTimestamps: number[] = [];

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// Replace UUID-shaped path segments with [id] so errors captured on pages
// like /user/<uuid> don't leak that other user's identifier into telemetry.
function sanitizeRoute(pathname: string): string {
  return pathname.replace(UUID_RE, "[id]");
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) : str;
}

function firstStackFrame(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  const lines = stack.split("\n").map((l) => l.trim()).filter(Boolean);
  // Skip the error message line; take the first actual frame
  const frame = lines.find((l) => l.startsWith("at "));
  return frame ? truncate(frame, MAX_MESSAGE_LENGTH) : undefined;
}

function shouldEmit(now: number): boolean {
  // Drop timestamps outside the rolling window
  while (
    recentErrorTimestamps.length > 0 &&
    now - recentErrorTimestamps[0] > RATE_LIMIT_WINDOW_MS
  ) {
    recentErrorTimestamps.shift();
  }
  if (recentErrorTimestamps.length >= RATE_LIMIT_MAX_EVENTS) return false;
  recentErrorTimestamps.push(now);
  return true;
}

function shouldIgnoreClientError(metadata: ClientErrorMetadata): boolean {
  if (
    metadata.source === "window_onerror" &&
    metadata.message === "Error: Script error."
  ) {
    return true;
  }

  return (
    metadata.source === "unhandled_rejection" &&
    (IGNORED_UNHANDLED_REJECTION_MESSAGES.has(metadata.message) ||
      IGNORED_UNHANDLED_REJECTION_PATTERNS.some((pattern) =>
        pattern.test(metadata.message)
      ))
  );
}

export function ClientErrorTracker(): null {
  const { track } = useTrackEvent();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const emit = (error: unknown, metadata: ClientErrorMetadata) => {
      if (shouldIgnoreClientError(metadata)) return;
      if (!shouldEmit(Date.now())) return;
      try {
        Sentry.captureException(
          error instanceof Error ? error : new Error(metadata.message),
          {
            tags: { client_error_source: metadata.source },
            extra: {
              route: metadata.route,
              stack_top_frame: metadata.stack_top_frame ?? null,
            },
          },
        );
      } catch {
        // Error capture must not interfere with the browser's native handler.
      }
      // Fire-and-forget; useTrackEvent already swallows errors.
      void track("client_error", { metadata });
    };

    const handleError = (event: ErrorEvent) => {
      const errorClass = event.error?.name || "Error";
      const errorMessage =
        event.error?.message || event.message || "Unknown error";
      const combined = truncate(
        `${errorClass}: ${errorMessage}`,
        MAX_MESSAGE_LENGTH
      );

      emit(event.error, {
        message: combined,
        stack_top_frame: firstStackFrame(event.error?.stack),
        // eslint-disable-next-line no-restricted-properties -- error tracker runs outside React, cannot use useRouter/usePathname
        route: sanitizeRoute(window.location.pathname),
        source: "window_onerror",
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const errorClass =
        reason?.name ||
        (typeof reason === "string" ? "String" : "UnhandledRejection");
      const errorMessage =
        reason?.message ||
        (typeof reason === "string" ? reason : "Unknown rejection");
      const combined = truncate(
        `${errorClass}: ${errorMessage}`,
        MAX_MESSAGE_LENGTH
      );

      emit(reason, {
        message: combined,
        stack_top_frame: firstStackFrame(reason?.stack),
        // eslint-disable-next-line no-restricted-properties -- error tracker runs outside React, cannot use useRouter/usePathname
        route: sanitizeRoute(window.location.pathname),
        source: "unhandled_rejection",
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, [track]);

  return null;
}
