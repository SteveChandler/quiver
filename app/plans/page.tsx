import type { Metadata } from "next";

import { FoundingOfferSurface } from "@/components/pricing/founding-offer-surface";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { SITE_URL } from "@/lib/constants/seo";
import { buildPageMetadata } from "@/lib/seo/meta";

const PLANS_DESCRIPTION =
  "Quiver Pro: 14 days free on iPhone. Custom spots stay free; Pro adds personal forecasting, board-aware picks, similarity alerts, and offline session saving.";

export const metadata: Metadata = buildPageMetadata({
  title: "Quiver Pro Plans | 14 Days Free on iPhone",
  description: PLANS_DESCRIPTION,
  path: "/plans",
  image: "/images/hero/quiver-landing-hero-social.jpg",
  keywords: [
    "Quiver Pro",
    "Quiver free trial",
    "Quiver App Store",
    "Quiver Android beta",
    "similarity surf alerts",
    "surf board recommendations",
    "custom surf spots",
    "personal surf forecast app",
  ],
});

export default function PlansPage() {
  return (
    <>
      <WebPageSchema
        name="Quiver Pro Plans"
        description={PLANS_DESCRIPTION}
        url={`${SITE_URL}/plans`}
        additionalData={{
          isPartOf: {
            "@type": "WebSite",
            name: "Quiver",
            url: SITE_URL,
          },
        }}
      />
      <FoundingOfferSurface />
    </>
  );
}
