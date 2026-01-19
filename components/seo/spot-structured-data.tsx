import { FAQSchema } from "@/components/seo/faq-schema";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import type { SurfSpot } from "@/lib/data/surf-spots";

interface SpotStructuredDataProps {
  spot: SurfSpot;
  cityName?: string;
  citySlug?: string;
  baseUrl: string;
}

export function SpotStructuredData({
  spot,
  cityName,
  citySlug,
  baseUrl,
}: SpotStructuredDataProps) {
  const safeBase = baseUrl.replace(/\/$/, "");

  const breadcrumbs = [
    { name: "Quiver", url: `${safeBase}/` },
    cityName && citySlug
      ? {
          name: `${cityName} Surf`,
          url: `${safeBase}/ca/${citySlug}`,
        }
      : undefined,
    {
      name: `${spot.name} Surf Report`,
      url: `${safeBase}/spots/${spot.slug}`,
    },
  ].filter(Boolean) as Array<{ name: string; url: string }>;

  const speakable = {
    "@context": "https://schema.org",
    "@type": "SpeakableSpecification",
    cssSelector: ["h1", ".js-daily-summary"],
  };

  return (
    <>
      <BreadcrumbStructuredData items={breadcrumbs} />
      <FAQSchema items={spot.faq} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(speakable),
        }}
      />
    </>
  );
}
