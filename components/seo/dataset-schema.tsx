/**
 * Dataset structured data for a buoy-record CSV. Describes only the stations
 * the page actually uses and the file readers can download.
 */
import type { SurfClimatologyDataset } from "@/lib/climatology/types";
import { SITE_URL } from "@/lib/constants/seo";

interface DatasetSchemaProps {
  dataset: SurfClimatologyDataset;
  csvPath: string;
}

export function DatasetSchema({ dataset, csvPath }: DatasetSchemaProps) {
  const used = dataset.stations.filter((station) => station.gate === "passed");
  const hasWind = used.some((station) => station.role === "wind");
  const years = used.flatMap((station) => station.yearsUsed);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${dataset.cityName} monthly buoy statistics`,
    description:
      `Monthly buoy wave height, swell period and direction, water temperature${hasWind ? " and wind" : ""} for ` +
      `${dataset.cityName}, computed by Quiver from hourly NOAA${used.some((s) => s.kind === "iem-asos") ? " and ASOS" : ""} ` +
      "observations. Heights are buoy readings, not surf height at the beach.",
    creator: { "@type": "Organization", name: "Quiver", url: SITE_URL },
    isBasedOn: used.map((station) => station.pageUrl),
    temporalCoverage: `${Math.min(...years)}-01-01/${Math.max(...years)}-12-31`,
    spatialCoverage: {
      "@type": "Place",
      name: dataset.reference.label,
      geo: { "@type": "GeoCoordinates", latitude: dataset.reference.lat, longitude: dataset.reference.lon },
    },
    variableMeasured: [
      "Significant wave height",
      "Dominant wave period",
      "Mean wave direction",
      "Water temperature",
      ...(hasWind ? ["Wind speed", "Wind direction"] : []),
    ],
    dateModified: dataset.generatedAt,
    distribution: [{ "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${SITE_URL}${csvPath}` }],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
