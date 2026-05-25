"use client";

import Link from "next/link";
import { useCallback } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { AndroidWaitlistCta } from "@/components/pricing/android-waitlist-cta";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { useProfileContext } from "@/context/profile-context";
import { ANDROID_WAITLIST_CTA } from "@/lib/constants/android-waitlist";
import { cn } from "@/lib/utils";

interface FoundingAccessCtaProps {
  className?: string;
  source?: string;
  surface?: string;
  variant?: "default" | "compact";
}

export function FoundingAccessCta({
  className,
  source = "plans-android-waitlist",
  surface = "plans-page",
  variant = "default",
}: FoundingAccessCtaProps) {
  const { user, isLoading } = useAuth();
  const { profile, refreshProfile } = useProfileContext();
  const isCompact = variant === "compact";
  const hasJoinedAndroidWaitlist = Boolean(
    (profile as { wants_android_access?: boolean | null } | null)
      ?.wants_android_access,
  );
  const refreshAndroidWaitlistStatus = useCallback(() => {
    void refreshProfile();
  }, [refreshProfile]);

  if (!isLoading && user) {
    if (isCompact) {
      return (
        <div
          className={cn(
            "flex gap-2 rounded-md border border-[#11100D]/15 bg-[#F4EBD8] p-3 text-left",
            className,
          )}
          data-testid="founding-access-signed-in-state"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#252D6B]" />
          <div>
            <p className="text-sm font-semibold text-[#11100D]">
              You&apos;re signed in.
            </p>
            <p className="mt-1 text-xs leading-5 text-[#4B4030]">
              {hasJoinedAndroidWaitlist
                ? "Android updates are set for this account."
                : "Confirm this account for launch updates."}
            </p>
            {hasJoinedAndroidWaitlist ? null : (
              <AndroidWaitlistCta
                source={source}
                surface={surface}
                placement="plans_compact_signed_in"
                successLabel="Android updates are set."
                onConfirmed={refreshAndroidWaitlistStatus}
                className="mt-3 inline-flex min-h-10 items-center justify-center rounded-full bg-[#F78E42] px-4 text-sm font-semibold text-[#11100D] hover:bg-[#ff9f55] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4EBD8]"
              >
                {ANDROID_WAITLIST_CTA}
              </AndroidWaitlistCta>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        className={cn(
          "flex flex-col gap-4 rounded-lg border border-white/12 bg-white/[0.04] p-4 text-left",
          className,
        )}
        data-testid="founding-access-signed-in-state"
      >
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#7BDCB5]" />
          <div>
            <p className="font-semibold text-white">You&apos;re signed in.</p>
            <p className="mt-1 text-sm leading-6 text-white/65">
              {hasJoinedAndroidWaitlist
                ? "Android updates are set for this account."
                : "Confirm this account for Android launch updates."}
            </p>
          </div>
        </div>
        {hasJoinedAndroidWaitlist ? null : (
          <AndroidWaitlistCta
            source={source}
            surface={surface}
            placement="plans_signed_in"
            successLabel="Android updates are set."
            onConfirmed={refreshAndroidWaitlistStatus}
            className="inline-flex min-h-10 self-start items-center justify-center rounded-full bg-[#F78E42] px-5 text-sm font-semibold text-[#11100D] hover:bg-[#ff9f55] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1020]"
          >
            {ANDROID_WAITLIST_CTA}
          </AndroidWaitlistCta>
        )}
        <Button
          asChild
          variant="outline"
          className="self-start rounded-full border-white/15 bg-transparent px-5 text-white hover:bg-white/10 hover:text-white"
        >
          <Link href="/map">Open Quiver</Link>
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3",
        isCompact && "gap-2",
        className,
      )}
    >
      <AndroidWaitlistCta
        source={source}
        surface={surface}
        placement={isCompact ? "plans_compact" : "plans_primary"}
        successLabel="Android updates are set."
        onConfirmed={refreshAndroidWaitlistStatus}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full bg-[#F78E42] font-semibold text-[#11100D] hover:bg-[#ff9f55] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]",
          isCompact
            ? "min-h-10 self-start px-4 text-sm focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4EBD8]"
            : "min-h-11 px-6 text-sm focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1020]",
        )}
      >
        {ANDROID_WAITLIST_CTA}
        <ArrowRight className="h-4 w-4" />
      </AndroidWaitlistCta>
      <p
        className={cn(
          "leading-6",
          isCompact ? "text-xs text-[#4B4030]" : "text-sm text-white/55",
        )}
      >
        We&apos;ll send Android launch updates.
      </p>
    </div>
  );
}
