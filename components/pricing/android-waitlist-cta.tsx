"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { ReactElement, ReactNode } from "react";

import { joinAndroidWaitlist } from "@/actions/android-waitlist-actions";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { useAuth } from "@/context/auth-context";
import {
  trackAndroidWaitlistCtaClick,
  trackAndroidWaitlistCtaView,
} from "@/lib/analytics/android-waitlist-tracking";
import {
  ANDROID_WAITLIST_CTA,
  ANDROID_WAITLIST_STORAGE_KEY,
} from "@/lib/constants/android-waitlist";
import { cn } from "@/lib/utils";
import {
  safeGetItem,
  safeRemoveItem,
  safeSetItem,
} from "@/lib/utils/safe-storage";

interface AndroidWaitlistIntent {
  source: string;
  surface: string;
  placement: string;
}

interface StoredAndroidWaitlistIntent extends AndroidWaitlistIntent {
  created_at: string;
}

interface AndroidWaitlistCtaProps extends AndroidWaitlistIntent {
  className?: string;
  children?: ReactNode;
  successLabel?: string;
  onConfirmed?: (data: AndroidWaitlistConfirmation) => void;
  onClickTrack?: () => void;
}

interface AndroidWaitlistConfirmation {
  wants_android_access: true;
  android_waitlist_joined_at: string | null;
}

function parseStoredIntent(value: string | null): AndroidWaitlistIntent | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<StoredAndroidWaitlistIntent>;

    if (
      typeof parsed.source !== "string" ||
      typeof parsed.surface !== "string" ||
      typeof parsed.placement !== "string"
    ) {
      return null;
    }

    return {
      source: parsed.source,
      surface: parsed.surface,
      placement: parsed.placement,
    };
  } catch {
    return null;
  }
}

function storePendingIntent(intent: AndroidWaitlistIntent): void {
  safeSetItem(
    ANDROID_WAITLIST_STORAGE_KEY,
    JSON.stringify({
      ...intent,
      created_at: new Date().toISOString(),
    } satisfies StoredAndroidWaitlistIntent),
  );
}

export function AndroidWaitlistCta({
  source,
  surface,
  placement,
  className,
  children,
  successLabel = "Android waitlist joined",
  onConfirmed,
  onClickTrack,
}: AndroidWaitlistCtaProps): ReactElement {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hasTrackedView = useRef(false);
  const hasConfirmedIntent = useRef(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  const confirmIntent = useCallback(
    async (intent: AndroidWaitlistIntent): Promise<boolean> => {
      if (hasConfirmedIntent.current) return true;

      setStatus("saving");
      const result = await joinAndroidWaitlist(intent);

      if (result.success) {
        hasConfirmedIntent.current = true;
        setStatus("saved");
        onConfirmed?.({
          wants_android_access: true,
          android_waitlist_joined_at:
            result.data?.android_waitlist_joined_at ?? null,
        });
        return true;
      }

      setStatus("error");
      return false;
    },
    [onConfirmed],
  );

  useEffect(() => {
    if (isLoading || !user) return;

    const storedIntent = safeGetItem(ANDROID_WAITLIST_STORAGE_KEY);
    const pendingIntent = parseStoredIntent(storedIntent);
    if (!pendingIntent) {
      if (storedIntent) safeRemoveItem(ANDROID_WAITLIST_STORAGE_KEY);
      return;
    }

    safeRemoveItem(ANDROID_WAITLIST_STORAGE_KEY);
    void confirmIntent(pendingIntent).then((confirmed) => {
      if (!confirmed) storePendingIntent(pendingIntent);
    });
  }, [confirmIntent, isLoading, user]);

  useEffect(() => {
    const button = buttonRef.current;
    if (!button || hasTrackedView.current || isLoading) return;

    const trackView = (): void => {
      if (hasTrackedView.current) return;
      hasTrackedView.current = true;
      trackAndroidWaitlistCtaView({
        source,
        surface,
        placement,
        auth_state: user ? "authenticated" : "anonymous",
      });
    };

    if (typeof IntersectionObserver === "undefined") {
      trackView();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;

        trackView();
        observer.disconnect();
      },
      { threshold: 0.35 },
    );

    observer.observe(button);

    return () => observer.disconnect();
  }, [isLoading, placement, source, surface, user]);

  const handleClick = async (): Promise<void> => {
    if (isLoading || status === "saving" || status === "saved") return;

    const intent = { source, surface, placement };
    const authState = user ? "authenticated" : "anonymous";

    onClickTrack?.();

    trackAndroidWaitlistCtaClick({
      ...intent,
      auth_state: authState,
      profile_flag_requested: true,
    });

    if (!user) {
      storePendingIntent(intent);
      setAuthModalOpen(true);
      return;
    }

    await confirmIntent(intent);
  };

  const label =
    status === "saving"
      ? "Saving..."
      : status === "saved"
        ? successLabel
        : children ?? ANDROID_WAITLIST_CTA;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={cn(className, status === "error" && "border-red-300")}
        disabled={isLoading || status === "saving" || status === "saved"}
        onClick={handleClick}
        data-testid="android-waitlist-cta"
      >
        {label}
      </button>
      {status === "error" ? (
        <span className="sr-only" role="status">
          Could not save Android waitlist intent. Try again.
        </span>
      ) : null}
      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode="signup"
        source={source}
        returnTo={pathname || "/plans"}
        contextMessage={{
          title: "Join Android waitlist",
          description:
            "Create a free Quiver account so we can let you know when Android opens.",
        }}
      />
    </>
  );
}
