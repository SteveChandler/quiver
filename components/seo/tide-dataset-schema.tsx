interface TideDatasetSchemaProps {
  cityOrBeachName: string;
  state?: string;
  url: string;
  latitude?: number;
  longitude?: number;
  nextHighTime?: string | null;
  nextHighHeight?: number | null;
  nextLowTime?: string | null;
  nextLowHeight?: number | null;
}

export function TideDatasetSchema({
  cityOrBeachName,
  state,
  url,
  latitude,
  longitude,
  nextHighTime,
  nextHighHeight,
  nextLowTime,
  nextLowHeight,
}: TideDatasetSchemaProps) {
  if (!cityOrBeachName || !url) return null;

  const now = new Date();
  const todayIso = now.toISOString().split("T")[0];
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const sevenDaysLaterIso = sevenDaysLater.toISOString().split("T")[0];

  const placeName = state ? `${cityOrBeachName}, ${state}` : cityOrBeachName;

  const variableMeasured: Array<Record<string, string>> = [];

  if (nextHighTime != null && nextHighHeight != null) {
    variableMeasured.push({
      "@type": "PropertyValue",
      name: "High Tide",
      value: String(nextHighHeight),
      unitText: "ft",
      description: `Next high tide at ${nextHighTime}`,
    });
  }

  if (nextLowTime != null && nextLowHeight != null) {
    variableMeasured.push({
      "@type": "PropertyValue",
      name: "Low Tide",
      value: String(nextLowHeight),
      unitText: "ft",
      description: `Next low tide at ${nextLowTime}`,
    });
  }

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${cityOrBeachName} Tide Chart — ${todayIso}`,
    description: buildDescription(cityOrBeachName, nextHighHeight, nextHighTime, nextLowHeight, nextLowTime),
    url,
    temporalCoverage: `${todayIso}/${sevenDaysLaterIso}`,
    spatialCoverage: {
      "@type": "Place",
      name: placeName,
      ...(latitude != null && longitude != null
        ? {
            geo: {
              "@type": "GeoCoordinates",
              latitude,
              longitude,
            },
          }
        : {}),
    },
    dateModified: now.toISOString(),
    provider: {
      "@type": "Organization",
      name: "Quiver",
      url: "https://www.quiversurf.app",
    },
    license: "https://creativecommons.org/licenses/by/4.0/",
  };

  if (variableMeasured.length > 0) {
    data.variableMeasured = variableMeasured;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

function buildDescription(
  name: string,
  nextHighHeight: number | null | undefined,
  nextHighTime: string | null | undefined,
  nextLowHeight: number | null | undefined,
  nextLowTime: string | null | undefined
): string {
  const parts: string[] = [
    `High and low tide predictions for ${name}.`,
  ];

  if (nextHighHeight != null && nextHighTime != null) {
    parts.push(`Next high tide: ${nextHighHeight}ft at ${nextHighTime},`);
  }

  if (nextLowHeight != null && nextLowTime != null) {
    parts.push(`next low: ${nextLowHeight}ft at ${nextLowTime}.`);
  }

  return parts.join(" ");
}
