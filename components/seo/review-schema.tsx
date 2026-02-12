/**
 * Review Schema Component
 * Provides structured data for beach reviews to enhance SEO with review rich snippets.
 */

export interface ReviewSchemaItem {
  author: string;
  datePublished: string;
  reviewRating: number;
  reviewBody?: string;
}

interface ReviewSchemaProps {
  beachName: string;
  beachUrl: string;
  reviews: ReviewSchemaItem[];
  aggregateRating?: number;
  reviewCount?: number;
}

export function ReviewSchema({
  beachName,
  beachUrl,
  reviews,
  aggregateRating,
  reviewCount,
}: ReviewSchemaProps) {
  if (reviews.length === 0) return null;

  const structuredData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": ["Place", "TouristAttraction"],
    name: beachName,
    url: beachUrl,
  };

  if (aggregateRating && reviewCount && reviewCount > 0) {
    structuredData.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: aggregateRating.toFixed(1),
      bestRating: "5",
      worstRating: "1",
      reviewCount,
    };
  }

  // Filter reviews to only include valid ratings (1-5 range) and limit to top 5
  const validReviews = reviews
    .filter((r) => r.reviewRating >= 1 && r.reviewRating <= 5)
    .slice(0, 5);

  structuredData.review = validReviews.map((r) => ({
    "@type": "Review",
    author: {
      "@type": "Person",
      name: r.author,
    },
    datePublished: r.datePublished,
    reviewRating: {
      "@type": "Rating",
      ratingValue: r.reviewRating,
      bestRating: "5",
      worstRating: "1",
    },
    ...(r.reviewBody ? { reviewBody: r.reviewBody } : {}),
  }));

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
      }}
    />
  );
}
