import { JsonLd } from "@/components/seo/funnel/JsonLd";
interface WebPageSchemaProps {
  name: string;
  url: string;
  description?: string;
  dateModified?: string;
  additionalData?: Record<string, unknown>;
}

export function WebPageSchema({
  name,
  url,
  description,
  dateModified,
  additionalData,
}: WebPageSchemaProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name,
    url,
    ...(dateModified ? { dateModified } : {}),
    ...(description ? { description } : {}),
    ...additionalData,
  };
  return (
    <JsonLd data={data} />
  );
}
