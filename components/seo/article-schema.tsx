interface ArticleSchemaProps {
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  datePublished: string;
  dateModified?: string;
  author?: string;
  wordCount?: number;
}

export function ArticleSchema({
  title,
  description,
  url,
  imageUrl,
  datePublished,
  dateModified,
  author = "Quiver",
  wordCount,
}: ArticleSchemaProps) {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";
  const fullUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;
  const fullImageUrl = imageUrl.startsWith("http")
    ? imageUrl
    : `${baseUrl}${imageUrl}`;

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url: fullUrl,
    image: fullImageUrl,
    datePublished,
    dateModified: dateModified || datePublished,
    author: {
      "@type": author === "Quiver" ? "Organization" : "Person",
      name: author,
      ...(author === "Quiver" ? { url: baseUrl } : {}),
    },
    publisher: {
      "@type": "Organization",
      name: "Quiver",
      url: baseUrl,
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/logo.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": fullUrl,
    },
  };

  if (wordCount) {
    data.wordCount = wordCount;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
