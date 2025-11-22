"use client";

import { useCallback, useMemo, useState } from "react";

import { registerPushDevice } from "@/actions/mobile-actions";
import { useToast } from "@/hooks/use-toast";
import {
  ensurePushRegistration,
  type PushRegistrationResult,
} from "@/lib/mobile/push-client";
import { getNativePlatform, isNativeApp } from "@/lib/mobile/platform";
import { track } from "@/lib/analytics";

const REGISTRATION_FLAG = "quiver-push-device-registered";

export type PushOptInState =
  | "idle"
  | "pending"
  | "granted"
  | "denied"
  | "unsupported"
  | "error";

interface PushOptInResult {
  status: PushOptInState;
  detail?: string;
}

function rememberGrant() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REGISTRATION_FLAG, "granted");
}

function hasGrantedPreviously(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(REGISTRATION_FLAG) === "granted";
}

export function useNativePushRegistration() {
  const { toast } = useToast();
  const [status, setStatus] = useState<PushOptInState>("idle");
  const [error, setError] = useState<string | null>(null);

  const canPrompt = useMemo(() => {
    if (typeof window === "undefined") return false;
    if (!isNativeApp()) return false;
    if (status === "pending" || status === "granted" || status === "denied") {
      return false;
    }
    return !hasGrantedPreviously();
  }, [status]);

  const requestPushOptIn = useCallback(async (): Promise<PushOptInResult> => {
    if (typeof window === "undefined") {
      return { status: "unsupported" };
    }

    if (!isNativeApp()) {
      setStatus("unsupported");
      return { status: "unsupported" };
    }

    if (hasGrantedPreviously()) {
      setStatus("granted");
      return { status: "granted" };
    }

    setStatus("pending");
    setError(null);
    track("push_opt_in_attempt", {
      platform: getNativePlatform(),
    });

    const result: PushRegistrationResult = await ensurePushRegistration({
      onRegister: async ({ token, platform }) => {
        const response = await registerPushDevice({
          token,
          platform,
          appVersion: process.env.NEXT_PUBLIC_APP_VERSION,
          device:
            typeof navigator !== "undefined"
              ? navigator.userAgent.slice(0, 120)
              : undefined,
        });

        if (!response.success) {
          throw new Error(response.error || "Failed to persist push token");
        }

        rememberGrant();
      },
      onError: (err) => {
        console.error("Push registration error", err);
        track("push_opt_in_error", {
          platform: getNativePlatform(),
          error: err instanceof Error ? err.message : String(err),
        });
      },
    });

    if (result.status === "granted") {
      setStatus("granted");
      toast({ title: "Push notifications ready ⚡" });
      track("push_opt_in_success", {
        platform: getNativePlatform(),
      });
      return { status: "granted" };
    }

    if (result.status === "denied") {
      setStatus("denied");
      toast({
        title: "Push notifications disabled",
        description: "You can enable alerts later from Settings.",
      });
      track("push_opt_in_denied", {
        platform: getNativePlatform(),
        reason: result.reason,
      });
      return { status: "denied", detail: result.reason };
    }

    if (result.status === "unsupported") {
      setStatus("unsupported");
      track("push_opt_in_unsupported", {
        platform: getNativePlatform(),
      });
      return { status: "unsupported" };
    }

    setStatus("error");
    const message = result.error || "Push notification setup failed";
    setError(message);
    toast({
      title: "Couldn't enable push notifications",
      description: message,
      variant: "destructive",
    });
    track("push_opt_in_error", {
      platform: getNativePlatform(),
      error: message,
    });
    return { status: "error", detail: message };
  }, [toast]);

  return {
    status,
    error,
    canPrompt,
    platform: typeof window !== "undefined" ? getNativePlatform() : "web",
    requestPushOptIn,
  };
}
