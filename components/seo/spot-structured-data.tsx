import { FAQSchema } from "@/components/seo/faq-schema";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import type { SurfSpot } from "@/lib/data/surf-spots";
import { cityToSlug } from "@/lib/utils/beach-url-utils";

interface SpotStructuredDataProps {
  spot: SurfSpot;
  cityName?: string;
  citySlug?: string;
  /** Two-letter lowercase state slug (e.g. "ca"). Defaults to "ca" for legacy spots route. */
  stateSlug?: string;
  baseUrl: string;
}

export function SpotStructuredData({
  spot,
  cityName,
  citySlug,
  stateSlug,
  baseUrl,
}: SpotStructuredDataProps) {
  const safeBase = baseUrl.replace(/\/$/, "");

  // Beach detail URLs use canonical (non-collision) city slug; the
  // collision-aware citySlug param applies to /[intent]/[city] only.
  const beachUrlCitySlug = (cityName && cityToSlug(cityName)) || citySlug;

  // Build hierarchical URL when city/state data available, else fall back to /spots/
  const beachUrl = beachUrlCitySlug && stateSlug
    ? `${safeBase}/${stateSlug}/${beachUrlCitySlug}/${spot.slug}`
    : `${safeBase}/spots/${spot.slug}`;
  const cityUrl = citySlug && stateSlug
    ? `${safeBase}/${stateSlug}/${citySlug}`
    : citySlug
      ? `${safeBase}/ca/${citySlug}`
      : undefined;

  const breadcrumbs = [
    { name: "Quiver", url: `${safeBase}/` },
    cityName && cityUrl
      ? {
          name: `${cityName} Surf`,
          url: cityUrl,
        }
      : undefined,
    {
      name: `${spot.name} Surf Report`,
      url: beachUrl,
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
