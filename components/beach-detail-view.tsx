"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, MapPin, Waves, Users, Car, Loader2 } from "lucide-react";
import { BeachesEnhancedForecast } from "@/components/beaches-enhanced-forecast";
import { BeachHeader } from "@/components/beach-detail/beach-header";
import { BeachHero } from "@/components/beach-detail/beach-hero";
import { BeachQuickActions } from "@/components/beach-detail/beach-quick-actions";

import { BeachReviewSummary } from "@/components/beach/beach-review-summary";
import { BeachReviewsList } from "@/components/beach/beach-reviews-list";
import { BeachReviewForm } from "@/components/beach/beach-review-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import Link from "next/link";
import { useEnhancedBeachData } from "@/hooks/use-enhanced-beach-data";
import { useBeachReviews } from "@/hooks/use-beach-reviews";
import type { BeachReviewWithUser } from "@/types/database";
import { useAuth } from "@/context/auth-context";
import { getStaticMapImageUrl } from "@/lib/map-utils";
import { MAP_PRESET_USAGE } from "@/lib/constants/map-presets";

interface BeachDetailViewProps {
  id: string;
}

export function BeachDetailView({ id }: BeachDetailViewProps) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [editingReview, setEditingReview] =
    useState<BeachReviewWithUser | null>(null);
  const [activeTab, setActiveTab] = useState("reviews");

  // Use enhanced beach data hook with caching
  const {
    beach,
    forecasts,
    sessions,
    forecastDates,
    loading: beachLoading,
    error: beachError,
    sessionsLoading,
  } = useEnhancedBeachData(id);

  // Use beach reviews hook with operations
  const { refresh: refreshReviews } = useBeachReviews(id, {
    userId: user?.id,
    immediate: false, // We'll load reviews when the reviews tab is opened
  });

  // Handle URL parameters for tab navigation
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["reviews", "info", "gallery"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Handle scrolling to reviews section when reviews tab becomes active
  useLayoutEffect(() => {
    if (activeTab === "reviews" && searchParams.get("tab") === "reviews") {
      // Try to scroll immediately since useLayoutEffect runs before paint
      const scrollToReviews = () => {
        const reviewsElement = document.getElementById(
          "reviews-ratings-section"
        );

        if (reviewsElement) {
          // Jump instantly to reviews section
          reviewsElement.scrollIntoView({
            behavior: "instant",
            block: "center",
            inline: "nearest",
          });
        } else {
          // If element not found, try again after a short delay
          setTimeout(scrollToReviews, 50);
        }
      };

      // Try immediately first
      scrollToReviews();
    }
  }, [activeTab, searchParams]);

  // Review handlers
  const handleWriteReview = () => {
    setEditingReview(null);
    setReviewDialogOpen(true);
  };

  const handleEditReview = (review: BeachReviewWithUser) => {
    setEditingReview(review);
    setReviewDialogOpen(true);
  };

  const handleReviewSuccess = () => {
    setReviewDialogOpen(false);
    setEditingReview(null);
    refreshReviews();
  };

  if (beachLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (beachError || !beach) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">
            {beachError || "Beach not found"}
          </h2>
          <Link href="/map">
            <Button>Back to Map</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <BeachHeader beachName={beach.name} />

      {/* Hero Image */}
      <BeachHero
        beach={beach}
        mapImageUrl={getStaticMapImageUrl(
          typeof beach.latitude === "number" ? beach.latitude : 32.7507,
          typeof beach.longitude === "number" ? beach.longitude : -117.254,
          MAP_PRESET_USAGE.BEACH_HERO
        )}
      />

      {/* Quick Actions */}
      <BeachQuickActions beach={beach} isAuthenticated={!!user} />

      {/* Main Content */}
      <main
        id="beach-main-content"
        className="flex-1 container px-4 py-2 space-y-6 overflow-auto pb-20"
      >
        {/* Enhanced Forecast - Primary Display */}
        <BeachesEnhancedForecast
          beachId={beach.id}
          beachName={beach.name}
          showHeader={true}
          defaultDays={10}
        />

        {/* Additional Tabs */}
        <Tabs
          id="beach-tabs"
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="gallery">Gallery</TabsTrigger>
          </TabsList>

          <TabsContent value="reviews" className="space-y-6">
            <BeachReviewSummary
              beachId={beach.id}
              onWriteReview={handleWriteReview}
            />
            <BeachReviewsList
              beachId={beach.id}
              onEditReview={handleEditReview}
            />
          </TabsContent>

          <TabsContent value="info" className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-2">Beach Information</h3>
                <p className="text-sm">
                  {beach.description || "No description available."}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="font-medium">Ratings & Reviews</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Waves className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Wave Quality
                      </p>
                      <div className="flex">
                        {Array(5)
                          .fill(0)
                          .map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i < Math.round(beach.wave_quality_rating || 0)
                                  ? "text-yellow-500 fill-yellow-500"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Crowd Density
                      </p>
                      <div className="flex">
                        {Array(5)
                          .fill(0)
                          .map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i < Math.round(beach.crowd_density_rating || 0)
                                  ? "text-yellow-500 fill-yellow-500"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Car className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Parking</p>
                      <div className="flex">
                        {Array(5)
                          .fill(0)
                          .map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i < Math.round(beach.parking_rating || 0)
                                  ? "text-yellow-500 fill-yellow-500"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Accessibility
                      </p>
                      <div className="flex">
                        {Array(5)
                          .fill(0)
                          .map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i < Math.round(beach.accessibility_rating || 0)
                                  ? "text-yellow-500 fill-yellow-500"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => {
                    // Switch to reviews tab
                    const reviewsTab = document.querySelector(
                      '[value="reviews"]'
                    ) as HTMLButtonElement;
                    reviewsTab?.click();
                  }}
                >
                  View All Reviews
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gallery" className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className="aspect-square relative rounded-md overflow-hidden bg-muted"
                >
                  <img
                    src={`/placeholder.svg?height=200&width=200`}
                    alt={`Gallery image ${i}`}
                    className="object-cover w-full h-full"
                  />
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="w-full">
              View All Photos
            </Button>
          </TabsContent>
        </Tabs>
      </main>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingReview ? "Edit Your Review" : "Write a Review"} for{" "}
              {beach?.name || "Beach"}
            </DialogTitle>
            <DialogDescription>
              Share your experience and help other surfers discover great spots.
            </DialogDescription>
          </DialogHeader>
          <BeachReviewForm
            beachId={beach.id}
            beachName={beach.name}
            existingReview={editingReview || undefined}
            onSuccess={handleReviewSuccess}
            onCancel={() => setReviewDialogOpen(false)}
            isInDialog={true}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
