/**
 * Utility functions for calculating review statistics
 */

interface ReviewRatings {
  overall_rating: number;
  wave_quality_rating: number;
  crowd_density_rating: number;
  parking_rating: number;
  accessibility_rating: number;
}

export interface ReviewStats {
  total_reviews: number;
  average_overall: number;
  average_wave_quality: number;
  average_crowd_density: number;
  average_parking: number;
  average_accessibility: number;
}

/**
 * Calculate review statistics from an array of reviews
 */
export function calculateReviewStats(reviews: ReviewRatings[]): ReviewStats {
  if (reviews.length === 0) {
    return {
      total_reviews: 0,
      average_overall: 0,
      average_wave_quality: 0,
      average_crowd_density: 0,
      average_parking: 0,
      average_accessibility: 0,
    };
  }

  return {
    total_reviews: reviews.length,
    average_overall:
      reviews.reduce((sum, r) => sum + r.overall_rating, 0) / reviews.length,
    average_wave_quality:
      reviews.reduce((sum, r) => sum + r.wave_quality_rating, 0) /
      reviews.length,
    average_crowd_density:
      reviews.reduce((sum, r) => sum + r.crowd_density_rating, 0) /
      reviews.length,
    average_parking:
      reviews.reduce((sum, r) => sum + r.parking_rating, 0) / reviews.length,
    average_accessibility:
      reviews.reduce((sum, r) => sum + r.accessibility_rating, 0) /
      reviews.length,
  };
}

/**
 * Calculate beach average ratings (subset of full stats)
 */
export function calculateBeachAverageRatings(reviews: ReviewRatings[]) {
  if (reviews.length === 0) {
    return {};
  }

  return {
    wave_quality_rating:
      reviews.reduce((sum, r) => sum + r.wave_quality_rating, 0) /
      reviews.length,
    crowd_density_rating:
      reviews.reduce((sum, r) => sum + r.crowd_density_rating, 0) /
      reviews.length,
    parking_rating:
      reviews.reduce((sum, r) => sum + r.parking_rating, 0) / reviews.length,
    accessibility_rating:
      reviews.reduce((sum, r) => sum + r.accessibility_rating, 0) /
      reviews.length,
  };
}

/**
 * Group reviews by beach_id and calculate stats for multiple beaches
 */
export function calculateMultipleBeachStats(
  reviews: (ReviewRatings & { beach_id: string })[],
  beachIds: string[]
): Record<string, ReviewStats> {
  // Initialize all beaches with zero stats
  const beachStats: Record<string, ReviewStats> = {};
  beachIds.forEach((beachId) => {
    beachStats[beachId] = calculateReviewStats([]);
  });

  if (reviews.length === 0) {
    return beachStats;
  }

  // Group reviews by beach_id
  const reviewsByBeach = reviews.reduce((acc, review) => {
    if (!acc[review.beach_id]) {
      acc[review.beach_id] = [];
    }
    acc[review.beach_id].push(review);
    return acc;
  }, {} as Record<string, typeof reviews>);

  // Calculate stats for each beach that has reviews
  Object.entries(reviewsByBeach).forEach(([beachId, beachReviews]) => {
    beachStats[beachId] = calculateReviewStats(beachReviews);
  });

  return beachStats;
}
