"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/ui/star-rating";
import { Progress } from "@/components/ui/progress";
import { Waves, Users, Car, MapPin, Star, Plus, Loader2 } from "lucide-react";
import { getBeachReviewStats } from "@/actions/beach-review-actions";
import { useAuth } from "@/context/auth-context";

interface BeachReviewSummaryProps {
  beachId: string;
  onWriteReview?: () => void;
  refreshTrigger?: number;
}

interface ReviewStats {
  total_reviews: number;
  average_overall: number;
  average_wave_quality: number;
  average_crowd_density: number;
  average_parking: number;
  average_accessibility: number;
}

export function BeachReviewSummary({
  beachId,
  onWriteReview,
  refreshTrigger,
}: BeachReviewSummaryProps) {
  const { user } = useAuth();
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const result = await getBeachReviewStats(beachId);
      if (result.success) {
        setStats(result.data);
      } else {
        console.error("Error fetching review stats:", result.error);
      }
    } catch (error) {
      console.error("Error fetching review stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [beachId, refreshTrigger]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  const { total_reviews, average_overall } = stats;

  const categories = [
    {
      name: "Wave Quality",
      value: stats.average_wave_quality,
      icon: <Waves className="h-4 w-4 text-primary" />,
    },
    {
      name: "Crowd Level",
      value: stats.average_crowd_density,
      icon: <Users className="h-4 w-4 text-primary" />,
    },
    {
      name: "Parking",
      value: stats.average_parking,
      icon: <Car className="h-4 w-4 text-primary" />,
    },
    {
      name: "Accessibility",
      value: stats.average_accessibility,
      icon: <MapPin className="h-4 w-4 text-primary" />,
    },
  ];

  return (
    <Card id="reviews-ratings-section">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Reviews & Ratings
          </CardTitle>
          {user && onWriteReview && (
            <Button onClick={onWriteReview} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Write Review
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {total_reviews === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Star className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-lg font-medium mb-2">No reviews yet</p>
            <p className="text-sm">Be the first to review this beach!</p>
            {user && onWriteReview && (
              <Button onClick={onWriteReview} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Write the First Review
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Overall Rating */}
            <div className="text-center space-y-2">
              <div className="text-3xl font-bold">
                {average_overall.toFixed(1)}
              </div>
              <StarRating rating={Math.round(average_overall)} size="lg" />
              <p className="text-sm text-muted-foreground">
                Based on {total_reviews}{" "}
                {total_reviews === 1 ? "review" : "reviews"}
              </p>
            </div>

            {/* Category Breakdown */}
            <div className="space-y-4">
              <h4 className="font-medium">Rating Breakdown</h4>
              <div className="grid gap-3">
                {categories.map((category) => (
                  <div key={category.name} className="flex items-center gap-3">
                    {category.icon}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">
                          {category.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <StarRating
                            rating={Math.round(category.value)}
                            size="sm"
                          />
                          <span className="text-xs text-muted-foreground ml-1">
                            {category.value.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <Progress
                        value={(category.value / 5) * 100}
                        className="h-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rating Distribution */}
            <div className="space-y-3">
              <h4 className="font-medium">Rating Distribution</h4>
              {[5, 4, 3, 2, 1].map((rating) => (
                <div key={rating} className="flex items-center gap-2 text-sm">
                  <span className="w-2">{rating}</span>
                  <Star className="h-3 w-3 text-yellow-500" />
                  <Progress
                    value={0} // We'd need to calculate this from individual reviews
                    className="flex-1 h-2"
                  />
                  <span className="text-xs text-muted-foreground w-8">0</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
