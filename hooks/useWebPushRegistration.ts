"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { useToast } from "@/hooks/use-toast";
import {
  registerWebPushNotifications,
  checkNotificationPermissions,
} from "@/lib/web/push-notifications";
import { track } from "@/lib/analytics";

const WEB_PUSH_REGISTRATION_FLAG = "quiver-web-push-registered";

export type WebPushState =
  | "idle"
  | "pending"
  | "granted"
  | "denied"
  | "unsupported"
  | "error";

interface WebPushResult {
  status: WebPushState;
  detail?: string;
}

function rememberGrant() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WEB_PUSH_REGISTRATION_FLAG, "granted");
}

function hasGrantedPreviously(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(WEB_PUSH_REGISTRATION_FLAG) === "granted";
}

function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "Notification" in window && "serviceWorker" in navigator;
}

/**
 * Hook for web/PWA push notification registration
 * Mirrors the API of useNativePushRegistration but for web browsers
 */
export function useWebPushRegistration() {
  const { toast } = useToast();
  const [status, setStatus] = useState<WebPushState>("idle");
  const [error, setError] = useState<string | null>(null);
  // Guard against StrictMode double-mount causing duplicate API calls
  const isRequestingRef = useRef(false);

  const canPrompt = useMemo(() => {
    if (typeof window === "undefined") return false;
    // Check browser support
    if (!isPushSupported()) return false;
    // Don't show if we're already in a pending/completed state
    if (status === "pending" || status === "granted" || status === "denied") {
      return false;
    }
    // Don't prompt if already registered
    if (hasGrantedPreviously()) return false;
    // Check if permission was already denied at browser level
    if (Notification.permission === "denied") return false;
    return true;
  }, [status]);

  const isSupported = useMemo(() => {
    if (typeof window === "undefined") return false;
    return isPushSupported();
  }, []);

  const currentPermission = useMemo(() => {
    return checkNotificationPermissions();
  }, []);

  const requestPushOptIn = useCallback(async (): Promise<WebPushResult> => {
    if (typeof window === "undefined") {
      return { status: "unsupported" };
    }

    // Check browser support
    if (!isPushSupported()) {
      setStatus("unsupported");
      return { status: "unsupported", detail: "Push notifications not supported in this browser" };
    }

    // If already registered, return early
    if (hasGrantedPreviously() && Notification.permission === "granted") {
      setStatus("granted");
      return { status: "granted" };
    }

    // Check if permission was already denied
    if (Notification.permission === "denied") {
      setStatus("denied");
      return { status: "denied", detail: "Permission previously denied" };
    }

    // Prevent duplicate requests (StrictMode double-mount)
    if (isRequestingRef.current) {
      return { status: "pending" };
    }
    isRequestingRef.current = true;

    setStatus("pending");
    setError(null);
    track("web_push_opt_in_attempt", {
      platform: "web",
    });

    try {
      // Request permission and register for push
      await registerWebPushNotifications();

      // Check the result - type assertion needed because Notification.permission
      // can change between the early check and here
      const permission = Notification.permission as NotificationPermission;
      isRequestingRef.current = false;

      switch (permission) {
        case "granted":
          setStatus("granted");
          rememberGrant();
          toast({ title: "Push notifications enabled ⚡" });
          track("web_push_opt_in_success", { platform: "web" });
          return { status: "granted" };

        case "denied":
          setStatus("denied");
          toast({
            title: "Push notifications blocked",
            description: "You can enable them in your browser settings.",
          });
          track("web_push_opt_in_denied", { platform: "web" });
          return { status: "denied" };

        default:
          // Permission is still "default" - user dismissed the prompt
          setStatus("idle");
          return { status: "idle", detail: "User dismissed prompt" };
      }
    } catch (err) {
      setStatus("error");
      const message = err instanceof Error ? err.message : "Push notification setup failed";
      setError(message);
      toast({
        title: "Couldn't enable push notifications",
        description: message,
        variant: "destructive",
      });
      track("web_push_opt_in_error", {
        platform: "web",
        error: message,
      });
      isRequestingRef.current = false;
      return { status: "error", detail: message };
    }
  }, [toast]);

  return {
    status,
    error,
    canPrompt,
    isSupported,
    currentPermission: currentPermission.status,
    platform: "web" as const,
    requestPushOptIn,
  };
}
