"use client";

import Link from "next/link";
import { useCallback, useMemo, type ReactElement } from "react";

import { useCtaImpression } from "@/hooks/use-cta-impression";
import { useTrackEvent } from "@/hooks/use-track-event";
import { useOptionalAuth } from "@/context/auth-context";
import { trackAppHandoffView } from "@/lib/analytics/app-handoff-tracking";
import { buildAppHandoffPath } from "@/lib/constants/app-handoff";
import type { CTAClickMetadata } from "@/types/implicit-preferences";
import { cn } from "@/lib/utils";

interface ContentPageAppHandoffCtaProps {
  source: string;
  surface: "beach_detail" | "water_temp" | "city_hub" | "learn";
  placement: string;
  target: string;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  className?: string;
}

/** Contextual bridge from an SEO answer to the existing device-aware app handoff. */
export function ContentPageAppHandoffCta({
  source,
  surface,
  placement,
  target,
  eyebrow,
  title,
  description,
  ctaLabel,
  className,
}: ContentPageAppHandoffCtaProps): ReactElement | null {
  const auth = useOptionalAuth();
  const { track } = useTrackEvent();
  const user = auth?.user ?? null;
  const isLoading = auth?.isLoading ?? false;
  const handoffPath = useMemo(
    () =>
      buildAppHandoffPath({
        source,
        surface,
        placement,
        target,
      }),
    [placement, source, surface, target],
  );
  const ctaId = `app_handoff_${surface}_${placement}`;
  const impressionExtra = useMemo(
    () => ({
      placement,
      cta_family: "app_handoff",
      target,
    }),
    [placement, target],
  );
  const handleImpression = useCallback((): void => {
    trackAppHandoffView({
      source,
      surface,
      placement,
      target,
      destination_type: "app_handoff",
      destination_url: handoffPath,
      stage: "content_cta",
    });
  }, [handoffPath, placement, source, surface, target]);
  const impressionRef = useCtaImpression<HTMLElement>({
    ctaId,
    surface,
    extra: impressionExtra,
    enabled: !user && !isLoading,
    onImpression: handleImpression,
  });

  const handleClick = useCallback((): void => {
    if (user || isLoading) return;
    const metadata: CTAClickMetadata & Record<string, unknown> = {
      cta: "other",
      location: placement,
      cta_family: "app_handoff",
      source,
      surface,
      placement,
      cta_id: ctaId,
      cta_text: ctaLabel,
      target,
      destination_type: "app_handoff",
    };

    void track("cta_click", { metadata, debounceMs: 0 });
  }, [ctaId, ctaLabel, isLoading, placement, source, surface, target, track, user]);

  if (user || isLoading) return null;

  return (
    <section
      ref={impressionRef}
      aria-labelledby={`${ctaId}-heading`}
      data-testid={`content-page-app-handoff-cta-${surface}`}
      data-surface={surface}
      data-placement={placement}
      className={cn(
        "relative overflow-hidden border-2 border-[#11100D] bg-[#F4EBD8] p-4 text-[#11100D] shadow-[3px_4px_0_rgba(17,16,13,0.22)] sm:p-5",
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#11100D]/60">
            {eyebrow}
          </p>
          <h2
            id={`${ctaId}-heading`}
            className="mt-2 max-w-2xl font-[var(--font-zine-display)] text-xl uppercase leading-tight tracking-[0.01em] sm:text-2xl"
          >
            {title}
          </h2>
          <p className="mt-2 max-w-2xl font-sans text-sm leading-6 text-[#11100D]/75 sm:text-base">
            {description}
          </p>
        </div>

        <Link
          href={handoffPath}
          onClick={handleClick}
          data-testid={`${ctaId}-link`}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center border-2 border-[#11100D] bg-[#F78E42] px-4 py-2.5 text-center font-mono text-xs font-black uppercase tracking-[0.08em] text-[#11100D] shadow-[2px_3px_0_rgba(17,16,13,0.3)] transition-colors hover:bg-[#FDB84B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3A75] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4EBD8] motion-reduce:transition-none sm:w-auto sm:px-5"
        >
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
