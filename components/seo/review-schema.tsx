/**
 * Review Schema Component
 *
 * NOTE: AggregateRating and individual Review markup have been intentionally
 * removed. Google does NOT support review rich snippets for Place or
 * TouristAttraction types — emitting them triggers Search Console "Review
 * snippets" errors. See:
 * https://developers.google.com/search/docs/appearance/structured-data/review-snippet
 *
 * This component is retained as a no-op so existing imports don't break.
 * The BeachPageStructuredData in structured-data.tsx documents the same
 * rationale (lines 150-155).
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

export function ReviewSchema(_props: ReviewSchemaProps) {
  // Intentionally renders nothing. See module-level comment.
  return null;
}
