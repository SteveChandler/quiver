import { buildRootStructuredDataGraph } from "@/lib/seo/root-structured-data";

export function HomePageStructuredData() {
  const jsonLd = buildRootStructuredDataGraph();

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd),
      }}
    />
  );
}
