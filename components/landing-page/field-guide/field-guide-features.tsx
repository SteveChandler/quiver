import type { ReactElement } from "react";

import { FieldGuideAudienceAccess } from "@/components/landing-page/field-guide/field-guide-audience-access";
import { FieldGuideCoverage } from "@/components/landing-page/field-guide/field-guide-coverage";
import { FieldGuideInsideApp } from "@/components/landing-page/field-guide/field-guide-inside-app";
import { FieldGuideProof } from "@/components/landing-page/field-guide/field-guide-proof";
import {
  QuiverSticker,
  ZineSurface,
  type QuiverStickerProps,
} from "@/components/zine";
import { cn } from "@/lib/utils";

interface Feature {
  sticker: QuiverStickerProps["sticker"];
  title: string;
  body: string;
  tier: "free" | "pro";
}

const FEATURES: Feature[] = [
  {
    sticker: "forecastWaveMark",
    title: "Honest forecasts",
    body: "Per-break wave heights and confidence without making every morning sound epic.",
    tier: "free",
  },
  {
    sticker: "spotWindRead",
    title: "Wind & tide reads",
    body: "Plain-language calls on the wind, tide window, and hour worth protecting.",
    tier: "free",
  },
  {
    sticker: "blogSessionLog",
    title: "Session log + crew",
    body: "Save what happened, remember the board, and share the call with the people you surf with.",
    tier: "free",
  },
  {
    sticker: "spotSwellMatch",
    title: "Board-aware picks",
    body: "Tell Quiver what's in your quiver. It matches the swell to the board that should actually go.",
    tier: "pro",
  },
  {
    sticker: "tealCurvedArrow",
    title: "Smart alerts",
    body: "Get pinged when your spots line up for the boards you own.",
    tier: "pro",
  },
  {
    sticker: "orangeMap",
    title: "Custom spots",
    body: "Drop your own breaks and get the same honest read anywhere.",
    tier: "pro",
  },
];

export function FieldGuideFeatures(): ReactElement {
  return (
    <ZineSurface
      id="features"
      sectionLabel="What's inside"
      data-testid="field-guide-features"
      className="bg-[#0D1020] px-3 py-0 sm:px-6 sm:py-0"
      stageClassName="mx-auto max-w-6xl !py-0"
      paperClassName="space-y-8"
      showMasthead={false}
    >
      <FieldGuideProof />
      <FieldGuideCoverage />
      <FieldGuideInsideApp />
      <FieldGuideAudienceAccess />
      <div className="grid gap-5 md:grid-cols-2">
        {FEATURES.map((feature, index) => (
          <div
            key={feature.title}
            className="notebook relative bg-[#F4EBD8] p-6 shadow-[2px_4px_0_rgba(0,0,0,0.18)]"
            style={{ transform: `rotate(${index % 2 === 0 ? -0.8 : 0.8}deg)` }}
          >
            <span
              className={cn(
                "absolute right-4 top-4 rounded-[8px_3px_8px_3px] border-2 border-[#11100D] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em]",
                feature.tier === "free"
                  ? "bg-[#C0DD97] text-[#27500A]"
                  : "bg-[#F78E42] text-[#5C2E0C]",
              )}
            >
              {feature.tier === "free" ? "Free" : "Pro"}
            </span>
            <QuiverSticker
              sticker={feature.sticker}
              className="mb-3 w-16"
              sizes="4rem"
            />
            <h3 className="font-[var(--font-zine-display)] text-xl uppercase leading-tight text-[#11100D]">
              {feature.title}
            </h3>
            <p className="mt-2 font-mono text-sm leading-relaxed text-[#11100D]/80">
              {feature.body}
            </p>
          </div>
        ))}
      </div>
    </ZineSurface>
  );
}
