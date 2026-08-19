"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { ArrowRight, Clock, Tags } from "lucide-react";

import { HalftonePhoto } from "@/components/beach-detail/zine/atoms";
import { QuiverSticker } from "@/components/zine/quiver-sticker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackEvent } from "@/hooks/use-track-event";
import { getProxiedImageUrl } from "@/lib/utils/image-utils";
import { cn } from "@/lib/utils";
import type { QuiverStickerKey } from "@/lib/ui/quiver-sticker-assets";
import type { SurfWindowRecommendation } from "@/types/session-intelligence";
import { AppDeepLinkCTA } from "./app-deep-link-cta";
import { WhyThisCall } from "./why-this-call";
import {
  buildSurfWindowTrackingContext,
  buildSurfWindowTrackingMetadata,
} from "./tracking";

export interface BestSurfWindowsProps {
  recommendations: SurfWindowRecommendation[];
  title?: string;
  subtitle?: string;
  maxItems?: number;
  ctaLabel?: string;
  surface?: string;
  className?: string;
  layout?: "cards" | "feature-list";
  variant?: "default" | "zine";
  /** Suppress the inner title/subtitle block (the section keeps aria-label={title}) */
  hideHeader?: boolean;
}

function verdictClasses(verdict: SurfWindowRecommendation["verdict"]): string {
  if (verdict === "Worth it") {
    return "border-[#00D4AA]/35 bg-[#00D4AA]/10 text-[#BFF7EC]";
  }
  if (verdict === "Maybe") {
    return "border-[#FDB84B]/35 bg-[#FDB84B]/10 text-[#FFE1A0]";
  }
  return "border-[#F78E42]/35 bg-[#F78E42]/10 text-[#FFD2B7]";
}

function paperVerdictClasses(
  verdict: SurfWindowRecommendation["verdict"],
): string {
  if (verdict === "Worth it") {
    return "border-[#166534] bg-[#166534]/10 text-[#14532D]";
  }
  if (verdict === "Maybe") {
    return "border-[#B56A2B] bg-[#FDB84B]/25 text-[#713F12]";
  }
  return "border-[#9F1239] bg-[#9F1239]/10 text-[#881337]";
}

function ConditionRow({
  sticker,
  label,
  value,
  variant = "default",
}: {
  sticker: QuiverStickerKey;
  label: string;
  value: string;
  variant?: "default" | "zine";
}) {
  if (variant === "zine") {
    return (
      <div className="flex min-w-0 items-center gap-2 border-b border-[#11100D]/20 px-2 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
        <QuiverSticker
          sticker={sticker}
          className="h-8 w-8 shrink-0 object-contain"
          sizes="32px"
        />
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#11100D]/65">
            {label}
          </p>
          <p className="text-sm font-semibold leading-snug text-[#11100D]">
            {value}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-[12px_6px_14px_8px] border border-white/8 bg-white/[0.03] px-3 py-2 shadow-[2px_3px_0_rgba(0,0,0,0.12)]">
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px_4px_14px_6px] bg-[#252D6B]/45 shadow-[2px_3px_0_rgba(0,0,0,0.18)]">
        <QuiverSticker
          sticker={sticker}
          className="h-7 w-7 object-contain"
          sizes="28px"
        />
      </span>
      <div className="min-w-0">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#B8C7E0]/65">
          {label}
        </p>
        <p className="text-sm leading-snug text-white/82">{value}</p>
      </div>
    </div>
  );
}

function ScoreDisk({ score, compact = false }: { score: number; compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex shrink-0 rotate-[1.5deg] flex-col items-center justify-center border border-[#F78E42]/35 bg-[#F78E42]/15 text-white shadow-[2px_3px_0_rgba(0,0,0,0.28)] motion-reduce:rotate-0",
        compact
          ? "h-12 w-12 rounded-[16px_7px_18px_9px]"
          : "h-14 w-14 rounded-[18px_8px_20px_10px]"
      )}
      aria-label={`Surf window score ${score}`}
    >
      <span
        className={cn(
          "font-heading font-bold leading-none",
          compact ? "text-base" : "text-lg"
        )}
      >
        {score}
      </span>
      <span className="font-mono text-[10px] font-bold uppercase text-[#B8C7E0]">
        score
      </span>
    </div>
  );
}

