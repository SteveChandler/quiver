import { SEO_CONFIG } from "@/lib/constants/seo";

export function HomePageStructuredData() {
  const jsonLd = [
    SEO_CONFIG.structuredData.organization,
    SEO_CONFIG.structuredData.softwareApplication,
    SEO_CONFIG.structuredData.website,
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd),
      }}
    />
  );
}