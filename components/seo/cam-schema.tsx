import type { CamBeachWithRegion } from "@/actions/beach/cam-actions";

interface CamSchemaProps {
  beaches: CamBeachWithRegion[];
}

/**
 * VideoObject structured data for surf cam pages.
 * Generates one VideoObject per camera for rich search results.
 */
export function CamSchema({ beaches }: CamSchemaProps) {
  const items = beaches.map((beach) => ({
    "@type": "VideoObject" as const,
    name: `${beach.name} Live Surf Cam`,
    description: `Live surf cam at ${beach.name} in ${beach.city}, ${beach.state}. Watch real-time wave conditions.`,
    thumbnailUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app"}/images/buoy.png`,
    uploadDate: "2026-01-01",
    contentUrl: beach.camera_url,
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": items,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
