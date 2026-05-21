interface ArticleSchemaProps {
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  datePublished: string;
  dateModified?: string;
  author?: string;
  wordCount?: number;
  articleSection?: string;
  keywords?: string[];
  type?: "Article" | "BlogPosting";
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
  articleSection,
  keywords,
  type = "Article",
}: ArticleSchemaProps) {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";
  const fullUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;
  const fullImageUrl = imageUrl.startsWith("http")
    ? imageUrl
    : `${baseUrl}${imageUrl}`;

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": type,
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
        url: `${baseUrl}/quiver-app-icon.png`,
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
  if (articleSection) {
    data.articleSection = articleSection;
  }
  if (keywords && keywords.length > 0) {
    data.keywords = keywords.join(", ");
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
