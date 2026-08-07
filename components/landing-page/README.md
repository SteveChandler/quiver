# Landing Page Components

Refactored landing page components following DRY principles.

## Quick Start

```tsx
import {
  HeroSection,
  ForecastSection,
  FeaturesSection,
  CTASection,
  FooterSection,
} from "@/components/landing-page";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <ForecastSection />
      <FeaturesSection />
      <CTASection />
      <FooterSection />
    </div>
  );
}
```

## Components

- **HeroSection** - Video background with CTA
- **ForecastSection** - Weather forecast cards
- **FeaturesSection** - Product feature highlights
- **CTASection** - Call-to-action banner
- **FooterSection** - Site footer
- **SectionWrapper** - Reusable section layout
- **FeatureCard** - Individual feature card

## Customization

Edit content in `/lib/constants/features.ts`:

```tsx
export const CONTENT = {
  hero: {
    title: ["Custom", "Title", "Lines"],
    subtitle: "Custom subtitle",
    cta: "Custom CTA",
  },
};
```

## Testing

```bash
npm test -- landing-page
```

See `/docs/LANDING_PAGE_REFACTORING.md` for detailed documentation.
