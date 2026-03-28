interface LiveCamSchemaProps {
  beachName: string;
  cameraUrl: string;
  thumbnailUrl?: string;
  pageUrl: string;
}

export function LiveCamSchema({
  beachName,
  cameraUrl,
  thumbnailUrl,
  pageUrl,
}: LiveCamSchemaProps) {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";
  const fullPageUrl = pageUrl.startsWith("http")
    ? pageUrl
    : `${baseUrl}${pageUrl}`;

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const data = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: `${beachName} Live Surf Cam`,
    description: `Live surf cam at ${beachName}. Watch real-time wave and wind conditions before you paddle out.`,
    thumbnailUrl: thumbnailUrl || `${baseUrl}/api/og/beach?name=${encodeURIComponent(beachName)}`,
    contentUrl: cameraUrl,
    uploadDate: today.toISOString().split("T")[0],
    publication: {
      "@type": "BroadcastEvent",
      name: `Live ${beachName} Surf Cam`,
      isLiveBroadcast: true,
      startDate: today.toISOString().split("T")[0],
      endDate: tomorrow.toISOString().split("T")[0],
      location: {
        "@type": "Place",
        name: beachName,
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
