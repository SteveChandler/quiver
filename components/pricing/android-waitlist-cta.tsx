"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactElement, type ReactNode } from "react";

import { useAuth } from "@/context/auth-context";
import {
  trackAndroidWaitlistCtaClick,
  trackAndroidWaitlistCtaView,
} from "@/lib/analytics/android-waitlist-tracking";
import { ANDROID_BETA_LANDING_PATH } from "@/lib/constants/app-store";
import { ANDROID_WAITLIST_CTA } from "@/lib/constants/android-waitlist";
import { cn } from "@/lib/utils";

interface AndroidWaitlistCtaProps {
  source: string;
  surface: string;
  placement: string;
  className?: string;
  children?: ReactNode;
  onClickTrack?: () => void;
}

const HANDOFF_METADATA = {
  destination_type: "android_beta_handoff",
  destination_status: "guided_closed_test",
  destination_url: ANDROID_BETA_LANDING_PATH,
} as const;

export function AndroidWaitlistCta({
  source,
  surface,
  placement,
  className,
  children,
  onClickTrack,
}: AndroidWaitlistCtaProps): ReactElement {
  const { user, isLoading } = useAuth();
  const linkRef = useRef<HTMLAnchorElement>(null);
  const hasTrackedView = useRef(false);

  useEffect(() => {
    const link = linkRef.current;
    if (!link || hasTrackedView.current || isLoading) return;

    const trackView = (): void => {
      if (hasTrackedView.current) return;
      hasTrackedView.current = true;
      trackAndroidWaitlistCtaView({
        source,
        surface,
        placement,
        auth_state: user ? "authenticated" : "anonymous",
        ...HANDOFF_METADATA,
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

    observer.observe(link);
    return () => observer.disconnect();
  }, [isLoading, placement, source, surface, user]);

  function handleClick(): void {
    onClickTrack?.();
    trackAndroidWaitlistCtaClick({
      source,
      surface,
      placement,
      auth_state: user ? "authenticated" : "anonymous",
      ...HANDOFF_METADATA,
      profile_flag_requested: false,
    });
  }

  return (
    <Link
      ref={linkRef}
      href={ANDROID_BETA_LANDING_PATH}
      className={cn(className)}
      onClick={handleClick}
      data-testid="android-waitlist-cta"
    >
      {children ?? ANDROID_WAITLIST_CTA}
    </Link>
  );
}
