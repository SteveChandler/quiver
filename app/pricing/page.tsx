import type { Metadata } from "next";

import { FoundingOfferSurface } from "@/components/pricing/founding-offer-surface";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { SITE_URL } from "@/lib/constants/seo";
import { buildPageMetadata } from "@/lib/seo/meta";

const PRICING_DESCRIPTION =
  "Join the Quiver founding access waitlist. Log 5 surf sessions in Quiver to qualify for Pro for lifetime when plans open.";

export const metadata: Metadata = buildPageMetadata({
  title: "Founding Access Waitlist | Quiver",
  description: PRICING_DESCRIPTION,
  path: "/pricing",
  image: "/images/hero/quiver-landing-hero-social.jpg",
  keywords: [
    "Quiver founding access",
    "surf forecast app waitlist",
    "surf call app",
    "surf session log app",
  ],
});

export default function PricingPage() {
  return (
    <>
      <WebPageSchema
        name="Founding Access Waitlist | Quiver"
        description={PRICING_DESCRIPTION}
        url={`${SITE_URL}/pricing`}
        additionalData={{
          isPartOf: {
            "@type": "WebSite",
            name: "Quiver",
            url: SITE_URL,
          },
        }}
      />
      <main>
        <FoundingOfferSurface />
      </main>
    </>
  );
}
