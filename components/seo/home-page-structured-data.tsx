import { JsonLd } from "@/components/seo/funnel/JsonLd";
import { buildRootStructuredDataGraph } from "@/lib/seo/root-structured-data";

export function HomePageStructuredData() {
  const jsonLd = buildRootStructuredDataGraph();

  return (
    <JsonLd data={jsonLd} />
  );
}
