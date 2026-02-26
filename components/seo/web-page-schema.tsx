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
    dateModified: dateModified ?? new Date().toISOString(),
    ...(description ? { description } : {}),
    ...additionalData,
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
