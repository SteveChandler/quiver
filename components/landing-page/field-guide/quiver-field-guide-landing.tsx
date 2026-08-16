import type { ReactElement } from "react";

import { FieldGuideCommunity } from "@/components/landing-page/field-guide/field-guide-community";
import { FieldGuideFeatures } from "@/components/landing-page/field-guide/field-guide-features";
import { FieldGuideFinalCta } from "@/components/landing-page/field-guide/field-guide-final-cta";
import { FieldGuideHero } from "@/components/landing-page/field-guide/field-guide-hero";
import { FieldGuideWalkthrough } from "@/components/landing-page/field-guide/field-guide-walkthrough";
import type { FirstTouchPlatform } from "@/lib/analytics/web-context";

interface QuiverFieldGuideLandingProps {
  platform: FirstTouchPlatform;
  /** Defaults ON upstream and only tags analytics cohort; this does not gate
   * whether the field-guide landing renders. Roll back by reverting deploy, not
   * flipping APP_FIRST_LANDING_ENABLED. */
  appFirst?: boolean;
}

export function QuiverFieldGuideLanding({
  platform,
}: QuiverFieldGuideLandingProps): ReactElement {
  return (
    <div
      data-testid="quiver-field-guide-landing"
      className="bg-[#0D1020]"
    >
      <FieldGuideHero platform={platform} />
      <FieldGuideWalkthrough />
      <FieldGuideFeatures />
      <FieldGuideCommunity />
      <FieldGuideFinalCta platform={platform} />
    </div>
  );
}
