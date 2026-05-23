import React from "react";
import { render, screen } from "@testing-library/react";
import { BeginnerPageContent } from "@/components/beginner/BeginnerPageContent";

jest.mock("@/components/seo/breadcrumb-schema", () => ({
  BreadcrumbStructuredData: () => null,
}));

jest.mock("@/components/seo/faq-schema", () => ({
  FAQSection: () => <div>FAQ</div>,
}));

jest.mock("@/lib/seo/intent-faq-generator", () => ({
  generateIntentFAQ: () => [],
}));

jest.mock("@/components/landing-page/cta-section", () => ({
  CTASection: () => <div>CTA</div>,
}));

jest.mock("@/components/ui/sticky-signup-bar", () => ({
  StickySignupBar: () => <div>Sticky CTA</div>,
}));

jest.mock("@/components/seo/alert-capture-cta", () => ({
  AlertCaptureCta: () => <div>Alert CTA</div>,
}));

jest.mock("@/components/shared/continue-exploring", () => ({
  ContinueExploring: () => <div>Continue Exploring</div>,
}));

jest.mock("@/components/beginner/BeginnerHero", () => ({
  BeginnerHero: () => <div>Hero</div>,
}));

jest.mock("@/components/beginner/RightNowConditions", () => ({
  RightNowConditions: () => <div>Conditions</div>,
}));

jest.mock("@/components/beginner/BeginnerSpotList", () => ({
  BeginnerSpotList: () => <div>Spot List</div>,
}));

jest.mock("@/components/beginner/WhatToExpect", () => ({
  WhatToExpect: () => <div>What To Expect</div>,
}));

jest.mock("@/components/beginner/SeasonalGuide", () => ({
  SeasonalGuide: () => <div>Seasonal Guide</div>,
}));

jest.mock("@/components/beginner/SafetyEssentials", () => ({
  SafetyEssentials: () => <div>Safety Essentials</div>,
}));

jest.mock("@/components/beginner/GearAndLessons", () => ({
  GearAndLessons: () => <div>Gear and Lessons</div>,
}));

jest.mock("@/components/beginner/SessionGallery", () => ({
  SessionGallery: () => <div>Session Gallery</div>,
}));

jest.mock("@/components/beginner/SectionFadeUp", () => ({
  SectionFadeUp: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("BeginnerPageContent", () => {
  it("renders the wave-height explainer for beginner pages", () => {
    render(
      <BeginnerPageContent
        cityName="Huntington Beach"
        citySlug="huntington-beach"
        stateSlug="ca"
        stateName="California"
        regionLabel="Orange County"
        conditionsBadge={null}
        rightNowConditions={null}
        beaches={[
          {
            id: "beach-1",
            slug: "bolsa-chica",
            name: "Bolsa Chica",
            city: "Huntington Beach",
            state: "CA",
            rank: 1,
            photoUrl: null,
          } as any,
        ]}
        cityEditorial={null}
        totalBeaches={1}
        baseUrl="https://www.quiversurf.app"
      />
    );

    expect(
      screen.getByText("How to read Quiver wave height")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Use Quiver's wave number to judge session size\./i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /At calibrated beaches it reflects face height at the break\./i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /treat a jump from 1-2 ft to 3-4 ft as a real step up for a beginner/i
      )
    ).toBeInTheDocument();
  });
});
