"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ExternalLink, Link as LinkIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useTrackEvent } from "@/hooks/use-track-event";
import { useOnboardingStore } from "@/store/onboarding-store";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  IOS_TESTFLIGHT_BETA_CTA,
  IOS_TESTFLIGHT_BETA_URL,
} from "@/lib/constants/app-store";
import {
  APPLE_BETA_PROMPT_COOKIE,
  APPLE_BETA_PROMPT_COOKIE_VALUE,
  APPLE_BETA_PROMPT_PENDING_STORAGE_KEY,
  APPLE_BETA_PROMPT_SOURCE,
  getAppleBetaPromptDeviceMode,
  getAppleBetaPromptDismissedKey,
  classifyAppleBetaPromptPlatform,
  type AppleBetaPromptDeviceMode,
  type AppleBetaPromptPlatformGuess,
} from "@/lib/app-store/apple-beta-prompt";
import type { AppleBetaPromptMetadata } from "@/types/implicit-preferences";

export const APPLE_BETA_PROMPT_BODY_COPY =
  "Want to join the iOS beta? The app is better for surf alerts, quick checks and logging sessions after you paddle out.";

interface AppleBetaPromptProps {
  onPromptActivityChange?: (isActive: boolean) => void;
}

interface AppleBetaPromptDialogProps {
  open: boolean;
  deviceMode: AppleBetaPromptDeviceMode;
  onOpenChange: (open: boolean) => void;
  onOpenTestFlight: () => void;
  onCopyLink: () => void;
  onDismiss: () => void;
}

type AppleBetaPromptEvent =
  | "apple_beta_prompt_eligible"
  | "apple_beta_prompt_viewed"
  | "apple_beta_prompt_qr_rendered"
  | "apple_beta_prompt_open_testflight_clicked"
  | "apple_beta_prompt_copy_link_clicked"
  | "apple_beta_prompt_dismissed";

