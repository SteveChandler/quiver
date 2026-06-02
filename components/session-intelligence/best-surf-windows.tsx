"use client";

import { useEffect, useRef } from "react";
import { Clock, Tags } from "lucide-react";

import { QuiverSticker } from "@/components/zine/quiver-sticker";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useTrackEvent } from "@/hooks/use-track-event";
import { cn } from "@/lib/utils";
import type { QuiverStickerKey } from "@/lib/ui/quiver-sticker-assets";
import type { SurfWindowRecommendation } from "@/types/session-intelligence";
import { AppDeepLinkCTA } from "./app-deep-link-cta";
import { SourceConfidenceBadge } from "./source-confidence-badge";
import { WhyThisCall } from "./why-this-call";
import {
  buildSurfWindowTrackingContext,
  buildSurfWindowTrackingMetadata,
} from "./tracking";

export interface BestSurfWindowsProps {
  recommendations: SurfWindowRecommendation[];
  title?: string;
  subtitle?: string;
  maxItems?: 1 | 2 | 3;
  ctaLabel?: string;
  surface?: string;
  className?: string;
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

function ConditionRow({
  sticker,
  label,
  value,
}: {
  sticker: QuiverStickerKey;
  label: string;
  value: string;
}) {
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

function ScoreDisk({ score }: { score: number }) {
  return (
    <div
      className="flex h-14 w-14 shrink-0 rotate-[1.5deg] flex-col items-center justify-center rounded-[18px_8px_20px_10px] border border-[#F78E42]/35 bg-[#F78E42]/15 text-white shadow-[2px_3px_0_rgba(0,0,0,0.28)] motion-reduce:rotate-0"
      aria-label={`Surf window score ${score}`}
    >
      <span className="font-heading text-lg font-bold leading-none">{score}</span>
      <span className="font-mono text-[10px] font-bold uppercase text-[#B8C7E0]">score</span>
    </div>
  );
}

function WindowCard({
  recommendation,
  ctaLabel,
  surface,
}: {
  recommendation: SurfWindowRecommendation;
  ctaLabel?: string;
  surface: string;
}) {
  const tracking = buildSurfWindowTrackingContext(recommendation, surface);

  return (
    <Card
      data-testid="surf-window-card"
      className="relative flex h-full flex-col gap-4 overflow-hidden rounded-xl border-[#404C92] bg-[#2D357D] p-4 text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
    >
      <QuiverSticker
        sticker={recommendation.rank === 1 ? "breakingWave" : "singleFin"}
        className={cn(
          "absolute -right-8 -top-8 h-24 w-24 object-contain opacity-[0.08]",
          recommendation.rank === 1 ? "rotate-6" : "-rotate-12"
        )}
        sizes="96px"
      />
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
          </div>
          <h3 className="font-heading text-lg font-semibold leading-tight text-white">
            {recommendation.headline}
          </h3>
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
        <SourceConfidenceBadge
          confidence={recommendation.confidence}
          sources={recommendation.sources}
        />
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
        <AppDeepLinkCTA
          links={recommendation}
          label={ctaLabel}
          tracking={tracking}
        />
        <WhyThisCall recommendation={recommendation} surface={surface} />
      </div>
    </Card>
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
        aria-label={title}
        className={cn("space-y-3", className)}
      >
        <h2 className="font-heading text-xl font-semibold text-white">{title}</h2>
        <p role="status" className="text-sm text-white/65">
          No recommended surf windows are available yet.
        </p>
      </section>
    );
  }

  return (
    <section
      data-testid="best-surf-windows"
      aria-label={title}
      className={cn("space-y-4", className)}
    >
      <div className="space-y-1">
        <h2 className="font-heading text-xl font-semibold text-white">{title}</h2>
        {subtitle ? <p className="text-sm text-white/62">{subtitle}</p> : null}
      </div>
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
    </section>
  );
}
