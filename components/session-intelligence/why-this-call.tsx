"use client";

import { useRef } from "react";
import { AlertTriangle, CheckCircle2, Info, Radio } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useTrackEvent } from "@/hooks/use-track-event";
import { cn } from "@/lib/utils";
import type { SurfWindowRecommendation } from "@/types/session-intelligence";
import {
  SourceConfidenceBadge,
  getSurfWindowSourceLabels,
} from "./source-confidence-badge";
import {
  buildSurfWindowTrackingContext,
  buildSurfWindowTrackingMetadata,
} from "./tracking";

export interface WhyThisCallProps {
  recommendation: SurfWindowRecommendation;
  surface?: string;
  className?: string;
  variant?: "default" | "zine";
}

function SourceChips({
  recommendation,
  variant,
}: {
  recommendation: SurfWindowRecommendation;
  variant: "default" | "zine";
}) {
  const sourceLabels = getSurfWindowSourceLabels(recommendation.sources);

  if (sourceLabels.length === 0) {
    return (
      <p
        className={cn(
          "text-sm",
          variant === "zine" ? "text-[#11100D]/65" : "text-white/60",
        )}
      >
        No source claims are attached.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {sourceLabels.map((label) => (
        <Badge
          key={label}
          variant="outline"
          className={cn(
            "text-[11px]",
            variant === "zine"
              ? "border-[#11100D]/30 bg-[#F0E5CC] text-[#11100D]"
              : "border-white/15 bg-white/5 text-white/75",
          )}
        >
          {label}
        </Badge>
      ))}
    </div>
  );
}

function ExplanationList({
  items,
  emptyText,
  icon,
  variant,
}: {
  items: string[];
  emptyText: string;
  icon: "positive" | "watchout" | "confidence";
  variant: "default" | "zine";
}) {
  if (items.length === 0) {
    return (
      <p
        className={cn(
          "text-sm",
          variant === "zine" ? "text-[#11100D]/65" : "text-white/60",
        )}
      >
        {emptyText}
      </p>
    );
  }

  const Icon = icon === "positive" ? CheckCircle2 : icon === "watchout" ? AlertTriangle : Info;

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item}
          className={cn(
            "flex gap-2 text-sm",
            variant === "zine" ? "text-[#11100D]/78" : "text-white/78",
          )}
        >
          <Icon
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0",
              variant === "zine" ? "text-[#B56A2B]" : "text-ocean-blue",
            )}
            aria-hidden="true"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function WhyThisCall({
  recommendation,
  surface = "session_intelligence",
  className,
  variant = "default",
}: WhyThisCallProps) {
  const { track } = useTrackEvent();
  const hasTrackedOpen = useRef(false);
  const triggerId = `why-this-call-${recommendation.windowId}`;

  function handleValueChange(value: string): void {
    if (value !== triggerId || hasTrackedOpen.current) return;

    hasTrackedOpen.current = true;
    const tracking = buildSurfWindowTrackingContext(recommendation, surface);
    void track("why_this_call_opened", {
      beachId: recommendation.beach.id,
      metadata: buildSurfWindowTrackingMetadata(tracking),
      debounceMs: 0,
    });
  }

  return (
    <Accordion
      type="single"
      collapsible
      onValueChange={handleValueChange}
      className={cn(
        "rounded-md border",
        variant === "zine"
          ? "border-[#11100D]/30 bg-[#F4EBD8]"
          : "border-white/10 bg-white/[0.03]",
        className,
      )}
    >
      <AccordionItem value={triggerId} className="border-b-0">
        <AccordionTrigger
          className={cn(
            "px-3 py-2 text-sm font-semibold hover:no-underline",
            variant === "zine" ? "text-[#11100D]" : "text-white/90",
          )}
          aria-label={`Why this call for ${recommendation.beach.name} ${recommendation.localTimeLabel}`}
        >
          <span className="inline-flex items-center gap-2">
            <Info
              className={cn(
                "h-4 w-4",
                variant === "zine" ? "text-[#B56A2B]" : "text-ocean-blue",
              )}
              aria-hidden="true"
            />
            Why this call?
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-4 pt-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <section aria-label="Positive signals" className="space-y-2">
              <h4
                className={cn(
                  "font-heading text-sm font-semibold",
                  variant === "zine" ? "text-[#11100D]" : "text-white",
                )}
              >
                Positive signals
              </h4>
              <ExplanationList
                items={recommendation.positives}
                emptyText="No positive signals are attached."
                icon="positive"
                variant={variant}
              />
            </section>
            <section aria-label="Watchouts" className="space-y-2">
              <h4
                className={cn(
                  "font-heading text-sm font-semibold",
                  variant === "zine" ? "text-[#11100D]" : "text-white",
                )}
              >
                Watchouts
              </h4>
              <ExplanationList
                items={recommendation.watchouts}
                emptyText="No major watchouts attached to this window."
                icon="watchout"
                variant={variant}
              />
            </section>
            <section aria-label="Confidence" className="space-y-2">
              <h4
                className={cn(
                  "font-heading text-sm font-semibold",
                  variant === "zine" ? "text-[#11100D]" : "text-white",
                )}
              >
                Confidence
              </h4>
              {/* Demoted from the card badge row — confidence detail belongs with the explanation */}
              <SourceConfidenceBadge
                confidence={recommendation.confidence}
                sources={recommendation.sources}
                className={
                  variant === "zine"
                    ? "border-[#0B3A75]/45 bg-[#0B3A75]/10 text-[#0B3A75]"
                    : undefined
                }
              />
              <p
                className={cn(
                  "text-sm",
                  variant === "zine" ? "text-[#11100D]/75" : "text-white/70",
                )}
              >
                {recommendation.confidence.summary}
              </p>
              <ExplanationList
                items={recommendation.confidence.reasons}
                emptyText="No confidence reasons are attached."
                icon="confidence"
                variant={variant}
              />
            </section>
            <section aria-label="Sources present" className="space-y-2">
              <h4
                className={cn(
                  "inline-flex items-center gap-2 font-heading text-sm font-semibold",
                  variant === "zine" ? "text-[#11100D]" : "text-white",
                )}
              >
                <Radio
                  className={cn(
                    "h-4 w-4",
                    variant === "zine" ? "text-[#0B3A75]" : "text-ocean-blue",
                  )}
                  aria-hidden="true"
                />
                Sources present
              </h4>
              <SourceChips recommendation={recommendation} variant={variant} />
            </section>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