function getCookie(name: string): string | null {
  const cookie = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${name}=`));
  if (!cookie) return null;
  return decodeURIComponent(cookie.slice(name.length + 1));
}

function clearCookie(name: string): void {
  document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
}

function hasStorageValue(storage: Storage, key: string): boolean {
  try {
    return storage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function setStorageValue(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Storage is best-effort; losing it should not block auth or navigation.
  }
}

function removeStorageValue(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore private-browsing storage failures.
  }
}

export function AppleBetaPromptDialog({
  open,
  deviceMode,
  onOpenChange,
  onOpenTestFlight,
  onCopyLink,
  onDismiss,
}: AppleBetaPromptDialogProps) {
  const isDirectIos = deviceMode === "ios_direct";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="border-white/10 bg-[#111B46] text-white sm:max-w-[440px]"
        data-testid="apple-beta-prompt"
      >
        <DialogHeader className="space-y-3 text-left">
          <DialogTitle className="font-heading text-2xl text-white">
            Get Quiver on your iPhone
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-white/75">
            {APPLE_BETA_PROMPT_BODY_COPY}
          </DialogDescription>
        </DialogHeader>

        {!isDirectIos ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-white/10 bg-white p-4 text-center text-[#252D6B]">
            <QRCodeSVG
              data-testid="apple-beta-prompt-qr"
              value={IOS_TESTFLIGHT_BETA_URL}
              size={228}
              level="H"
              marginSize={4}
              bgColor="#FFFFFF"
              fgColor="#252D6B"
              imageSettings={{
                src: "/quiver-app-icon-128.png",
                width: 32,
                height: 32,
                excavate: true,
              }}
            />
            <p className="text-sm font-semibold">
              Scan with your iPhone camera
            </p>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-start sm:space-x-0">
          {isDirectIos ? (
            <Button
              asChild
              className="h-auto min-h-12 w-full whitespace-normal bg-[#F78E42] py-3 text-center leading-5 text-[#252D6B] hover:bg-[#FFAA63]"
            >
              <a
                href={IOS_TESTFLIGHT_BETA_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onOpenTestFlight}
              >
                <ExternalLink aria-hidden="true" />
                {IOS_TESTFLIGHT_BETA_CTA}
              </a>
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full bg-[#F78E42] text-[#252D6B] hover:bg-[#FFAA63]"
              onClick={onCopyLink}
            >
              <LinkIcon aria-hidden="true" />
              Copy beta link
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            className="w-full text-white/75 hover:bg-white/10 hover:text-white"
            onClick={onDismiss}
          >
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AppleBetaPrompt({
  onPromptActivityChange,
}: AppleBetaPromptProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const { track } = useTrackEvent();
  const onboardingOpen = useOnboardingStore((state) => state.isOpen);
  const [hasPendingPrompt, setHasPendingPrompt] = useState(false);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const viewedTrackedRef = useRef(false);
  const qrTrackedRef = useRef(false);
  const closeHandledRef = useRef(false);

  const device = useMemo(() => {
    if (typeof navigator === "undefined") {
      return {
        platformGuess: "unknown" as AppleBetaPromptPlatformGuess,
        deviceMode: "desktop_qr" as AppleBetaPromptDeviceMode,
      };
    }

    const platformGuess = classifyAppleBetaPromptPlatform(
      navigator.userAgent,
      navigator.maxTouchPoints
    );
    return {
      platformGuess,
      deviceMode: getAppleBetaPromptDeviceMode(platformGuess),
    };
  }, []);

  const dismissedKey = user?.id
    ? getAppleBetaPromptDismissedKey(user.id)
    : null;

  const isDismissed = useCallback((): boolean => {
    if (!dismissedKey || typeof window === "undefined") return false;
    return hasStorageValue(window.localStorage, dismissedKey);
  }, [dismissedKey]);

  const metadata = useMemo(
    (): AppleBetaPromptMetadata => ({
      provider: "apple",
      source: APPLE_BETA_PROMPT_SOURCE,
      device_mode: device.deviceMode,
      platform_guess: device.platformGuess,
      destination_url: IOS_TESTFLIGHT_BETA_URL,
      pathname,
    }),
    [device.deviceMode, device.platformGuess, pathname]
  );

  const trackPromptEvent = useCallback(
    (eventType: AppleBetaPromptEvent, extra: Record<string, unknown> = {}) => {
      void track(eventType, {
        metadata: {
          ...metadata,
          ...extra,
        } as AppleBetaPromptMetadata,
        debounceMs: 0,
      });
    },
    [metadata, track]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const cookieValue = getCookie(APPLE_BETA_PROMPT_COOKIE);
    if (cookieValue === APPLE_BETA_PROMPT_COOKIE_VALUE) {
      setStorageValue(
        window.sessionStorage,
        APPLE_BETA_PROMPT_PENDING_STORAGE_KEY,
        APPLE_BETA_PROMPT_COOKIE_VALUE
      );
      clearCookie(APPLE_BETA_PROMPT_COOKIE);
    }

    const pendingValue = window.sessionStorage.getItem(
      APPLE_BETA_PROMPT_PENDING_STORAGE_KEY
    );
    setHasPendingPrompt(pendingValue === APPLE_BETA_PROMPT_COOKIE_VALUE);
  }, []);

  useEffect(() => {
    if (!user || !hasPendingPrompt || typeof window === "undefined") return;

    if (isDismissed()) {
      removeStorageValue(
        window.sessionStorage,
        APPLE_BETA_PROMPT_PENDING_STORAGE_KEY
      );
      setHasPendingPrompt(false);
    }
  }, [hasPendingPrompt, isDismissed, user]);

  useEffect(() => {
    if (!user || !hasPendingPrompt || onboardingOpen || isDismissed()) return;

    const timeoutId = window.setTimeout(() => {
      closeHandledRef.current = false;
      setIsPromptOpen(true);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [hasPendingPrompt, isDismissed, onboardingOpen, user]);

  useEffect(() => {
    const hasActivity = hasPendingPrompt || isPromptOpen;
    const isActive = user ? !isDismissed() && hasActivity : hasActivity;
    onPromptActivityChange?.(isActive);
  }, [hasPendingPrompt, isDismissed, isPromptOpen, onPromptActivityChange, user]);

  useEffect(() => {
    if (!isPromptOpen || viewedTrackedRef.current) return;
    viewedTrackedRef.current = true;
    trackPromptEvent("apple_beta_prompt_viewed", {
      has_qr: device.deviceMode === "desktop_qr",
      testflight_url: IOS_TESTFLIGHT_BETA_URL,
    });
  }, [device.deviceMode, isPromptOpen, trackPromptEvent]);

  useEffect(() => {
    if (
      !isPromptOpen ||
      device.deviceMode !== "desktop_qr" ||
      qrTrackedRef.current
    ) {
      return;
    }

    qrTrackedRef.current = true;
    trackPromptEvent("apple_beta_prompt_qr_rendered", {
      qr_logo: "quiver-app-icon-128",
    });
  }, [device.deviceMode, isPromptOpen, trackPromptEvent]);

  const clearPendingState = useCallback(() => {
    if (typeof window === "undefined") return;
    removeStorageValue(
      window.sessionStorage,
      APPLE_BETA_PROMPT_PENDING_STORAGE_KEY
    );
    if (dismissedKey) {
      setStorageValue(window.localStorage, dismissedKey, new Date().toISOString());
    }
    setHasPendingPrompt(false);
  }, [dismissedKey]);

  const closePrompt = useCallback(
    (dismissReason: "not_now" | "dialog_close") => {
      if (closeHandledRef.current) return;
      closeHandledRef.current = true;
      trackPromptEvent("apple_beta_prompt_dismissed", {
        dismiss_reason: dismissReason,
      });
      clearPendingState();
      setIsPromptOpen(false);
    },
    [clearPendingState, trackPromptEvent]
  );

  const handleOpenTestFlight = useCallback(() => {
    trackPromptEvent("apple_beta_prompt_open_testflight_clicked");
    clearPendingState();
    setIsPromptOpen(false);
  }, [clearPendingState, trackPromptEvent]);

  const handleCopyLink = useCallback(async () => {
    trackPromptEvent("apple_beta_prompt_copy_link_clicked");
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(IOS_TESTFLIGHT_BETA_URL);
    } catch {
      toast({
        title: "Could not copy link",
        description: "Scan the QR code with your iPhone camera.",
      });
      return;
    }
    clearPendingState();
    setIsPromptOpen(false);
  }, [clearPendingState, trackPromptEvent]);

  if (!user || !hasPendingPrompt) return null;

  return (
    <AppleBetaPromptDialog
      open={isPromptOpen}
      deviceMode={device.deviceMode}
      onOpenChange={(open) => {
        if (!open) closePrompt("dialog_close");
      }}
      onOpenTestFlight={handleOpenTestFlight}
      onCopyLink={handleCopyLink}
      onDismiss={() => closePrompt("not_now")}
    />
  );
}
