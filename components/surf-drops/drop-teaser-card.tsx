"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useTrackEvent } from "@/hooks/use-track-event";
import { ZineSurface } from "@/components/zine";
import { SonarPing } from "@/components/surf-drops/sonar-ping";
import type { SurfDropTeaser } from "@/types/surf-drops";
import { formatSurfDropWindow } from "@/lib/surf-drops/format";

interface DropTeaserCardProps {
  teaser: SurfDropTeaser;
}

/**
 * Anon-facing teaser card. Never reveals exact coords or spot name unless
 * the API payload already marks the viewer as authorized (in which case
 * the /go page redirects to the detail route instead of rendering this).
 */
export function DropTeaserCard({ teaser }: DropTeaserCardProps) {
  const { track } = useTrackEvent();

  useEffect(() => {
    // Anon-safe event — allow-listed in ANONYMOUS_ALLOWED_EVENTS.
    void track("surf_drop_link_view", {
      metadata: {
        slug: teaser.slug,
        status: teaser.status,
        is_known_spot: teaser.is_known_spot,
      },
    });
  }, [teaser.slug, teaser.status, teaser.is_known_spot, track]);

  const creatorName =
    teaser.creator?.display_name?.trim() || "A surfer";
  const areaLabel = teaser.general_area?.trim() || "a nearby zone";
  const windowLabel = formatSurfDropWindow(teaser.starts_at, teaser.ends_at);

  const signUpHref = `/auth/sign-up?redirectTo=${encodeURIComponent(`/go/${teaser.slug}`)}`;
  const signInHref = `/auth/sign-in?redirectTo=${encodeURIComponent(`/go/${teaser.slug}`)}`;

  return (
    <ZineSurface sectionLabel="Surf Drop" data-testid="surf-drop-teaser">
      <div className="surf-drop-teaser">
        <div className="surf-drop-teaser__sonar">
          <SonarPing size={140} />
        </div>

        <p className="surf-drop-teaser__eyebrow">
          {creatorName} just dropped a wave
        </p>
        <h1 className="surf-drop-teaser__area">Near {areaLabel}</h1>

        {windowLabel ? (
          <p className="surf-drop-teaser__window">{windowLabel}</p>
        ) : null}

        <div className="surf-drop-teaser__meta">
          {teaser.participants_count > 0 ? (
            <span className="surf-drop-teaser__crew">
              {teaser.participants_count} already in
            </span>
          ) : null}
        </div>

        <div className="surf-drop-teaser__gate">
          <p className="surf-drop-teaser__gate-copy">
            Sign in to see where and jump in with the crew.
          </p>
          <div className="surf-drop-teaser__gate-actions">
            <Link href={signUpHref} className="surf-drop-teaser__cta-primary">
              I&apos;m in
            </Link>
            <Link href={signInHref} className="surf-drop-teaser__cta-secondary">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </ZineSurface>
  );
}
