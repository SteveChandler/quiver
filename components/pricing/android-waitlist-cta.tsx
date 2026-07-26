"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";

import { useAuth } from "@/context/auth-context";
import {
  trackAndroidWaitlistCtaClick,
  trackAndroidWaitlistCtaView,
} from "@/lib/analytics/android-waitlist-tracking";
import { ANDROID_WAITLIST_CTA } from "@/lib/constants/android-waitlist";
import { buildAndroidBetaHandoffPath } from "@/lib/install-attribution";
import { cn } from "@/lib/utils";

interface AndroidWaitlistCtaProps {
  source: string;
  surface: string;
  placement: string;
  className?: string;
  children?: ReactNode;
  onClickTrack?: () => void;
}

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
  const handoffPath = buildAndroidBetaHandoffPath({
    source,
    surface,
    placement,
  });
  const handoffMetadata = useMemo(
    () =>
      ({
        destination_type: "android_beta_handoff",
        destination_status: "guided_closed_test",
        destination_url: handoffPath,
      }) as const,
    [handoffPath],
  );

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
        ...handoffMetadata,
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
  }, [handoffMetadata, isLoading, placement, source, surface, user]);

  function handleClick(): void {
    onClickTrack?.();
    trackAndroidWaitlistCtaClick({
      source,
      surface,
      placement,
      auth_state: user ? "authenticated" : "anonymous",
      ...handoffMetadata,
      profile_flag_requested: false,
    });
  }

  return (
    <Link
      ref={linkRef}
      href={handoffPath}
      className={cn(className)}
      onClick={handleClick}
      data-testid="android-waitlist-cta"
    >
      {children ?? ANDROID_WAITLIST_CTA}
    </Link>
  );
}