function FeatureSignalPill({
  sticker,
  label,
  value,
}: {
  sticker: QuiverStickerKey;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-[12px_4px_14px_6px] border border-white/8 bg-white/[0.035] px-3 py-2">
      <QuiverSticker
        sticker={sticker}
        className="h-7 w-7 shrink-0 object-contain"
        sizes="28px"
      />
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#B8C7E0]/62">
          {label}
        </p>
        <p className="truncate text-sm leading-snug text-white/82">{value}</p>
      </div>
    </div>
  );
}

function FeatureWindowPanel({
  recommendation,
  ctaLabel,
  surface,
}: {
  recommendation: SurfWindowRecommendation;
  ctaLabel?: string;
  surface: string;
}) {
  const { track } = useTrackEvent();
  const tracking = buildSurfWindowTrackingContext(recommendation, surface);
  const beach = recommendation.beach;
  const locality =
    [beach.city, beach.state].filter(Boolean).join(", ") || beach.region || null;
  const webUrl = recommendation.canonicalWebUrl;
  const photoUrl = beach.photoUrl?.trim() ?? "";
  const photoSrc = photoUrl.length > 0 ? getProxiedImageUrl(photoUrl) : null;
  const primaryTags = recommendation.bestFor.slice(0, 3);

  function handleWebClick(): void {
    if (!webUrl) return;
    void track("surf_window_click", {
      beachId: beach.id,
      metadata: buildSurfWindowTrackingMetadata(tracking, {
        targetHref: webUrl,
        linkType: "web",
      }),
      debounceMs: 0,
    });
  }

  const titleHeading = (
    <h3 className="font-heading text-2xl font-semibold leading-tight text-white sm:text-3xl">
      {beach.name}
    </h3>
  );

  const thumbnail = photoSrc ? (
    <Image
      src={photoSrc}
      alt={`Surf photo of ${beach.name}`}
      width={640}
      height={420}
      className="h-full w-full object-cover"
      priority
      sizes="(min-width: 1024px) 40vw, (min-width: 640px) 42vw, 100vw"
    />
  ) : null;

  return (
    <Card
      data-testid="surf-window-card"
      data-layout="feature-story"
      className={cn(
        "relative overflow-hidden rounded-xl border-[#404C92] bg-[#2D357D] p-4 text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)]",
        photoSrc && "sm:grid sm:grid-cols-[minmax(180px,0.86fr)_minmax(0,1.14fr)] sm:gap-4"
      )}
    >
      <QuiverSticker
        sticker="breakingWave"
        className="absolute -right-8 -top-8 h-24 w-24 rotate-6 object-contain opacity-[0.08]"
        sizes="96px"
      />
      {photoSrc ? (
        <div className="relative mb-4 h-44 overflow-hidden rounded-[14px_5px_16px_7px] border border-white/10 shadow-[2px_3px_0_rgba(0,0,0,0.22)] sm:mb-0 sm:h-full sm:min-h-[300px]">
          {webUrl ? (
            <a
              href={webUrl}
              aria-label={`View ${beach.name} forecast`}
              onClick={handleWebClick}
              className="block h-full w-full"
            >
              {thumbnail}
            </a>
          ) : (
            thumbnail
          )}
        </div>
      ) : null}

      <div className="relative flex min-w-0 flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="rotate-[-1deg] rounded-[12px_4px_14px_6px] border-[#FDB84B]/35 bg-[#FDB84B]/12 font-mono text-[11px] font-bold text-[#FFE1A0] shadow-[2px_3px_0_rgba(0,0,0,0.22)] motion-reduce:rotate-0"
              >
                #{recommendation.rank}
              </Badge>
              <span className="inline-flex items-center gap-1.5 font-mono text-sm font-bold text-white/78">
                <Clock className="h-4 w-4 text-[#F78E42]" aria-hidden="true" />
                {recommendation.localTimeLabel}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "rounded-[12px_4px_14px_6px] border px-2.5 py-1 font-mono text-[11px] font-bold uppercase shadow-[2px_3px_0_rgba(0,0,0,0.22)]",
                  verdictClasses(recommendation.verdict)
                )}
              >
                {recommendation.verdict}
              </Badge>
            </div>
            {webUrl ? (
              <a
                href={webUrl}
                onClick={handleWebClick}
                className="block decoration-[#F78E42]/60 underline-offset-4 hover:underline"
              >
                {titleHeading}
              </a>
            ) : (
              titleHeading
            )}
            {locality ? (
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#B8C7E0]/65">
                {locality}
              </p>
            ) : null}
          </div>
          <ScoreDisk score={recommendation.score} />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <FeatureSignalPill
            sticker="spotSwellMatch"
            label="Wave"
            value={recommendation.wave.summary}
          />
          <FeatureSignalPill
            sticker="spotWindRead"
            label="Wind"
            value={recommendation.wind.summary}
          />
          <FeatureSignalPill
            sticker="spotTideWindow"
            label="Tide"
            value={recommendation.tide.summary}
          />
          {primaryTags.length > 0 ? (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-[12px_4px_14px_6px] border border-white/8 bg-white/[0.025] px-3 py-2">
              <Tags className="h-3.5 w-3.5 shrink-0 text-white/45" aria-hidden="true" />
              {primaryTags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="rounded-[12px_4px_14px_6px] border-white/12 bg-white/[0.04] text-[11px] text-white/70"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-auto grid gap-3">
          {webUrl ? (
            <Button
              asChild
              size="sm"
              className="h-10 w-full rounded-[12px_4px_14px_6px] bg-[#F78E42] text-[#252D6B] shadow-[2px_3px_0_rgba(0,0,0,0.28)] hover:bg-[#F78E42]/90"
            >
              <a
                href={webUrl}
                data-testid="surf-window-web-cta"
                onClick={handleWebClick}
              >
                <span>View spot forecast</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
          ) : null}
          <AppDeepLinkCTA
            links={recommendation}
            label={ctaLabel}
            variant="ghost"
            tracking={tracking}
          />
          <WhyThisCall recommendation={recommendation} surface={surface} />
        </div>
      </div>
    </Card>
  );
}

function WindowCard({
  recommendation,
  ctaLabel,
  surface,
  spanFeatured = true,
}: {
  recommendation: SurfWindowRecommendation;
  ctaLabel?: string;
  surface: string;
  spanFeatured?: boolean;
}) {
  const { track } = useTrackEvent();
  const tracking = buildSurfWindowTrackingContext(recommendation, surface);
  const isFeatured = recommendation.rank === 1;
  const beach = recommendation.beach;
  const locality =
    [beach.city, beach.state].filter(Boolean).join(", ") || beach.region || null;
  const webUrl = recommendation.canonicalWebUrl;

  const photoUrl = beach.photoUrl?.trim() ?? "";
  const photoSrc = photoUrl.length > 0 ? getProxiedImageUrl(photoUrl) : null;

  function handleWebClick(): void {
    if (!webUrl) return;
    void track("surf_window_click", {
      beachId: beach.id,
      metadata: buildSurfWindowTrackingMetadata(tracking, {
        targetHref: webUrl,
        linkType: "web",
      }),
      debounceMs: 0,
    });
  }

  const thumbnail = photoSrc ? (
    <Image
      src={photoSrc}
      alt={`Surf photo of ${beach.name}`}
      width={640}
      height={280}
      className="h-full w-full object-cover"
      loading={isFeatured ? "eager" : "lazy"}
      sizes={
        isFeatured
          ? "(min-width: 768px) 50vw, 100vw"
          : "(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
      }
    />
  ) : null;

  const titleHeading = (
    <h3
      className={cn(
        "font-heading font-semibold leading-tight text-white",
        isFeatured ? "text-2xl" : "text-lg"
      )}
    >
      {beach.name}
    </h3>
  );

  return (
    <Card
      data-testid="surf-window-card"
      className={cn(
        "relative flex h-full flex-col gap-4 overflow-hidden rounded-xl border-[#404C92] bg-[#2D357D] p-4 text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)]",
        isFeatured && spanFeatured && "md:col-span-2 xl:col-span-2"
      )}
    >
      <QuiverSticker
        sticker={isFeatured ? "breakingWave" : "singleFin"}
        className={cn(
          "absolute -right-8 -top-8 h-24 w-24 object-contain opacity-[0.08]",
          isFeatured ? "rotate-6" : "-rotate-12"
        )}
        sizes="96px"
      />
      {photoSrc ? (
        <div
          className={cn(
            "relative shrink-0 overflow-hidden rounded-[12px_4px_14px_6px] border border-white/10 shadow-[2px_3px_0_rgba(0,0,0,0.22)]",
            isFeatured ? "h-44" : "h-28"
          )}
        >
          {webUrl ? (
            <a
              href={webUrl}
              aria-label={`View ${beach.name} forecast`}
              onClick={handleWebClick}
              className="block h-full w-full"
            >
              {thumbnail}
            </a>
          ) : (
            thumbnail
          )}
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="rotate-[-1deg] rounded-[12px_4px_14px_6px] border-[#FDB84B]/35 bg-[#FDB84B]/12 font-mono text-[11px] font-bold text-[#FFE1A0] shadow-[2px_3px_0_rgba(0,0,0,0.22)] motion-reduce:rotate-0"
            >
              #{recommendation.rank}
            </Badge>
            <span className="inline-flex items-center gap-1.5 font-mono text-sm font-bold text-white/78">
              <Clock className="h-4 w-4 text-[#F78E42]" aria-hidden="true" />
              {recommendation.localTimeLabel}
            </span>
          </div>
          {webUrl ? (
            <a
              href={webUrl}
              onClick={handleWebClick}
              className="block decoration-[#F78E42]/60 underline-offset-4 hover:underline"
            >
              {titleHeading}
            </a>
          ) : (
            titleHeading
          )}
          {locality ? (
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#B8C7E0]/65">
              {locality}
            </p>
          ) : null}
        </div>
        <ScoreDisk score={recommendation.score} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            "rounded-[12px_4px_14px_6px] border px-2.5 py-1 font-mono text-[11px] font-bold uppercase shadow-[2px_3px_0_rgba(0,0,0,0.22)]",
            verdictClasses(recommendation.verdict)
          )}
        >
          {recommendation.verdict}
        </Badge>
      </div>

      <div className="grid gap-2">
        <ConditionRow
          sticker="spotSwellMatch"
          label="Wave"
          value={recommendation.wave.summary}
        />
        <ConditionRow
          sticker="spotWindRead"
          label="Wind"
          value={recommendation.wind.summary}
        />
        <ConditionRow
          sticker="spotTideWindow"
          label="Tide"
          value={recommendation.tide.summary}
        />
      </div>

      <div className="space-y-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/55">
          <Tags className="h-3.5 w-3.5" aria-hidden="true" />
          Best for
        </p>
        <div className="flex flex-wrap gap-1.5">
          {recommendation.bestFor.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="rounded-[12px_4px_14px_6px] border-white/12 bg-white/[0.04] text-[11px] text-white/70"
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <div className="mt-auto grid gap-3">
        {webUrl ? (
          <Button
            asChild
            size="sm"
            className="h-10 w-full rounded-[12px_4px_14px_6px] bg-[#F78E42] text-[#252D6B] shadow-[2px_3px_0_rgba(0,0,0,0.28)] hover:bg-[#F78E42]/90"
          >
            <a
              href={webUrl}
              data-testid="surf-window-web-cta"
              onClick={handleWebClick}
            >
              <span>View spot forecast</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </Button>
        ) : null}
        <AppDeepLinkCTA
          links={recommendation}
          label={ctaLabel}
          variant="ghost"
          tracking={tracking}
        />
        <WhyThisCall recommendation={recommendation} surface={surface} />
      </div>
    </Card>
  );
}

function CompactWindowRow({
  recommendation,
  surface,
}: {
  recommendation: SurfWindowRecommendation;
  surface: string;
}) {
  const { track } = useTrackEvent();
  const tracking = buildSurfWindowTrackingContext(recommendation, surface);
  const beach = recommendation.beach;
  const locality =
    [beach.city, beach.state].filter(Boolean).join(", ") || beach.region || null;
  const webUrl = recommendation.canonicalWebUrl;
  const photoUrl = beach.photoUrl?.trim() ?? "";
  const photoSrc = photoUrl.length > 0 ? getProxiedImageUrl(photoUrl) : null;
  const signal = [recommendation.wave.summary, recommendation.wind.summary]
    .filter(Boolean)
    .join(" · ");

  function handleWebClick(): void {
    if (!webUrl) return;
    void track("surf_window_click", {
      beachId: beach.id,
      metadata: buildSurfWindowTrackingMetadata(tracking, {
        targetHref: webUrl,
        linkType: "web",
      }),
      debounceMs: 0,
    });
  }

  return (
    <Card
      data-testid="surf-window-card"
      data-layout="compact-row"
      className="relative overflow-hidden rounded-xl border-[#404C92] bg-[#2D357D] p-3 text-white shadow-[0_6px_18px_rgba(0,0,0,0.22)]"
    >
      <div className="flex gap-3">
        {photoSrc ? (
          <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-[12px_4px_14px_6px] border border-white/10 sm:h-24 sm:w-32">
            <Image
              src={photoSrc}
              alt={`Surf photo of ${beach.name}`}
              width={256}
              height={192}
              className="h-full w-full object-cover"
              loading="lazy"
              sizes="(min-width: 640px) 128px, 96px"
            />
          </div>
        ) : null}

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="rounded-[12px_4px_14px_6px] border-[#FDB84B]/35 bg-[#FDB84B]/12 font-mono text-[11px] font-bold text-[#FFE1A0]"
            >
              #{recommendation.rank}
            </Badge>
            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-white/72">
              <Clock className="h-3.5 w-3.5 text-[#F78E42]" aria-hidden="true" />
              {recommendation.localTimeLabel}
            </span>
            <Badge
              variant="outline"
              className={cn(
                "rounded-[12px_4px_14px_6px] border px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
                verdictClasses(recommendation.verdict)
              )}
            >
              {recommendation.verdict}
            </Badge>
          </div>

          <div className="min-w-0">
            <h3 className="truncate font-heading text-base font-semibold leading-tight text-white">
              {beach.name}
            </h3>
            {locality ? (
              <p className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#B8C7E0]/62">
                {locality}
              </p>
            ) : null}
          </div>

          {signal ? (
            <p className="truncate text-sm leading-snug text-white/78">{signal}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end justify-between gap-3">
          <ScoreDisk score={recommendation.score} compact />
          {webUrl ? (
            <a
              href={webUrl}
              data-testid="surf-window-web-cta"
              aria-label={`View ${beach.name} forecast`}
              onClick={handleWebClick}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[12px_4px_14px_6px] bg-[#F78E42] px-3 text-sm font-semibold text-[#252D6B] shadow-[2px_3px_0_rgba(0,0,0,0.22)] hover:bg-[#F78E42]/90"
            >
              <span>View</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function ZineWindowEntry({
  recommendation,
  ctaLabel,
  surface,
}: {
  recommendation: SurfWindowRecommendation;
  ctaLabel?: string;
  surface: string;
}) {
  const { track } = useTrackEvent();
  const tracking = buildSurfWindowTrackingContext(recommendation, surface);
  const beach = recommendation.beach;
  const locality =
    [beach.city, beach.state].filter(Boolean).join(", ") ||
    beach.region ||
    null;
  const webUrl = recommendation.canonicalWebUrl;
  const photoUrl = beach.photoUrl?.trim() ?? "";
  const photoSrc = photoUrl.length > 0 ? getProxiedImageUrl(photoUrl) : null;

  function handleWebClick(): void {
    if (!webUrl) return;
    void track("surf_window_click", {
      beachId: beach.id,
      metadata: buildSurfWindowTrackingMetadata(tracking, {
        targetHref: webUrl,
        linkType: "web",
      }),
      debounceMs: 0,
    });
  }

  const titleHeading = (
    <h3 className="font-heading text-2xl font-bold leading-tight text-[#11100D] sm:text-3xl">
      {beach.name}
    </h3>
  );

  return (
    <article
      data-testid="surf-window-card"
      data-variant="zine"
      className="relative bg-[#FBF6E8] py-6 text-[#11100D] first:pt-2 last:pb-2"
    >
      <div
        className={cn(
          "grid gap-5",
          photoSrc && "md:grid-cols-[minmax(10rem,0.7fr)_minmax(0,1.3fr)]",
        )}
      >
        {photoSrc ? (
          <div className="polaroid rot-neg self-start">
            <span className="tape tl" aria-hidden="true" />
            {webUrl ? (
              <a
                href={webUrl}
                aria-label={`View ${beach.name} forecast`}
                onClick={handleWebClick}
                className="photo block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#11100D]"
              >
                <HalftonePhoto
                  src={photoSrc}
                  alt={`Surf photo of ${beach.name}`}
                  height={220}
                />
              </a>
            ) : (
              <div className="photo">
                <HalftonePhoto
                  src={photoSrc}
                  alt={`Surf photo of ${beach.name}`}
                  height={220}
                />
              </div>
            )}
            <p className="cap">{beach.name}</p>
          </div>
        ) : null}

        <div className="min-w-0 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="circled shrink-0 bg-[#FDB84B]/35"
                  aria-label={`Rank ${recommendation.rank}`}
                >
                  {recommendation.rank}
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-[0.08em] text-[#11100D]/75">
                  <Clock
                    className="h-4 w-4 text-[#B56A2B]"
                    aria-hidden="true"
                  />
                  {recommendation.localTimeLabel}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "border px-2.5 py-1 font-mono text-[11px] font-bold uppercase",
                    paperVerdictClasses(recommendation.verdict),
                  )}
                >
                  {recommendation.verdict}
                </Badge>
              </div>
              {webUrl ? (
                <a
                  href={webUrl}
                  onClick={handleWebClick}
                  className="block decoration-[#B56A2B] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#11100D]"
                >
                  {titleHeading}
                </a>
              ) : (
                titleHeading
              )}
              {locality ? (
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#11100D]/65">
                  {locality}
                </p>
              ) : null}
            </div>
            <div
              className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border-[3px] border-double border-[#0B3A75] bg-[#F4EBD8] text-[#0B3A75] shadow-sm"
              aria-label={`Surf window score ${recommendation.score}`}
            >
              <span className="font-heading text-xl font-black leading-none">
                {recommendation.score}
              </span>
              <span className="font-mono text-[9px] font-bold uppercase">
                score
              </span>
            </div>
          </div>

          <p className="border-l-4 border-[#F78E42] pl-3 font-[var(--font-handwritten)] text-xl font-bold leading-snug text-[#11100D]/85">
            {recommendation.headline}
          </p>

          <div
            className="condition-strip grid-cols-1 sm:grid-cols-3"
            role="group"
            aria-label={`Conditions for ${beach.name}`}
          >
            <ConditionRow
              sticker="spotSwellMatch"
              label="Wave"
              value={recommendation.wave.summary}
              variant="zine"
            />
            <ConditionRow
              sticker="spotWindRead"
              label="Wind"
              value={recommendation.wind.summary}
              variant="zine"
            />
            <ConditionRow
              sticker="spotTideWindow"
              label="Tide"
              value={recommendation.tide.summary}
              variant="zine"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-dashed border-[#11100D]/30 pb-4">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#11100D]/70">
              <Tags className="h-3.5 w-3.5" aria-hidden="true" />
              Best for
            </span>
            {recommendation.bestFor.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="border-[#11100D]/35 bg-[#F0E5CC] text-[11px] text-[#11100D]"
              >
                {tag}
              </Badge>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {webUrl ? (
              <Button
                asChild
                size="sm"
                className="h-10 w-full bg-[#F78E42] text-[#11100D] shadow-sm hover:bg-[#F78E42]/90"
              >
                <a
                  href={webUrl}
                  data-testid="surf-window-web-cta"
                  onClick={handleWebClick}
                >
                  <span>View spot forecast</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </Button>
            ) : null}
            <AppDeepLinkCTA
              links={recommendation}
              label={ctaLabel}
              variant="ghost"
              tracking={tracking}
              className="w-full border-[#11100D]/45 bg-transparent text-[#11100D] hover:bg-[#F0E5CC] hover:text-[#11100D]"
            />
          </div>
          <WhyThisCall
            recommendation={recommendation}
            surface={surface}
            variant="zine"
          />
        </div>
      </div>
    </article>
  );
}

export function BestSurfWindows({
  recommendations,
  title = "Best surf windows",
  subtitle,
  maxItems = 3,
  ctaLabel,
  surface = "session_intelligence",
  className,
  layout = "cards",
  hideHeader = false,
  variant = "default",
}: BestSurfWindowsProps) {
  const { track } = useTrackEvent();
  const trackedImpressions = useRef<Set<string>>(new Set());
  const visibleRecommendations = recommendations.slice(0, maxItems);

  useEffect(() => {
    for (const recommendation of visibleRecommendations) {
      const key = `${surface}:${recommendation.windowId}`;
      if (trackedImpressions.current.has(key)) continue;

      trackedImpressions.current.add(key);
      const tracking = buildSurfWindowTrackingContext(recommendation, surface);
      void track("surf_window_impression", {
        beachId: recommendation.beach.id,
        metadata: buildSurfWindowTrackingMetadata(tracking),
        debounceMs: 0,
      });
    }
  }, [surface, track, visibleRecommendations]);

  if (visibleRecommendations.length === 0) {
    return (
      <section
        data-testid="best-surf-windows"
        data-variant={variant}
        aria-label={title}
        className={cn("space-y-3", className)}
      >
        {hideHeader ? null : (
          <h2
            className={cn(
              "font-heading text-xl font-semibold",
              variant === "zine" ? "text-[#11100D]" : "text-white",
            )}
          >
            {title}
          </h2>
        )}
        <p
          role="status"
          className={cn(
            "text-sm",
            variant === "zine" ? "text-[#11100D]/65" : "text-white/65",
          )}
        >
          No recommended surf windows are available yet.
        </p>
      </section>
    );
  }
  const featuredRecommendation = visibleRecommendations[0];
  if (!featuredRecommendation) {
    return null;
  }

  if (variant === "zine") {
    return (
      <section
        data-testid="best-surf-windows"
        data-variant="zine"
        aria-label={title}
        className={cn("space-y-5 text-[#11100D]", className)}
      >
        {hideHeader ? null : (
          <div className="space-y-2">
            <h2 className="label-black font-display text-2xl font-black uppercase leading-tight">
              {title}
            </h2>
            {subtitle ? (
              <p className="text-sm text-[#11100D]/70">{subtitle}</p>
            ) : null}
          </div>
        )}
        <div className="divide-y-2 divide-dashed divide-[#11100D]/35">
          {visibleRecommendations.map((recommendation) => (
            <ZineWindowEntry
              key={recommendation.windowId}
              recommendation={recommendation}
              ctaLabel={ctaLabel}
              surface={surface}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      data-testid="best-surf-windows"
      data-variant="default"
      aria-label={title}
      className={cn("space-y-4", className)}
    >
      {hideHeader ? null : (
        <div className="space-y-1">
          <h2 className="font-heading text-xl font-semibold text-white">{title}</h2>
          {subtitle ? <p className="text-sm text-white/62">{subtitle}</p> : null}
        </div>
      )}
      {layout === "feature-list" ? (
        <div className="grid gap-4">
          <FeatureWindowPanel
            recommendation={featuredRecommendation}
            ctaLabel={ctaLabel}
            surface={surface}
          />
          {visibleRecommendations.length > 1 ? (
            <div className="grid content-start gap-3 lg:grid-cols-2">
              {visibleRecommendations.slice(1).map((recommendation) => (
                <CompactWindowRow
                  key={recommendation.windowId}
                  recommendation={recommendation}
                  surface={surface}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleRecommendations.map((recommendation) => (
            <WindowCard
              key={recommendation.windowId}
              recommendation={recommendation}
              ctaLabel={ctaLabel}
              surface={surface}
            />
          ))}
        </div>
      )}
    </section>
  );
}
