"use client";

import { useState, useEffect, useCallback } from "react";
import { track } from "@/lib/analytics";

const STORAGE_KEY_PREFIX = "quiver_dismissed_";

/**
 * Sanitizes a key string to ensure it's safe for localStorage usage.
 * Replaces any non-alphanumeric characters (except hyphen and underscore) with underscore.
 */
function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9-_]/g, "_");
}

/**
 * Validates that a timestamp string is a valid ISO date and returns the Date object.
 * Returns null if invalid.
 */
function parseValidTimestamp(timestamp: unknown): Date | null {
  if (typeof timestamp !== "string") return null;

  const date = new Date(timestamp);
  // Check if date is valid (not NaN)
  if (isNaN(date.getTime())) return null;

  // Sanity check: date should be in the past and not too far back
  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  if (date > now || date < oneYearAgo) return null;

  return date;
}

interface UsePersistedDismissalOptions {
  /** Duration in days before the dismissal expires */
  durationDays?: number;
  /** Analytics event name to track on dismiss (optional) */
  trackingEvent?: string;
  /** Additional tracking properties (optional) */
  trackingProps?: Record<string, unknown>;
}

interface UsePersistedDismissalResult {
  /** Whether the item is currently dismissed */
  isDismissed: boolean;
  /** Call this to dismiss the item */
  handleDismiss: () => void;
  /** Call this to clear the dismissal (e.g., for testing or reset) */
  clearDismissal: () => void;
}

/**
 * Hook to manage persisted dismissal state with localStorage.
 *
 * Features:
 * - Validates stored timestamps to handle corrupted data
 * - Sanitizes storage keys to prevent injection
 * - Automatic expiration after specified duration
 * - Optional analytics tracking on dismiss
 * - Graceful fallback when localStorage is unavailable
 *
 * @param key - Unique identifier for this dismissible item
 * @param options - Configuration options
 * @returns Dismissal state and handlers
 *
 * @example
 * ```tsx
 * const { isDismissed, handleDismiss } = usePersistedDismissal("signup-bar", {
 *   durationDays: 7,
 *   trackingEvent: "signup_cta_dismiss",
 *   trackingProps: { source: "forecast-hub" }
 * });
 *
 * if (isDismissed) return null;
 *
 * return <Banner onDismiss={handleDismiss} />;
 * ```
 */
export function usePersistedDismissal(
  key: string,
  options: UsePersistedDismissalOptions = {}
): UsePersistedDismissalResult {
  const {
    durationDays = 7,
    trackingEvent,
    trackingProps,
  } = options;

  // Start as dismissed until we verify localStorage state
  const [isDismissed, setIsDismissed] = useState(true);

  const storageKey = `${STORAGE_KEY_PREFIX}${sanitizeKey(key)}`;

  // Check localStorage for dismissal state on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(storageKey);

      if (!stored) {
        // No stored value - not dismissed
        setIsDismissed(false);
        return;
      }

      // Parse and validate stored data
      let data: unknown;
      try {
        data = JSON.parse(stored);
      } catch {
        // Invalid JSON - clear and show
        localStorage.removeItem(storageKey);
        setIsDismissed(false);
        return;
      }

      // Validate timestamp
      const timestamp = (data as { timestamp?: unknown })?.timestamp;
      const dismissedDate = parseValidTimestamp(timestamp);

      if (!dismissedDate) {
        // Invalid timestamp - clear and show
        localStorage.removeItem(storageKey);
        setIsDismissed(false);
        return;
      }

      // Check if dismissal has expired
      const now = new Date();
      const daysSinceDismiss =
        (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceDismiss >= durationDays) {
        // Expired - clear and show
        localStorage.removeItem(storageKey);
        setIsDismissed(false);
        return;
      }

      // Still within dismissal period - keep dismissed
      setIsDismissed(true);
    } catch (error) {
      // localStorage not available - show the item
      console.warn("localStorage not available:", error);
      setIsDismissed(false);
    }
  }, [storageKey, durationDays]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);

    // Track dismissal if configured
    if (trackingEvent) {
      track(trackingEvent, trackingProps || {});
    }

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ timestamp: new Date().toISOString() })
        );
      } catch (error) {
        console.warn("localStorage not available:", error);
      }
    }
  }, [storageKey, trackingEvent, trackingProps]);

  const clearDismissal = useCallback(() => {
    setIsDismissed(false);

    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(storageKey);
      } catch (error) {
        console.warn("localStorage not available:", error);
      }
    }
  }, [storageKey]);

  return {
    isDismissed,
    handleDismiss,
    clearDismissal,
  };
}

