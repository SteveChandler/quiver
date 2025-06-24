"use client";

import { SectionWrapper } from "./section-wrapper";
import { FeatureCard } from "./feature-card";
import { FEATURE_CARDS, CONTENT } from "@/lib/constants/features";

export function FeaturesSection() {
  return (
    <SectionWrapper
      title={CONTENT.sections.features.title}
      subtitle={CONTENT.sections.features.subtitle}
      centerContent
      className="py-20 px-4 mb-16"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {FEATURE_CARDS.map((feature, index) => (
          <FeatureCard key={feature.title} {...feature} delay={index + 1} />
        ))}
      </div>
    </SectionWrapper>
  );
}
