import { JsonLd } from "@/components/seo/funnel/JsonLd";
/**
 * Breadcrumb Structured Data Component
 * Provides breadcrumb navigation schema for SEO
 */

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbStructuredDataProps {
  items: BreadcrumbItem[];
}

export function BreadcrumbStructuredData({
  items,
}: BreadcrumbStructuredDataProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <JsonLd data={schema} />
  );
}
