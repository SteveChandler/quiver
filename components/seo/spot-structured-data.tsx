import { FAQSchema } from "@/components/seo/faq-schema";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import {
  SURF_CITIES,
  type SurfCitySlug,
  type SurfSpot,
} from "@/lib/data/surf-spots";

interface SpotStructuredDataProps {
  spot: SurfSpot;
  citySlug: SurfCitySlug;
  baseUrl: string;
}

export function SpotStructuredData({
  spot,
  citySlug,
  baseUrl,
}: SpotStructuredDataProps) {
  const safeBase = baseUrl.replace(/\/$/, "");
  const city = SURF_CITIES[citySlug];

  const breadcrumbs = [
    { name: "Quiver", url: `${safeBase}/` },
    city
      ? {
          name: `${city.name} Surf`,
          url: `${safeBase}/ca/${city.slug}`,
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
