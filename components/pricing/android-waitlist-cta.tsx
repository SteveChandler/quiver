"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { ReactElement, ReactNode } from "react";

import { joinAndroidWaitlist } from "@/actions/android-waitlist-actions";
import { useAuth } from "@/context/auth-context";
import {
  trackAndroidWaitlistCtaClick,
  trackAndroidWaitlistCtaView,
} from "@/lib/analytics/android-waitlist-tracking";
import {
  ANDROID_BETA_GROUP_URL,
  ANDROID_BETA_PLAY_URL,
} from "@/lib/constants/app-store";
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
import { getVisitorId } from "@/lib/utils/visitor-id";

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

function AndroidBetaSuccessPanel(): ReactElement {
  return (
    <div
      className="rounded-md border border-[#11100D]/20 bg-[#FBF6E8] p-3 font-sans text-sm text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.16)] sm:basis-full"
      role="status"
    >
      <p className="font-heading text-base font-bold text-[#252D6B]">
        You are in. Keep this page open for the steps.
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-[#11100D]/75">
        <li>Join the Quiver Android tester group with your Google Play account.</li>
        <li>Opt in on Google Play after the group accepts your account.</li>
        <li>Install Quiver and test for 14 days to earn a free year of Pro.</li>
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={ANDROID_BETA_GROUP_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-[#F78E42] px-4 py-2 font-heading text-sm font-bold text-[#11100D] transition hover:bg-[#ff9f55] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF6E8]"
        >
          Join tester group
        </a>
        {ANDROID_BETA_PLAY_URL ? (
          <a
            href={ANDROID_BETA_PLAY_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-[#11100D]/25 px-4 py-2 font-heading text-sm font-bold text-[#11100D] transition hover:bg-[#11100D]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#252D6B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF6E8]"
          >
            Opt in on Play
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function AndroidWaitlistCta({
  source,
  surface,
  placement,
  className,
  children,
  successLabel = "Android beta access set",
  onConfirmed,
  onClickTrack,
}: AndroidWaitlistCtaProps): ReactElement {
  const { user, isLoading } = useAuth();
  const emailInputId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hasTrackedView = useRef(false);
  const hasConfirmedIntent = useRef(false);
  const [email, setEmail] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
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
      return;
    }

    await confirmIntent(intent);
  };

  const handleAnonymousSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (isLoading || status === "saving") return;

    const normalizedEmail = email.trim().toLowerCase();
    const intent = { source, surface, placement };

    setInlineError(null);
    setStatus("saving");
    onClickTrack?.();

    trackAndroidWaitlistCtaClick({
      ...intent,
      auth_state: "anonymous",
      destination_type: "lead_capture",
      destination_status: "email_captured",
      profile_flag_requested: false,
    });

    try {
      const response = await fetch("/api/android-beta/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          sessionId: getVisitorId(),
          ...intent,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !result?.success) {
        setInlineError(
          result?.error === "invalid_email"
            ? "Enter a valid email address."
            : "Could not save your email. Try again.",
        );
        setStatus("error");
        return;
      }

      setStatus("saved");
    } catch {
      setInlineError("Could not save your email. Try again.");
      setStatus("error");
    }
  };

  const label =
    status === "saving"
      ? "Saving..."
      : status === "saved"
        ? successLabel
        : children ?? ANDROID_WAITLIST_CTA;

  if (!isLoading && !user) {
    if (status === "saved") {
      return (
        <div className="flex w-full min-w-0 flex-col gap-3 sm:max-w-xl">
          <AndroidBetaSuccessPanel />
        </div>
      );
    }

    return (
      <form
        onSubmit={handleAnonymousSubmit}
        className="flex w-full min-w-0 flex-col gap-2 sm:max-w-xl sm:flex-row"
        data-testid="android-waitlist-email-form"
        noValidate
      >
        <label className="sr-only" htmlFor={emailInputId}>
          Email for Android beta access
        </label>
        <input
          id={emailInputId}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (inlineError) setInlineError(null);
            if (status === "error") setStatus("idle");
          }}
          placeholder="you@email.com"
          className="min-h-12 min-w-0 flex-1 rounded-md border border-white/25 bg-white px-3 font-sans text-base font-semibold text-[#11100D] placeholder:text-[#11100D]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7BDCB5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1020]"
          aria-describedby={inlineError ? `${emailInputId}-error` : undefined}
        />
        <button
          ref={buttonRef}
          type="submit"
          className={cn(className, status === "error" && "border-red-300")}
          disabled={status === "saving"}
          data-testid="android-waitlist-cta"
        >
          {status === "saving" ? "Saving..." : ANDROID_WAITLIST_CTA}
        </button>
        <p className="rounded-md bg-[#FBF6E8]/95 px-3 py-2 text-xs font-semibold text-[#11100D]/70 sm:basis-full">
          Getting in takes 3 quick steps: join the tester group, opt in on
          Play, then install.
        </p>
        {inlineError ? (
          <p
            id={`${emailInputId}-error`}
            className="text-sm font-semibold text-[#F78E42] sm:basis-full"
            role="alert"
          >
            {inlineError}
          </p>
        ) : null}
      </form>
    );
  }

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
          Could not save Android beta intent. Try again.
        </span>
      ) : null}
      {status === "saved" ? <AndroidBetaSuccessPanel /> : null}
    </>
  );
}
