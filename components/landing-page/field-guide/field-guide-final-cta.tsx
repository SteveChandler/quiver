import type { ReactElement } from "react";

import { SaltyEyebrow } from "@/components/beach-detail/zine/atoms";
import { StoreDownloadButtons } from "@/components/landing-page/store-download-buttons";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import type { FirstTouchPlatform } from "@/lib/analytics/web-context";

interface FieldGuideFinalCtaProps {
  platform: FirstTouchPlatform;
}

export function FieldGuideFinalCta({
  platform,
}: FieldGuideFinalCtaProps): ReactElement {
  return (
    <ZineSurface
      sectionLabel="Back cover"
      data-testid="field-guide-final-cta"
      className="bg-[#0D1020] px-3 pb-8 pt-0 sm:px-6 sm:pb-12 sm:pt-0"
      stageClassName="mx-auto max-w-5xl !py-0"
      paperClassName="relative overflow-hidden text-center"
      showMasthead={false}
    >
      <QuiverSticker
        sticker="navyLightning"
        className="absolute -top-6 left-1/2 w-20 -translate-x-1/2 rotate-6 opacity-90"
        sizes="5rem"
      />
      <div className="flex justify-center pt-3">
        <SaltyEyebrow text="STOP GUESSING. START SURFING." />
      </div>
      <h2 className="zine-h1 mx-auto mt-3 max-w-3xl text-[#11100D]">
        Get Quiver on your phone.
      </h2>
      <p className="mx-auto mt-3 max-w-prose font-mono text-sm leading-relaxed text-[#11100D]/80 sm:text-base">
        Free to start. The dawn patrol call lives in your pocket.
      </p>
      <div className="mt-6 flex justify-center">
        <StoreDownloadButtons
          platform={platform}
          surface="landing"
          placement="final"
          includeComparison
          orientation="stack"
        />
      </div>
    </ZineSurface>
  );
}
