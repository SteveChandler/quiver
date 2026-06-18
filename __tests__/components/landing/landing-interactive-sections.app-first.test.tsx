import { render } from "@testing-library/react";

import { LandingInteractiveSections } from "@/components/landing-page/landing-interactive-sections";

jest.mock("@/components/landing-page/platform-status-strip", () => ({
  PlatformStatusStrip: ({ platform }: { platform: string }) => (
    <div data-section="platform-strip" data-platform={platform} />
  ),
}));

jest.mock("@/components/landing-page/app-proof-walkthrough", () => ({
  AppProofWalkthrough: () => <div data-section="app-proof" />,
}));

jest.mock("@/components/landing-page/surf-highlights-section", () => ({
  SurfHighlightsSection: ({ trustProof }: { trustProof?: boolean }) => (
    <div data-section="surf-trust" data-trust-proof={String(trustProof)} />
  ),
}));

jest.mock("@/components/app-store/native-app-funnel-cta", () => ({
  NativeAppFunnelCta: ({
    platform,
    placement,
    cohort,
  }: {
    platform: string;
    placement: string;
    cohort?: string;
  }) => (
    <div
      data-testid="native-app-funnel-cta"
      data-section="final-native-cta"
      data-platform={platform}
      data-placement={placement}
      data-cohort={cohort}
    />
  ),
}));

jest.mock("@/components/landing-page/forecast-section", () => ({
  ForecastSection: () => <div data-section="legacy-forecast" />,
}));
jest.mock("@/components/landing-page/ml-pipeline-showcase", () => ({
  MLPipelineShowcase: () => <div data-section="legacy-ml" />,
}));
jest.mock("@/components/landing-page/feature-bento-section", () => ({
  FeatureBentoSection: () => <div data-section="legacy-bento" />,
}));
jest.mock("@/components/landing-page/activities-section", () => ({
  ActivitiesSection: () => <div data-section="legacy-activities" />,
}));
jest.mock("@/components/landing-page/cta-section", () => ({
  CTASection: () => <div data-section="legacy-final-cta" />,
}));
jest.mock("@/components/pricing/landing-pricing-teaser", () => ({
  LandingPricingTeaser: () => <div data-section="legacy-pricing" />,
}));

describe("LandingInteractiveSections app-first stack", () => {
  it("orders platform status, proof walkthrough, trust proof, and final native CTA", () => {
    const { container } = render(
      <LandingInteractiveSections initialPlatform="android" appFirst />,
    );

    expect(
      Array.from(container.querySelectorAll("[data-section]")).map((node) =>
        node.getAttribute("data-section"),
      ),
    ).toEqual([
      "platform-strip",
      "app-proof",
      "surf-trust",
      "final-native-cta",
    ]);
    expect(container.querySelector("[data-section='platform-strip']")).toHaveAttribute(
      "data-platform",
      "android",
    );
    expect(container.querySelector("[data-section='surf-trust']")).toHaveAttribute(
      "data-trust-proof",
      "true",
    );
    expect(container.querySelector("[data-section='final-native-cta']")).toHaveAttribute(
      "data-placement",
      "final_cta",
    );
    expect(container.querySelector("[data-section='final-native-cta']")).toHaveAttribute(
      "data-cohort",
      "app_first",
    );
  });
});
