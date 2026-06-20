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

interface Feature {
  sticker: QuiverStickerProps["sticker"];
  title: string;
  body: string;
}

const FEATURES: Feature[] = [
  {
    sticker: "spotSwellMatch",
    title: "Board-aware picks",
    body: "Tell Quiver what's in your quiver. It matches the swell to the board that should actually go.",
  },
  {
    sticker: "spotWindRead",
    title: "Wind & tide reads",
    body: "Plain-language calls on the wind, tide window, and hour worth protecting.",
  },
  {
    sticker: "forecastWaveMark",
    title: "Honest forecasts",
    body: "Per-break wave heights and confidence without making every morning sound epic.",
  },
  {
    sticker: "blogSessionLog",
    title: "Session log + crew",
    body: "Save what happened, remember the board, and share the call with the people you surf with.",
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
