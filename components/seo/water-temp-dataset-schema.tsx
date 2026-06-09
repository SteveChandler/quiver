interface WaterTempDatasetSchemaProps {
  cityOrBeachName: string;
  state?: string;
  url: string;
  latitude?: number;
  longitude?: number;
  tempF?: number | null;
  wetsuitRec?: string | null;
}

export function WaterTempDatasetSchema({
  cityOrBeachName,
  state,
  url,
  latitude,
  longitude,
  tempF,
  wetsuitRec,
}: WaterTempDatasetSchemaProps) {
  if (!cityOrBeachName || !url) return null;

  const now = new Date();
  const roundedTempF = tempF != null ? Math.round(tempF) : null;
  const todayIso = now.toISOString().split("T")[0];
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const sevenDaysLaterIso = sevenDaysLater.toISOString().split("T")[0];

  const placeName = state ? `${cityOrBeachName}, ${state}` : cityOrBeachName;

  const variableMeasured: Array<Record<string, string>> = [];

  if (roundedTempF != null) {
    variableMeasured.push({
      "@type": "PropertyValue",
      name: "Water Temperature",
      value: String(roundedTempF),
      unitText: "°F",
      description: `Current water temperature at ${cityOrBeachName}`,
    });
  }

  if (wetsuitRec != null) {
    variableMeasured.push({
      "@type": "PropertyValue",
      name: "Wetsuit Recommendation",
      value: wetsuitRec,
      description: `Recommended wetsuit thickness for ${cityOrBeachName}`,
    });
  }

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${cityOrBeachName} Water Temperature — ${todayIso}`,
    description: buildDescription(cityOrBeachName, roundedTempF, wetsuitRec),
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
  tempF: number | null | undefined,
  wetsuitRec: string | null | undefined
): string {
  const parts: string[] = [
    `Current water temperature data for ${name}.`,
  ];

  if (tempF != null) {
    parts.push(`Current water temperature: ${tempF}°F.`);
  }

  if (wetsuitRec != null) {
    parts.push(`Recommended wetsuit: ${wetsuitRec}.`);
  }

  return parts.join(" ");
}
