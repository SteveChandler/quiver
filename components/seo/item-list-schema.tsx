/**
 * ItemList Schema Component
 * Provides structured data for listing pages to target Google carousel SERP features.
 */

interface ItemListItem {
  name: string;
  url: string;
  position: number;
  image?: string;
}

interface ItemListSchemaProps {
  items: ItemListItem[];
  name: string;
}

export function ItemListSchema({ items, name }: ItemListSchemaProps) {
  if (items.length < 3) return null;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item) => {
      const listItem: Record<string, unknown> = {
        "@type": "ListItem",
        position: item.position,
        name: item.name,
        url: item.url,
      };
      if (item.image) {
        listItem.image = item.image;
      }
      return listItem;
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData),
      }}
    />
  );
}
