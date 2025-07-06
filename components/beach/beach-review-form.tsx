"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Star, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import {
  createBeachReview,
  updateBeachReview,
} from "@/actions/beach-review-actions";
import { useAuth } from "@/context/auth-context";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { BeachReviewWithUser } from "@/types/database";

interface BeachReviewFormProps {
  beachId: string;
  beachName: string;
  existingReview?: BeachReviewWithUser;
  onSuccess?: () => void;
  onCancel?: () => void;
  isInDialog?: boolean;
}

interface ReviewFormData {
  overall_rating: number;
  wave_quality_rating: number;
  crowd_density_rating: number;
  parking_rating: number;
  accessibility_rating: number;
  title: string;
  content: string;
  visit_date?: Date;
}

export function BeachReviewForm({
  beachId,
  beachName,
  existingReview,
  onSuccess,
  onCancel,
  isInDialog = false,
}: BeachReviewFormProps) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [formData, setFormData] = useState<ReviewFormData>({
    overall_rating: existingReview?.overall_rating || 0,
    wave_quality_rating: existingReview?.wave_quality_rating || 0,
    crowd_density_rating: existingReview?.crowd_density_rating || 0,
    parking_rating: existingReview?.parking_rating || 0,
    accessibility_rating: existingReview?.accessibility_rating || 0,
    title: existingReview?.title || "",
    content: existingReview?.content || "",
    visit_date: existingReview?.visit_date
      ? new Date(existingReview.visit_date)
      : undefined,
  });

  const handleRatingChange = (
    category: keyof ReviewFormData,
    rating: number
  ) => {
    setFormData((prev) => ({ ...prev, [category]: rating }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validation
    if (
      formData.overall_rating === 0 ||
      formData.wave_quality_rating === 0 ||
      formData.crowd_density_rating === 0 ||
      formData.parking_rating === 0 ||
      formData.accessibility_rating === 0
    ) {
      toast({
        title: "Missing Ratings",
        description: "Please provide ratings for all categories.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.title.trim() || !formData.content.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both a title and review content.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const reviewData = {
        beach_id: beachId,
        user_id: user.id,
        overall_rating: formData.overall_rating,
        wave_quality_rating: formData.wave_quality_rating,
        crowd_density_rating: formData.crowd_density_rating,
        parking_rating: formData.parking_rating,
        accessibility_rating: formData.accessibility_rating,
        title: formData.title.trim(),
        content: formData.content.trim(),
        visit_date: formData.visit_date?.toISOString().split("T")[0],
      };

      let result;
      if (existingReview) {
        // Update existing review
        result = await updateBeachReview(existingReview.id, reviewData);
      } else {
        // Create new review
        result = await createBeachReview(reviewData);
      }

      if (result.success) {
        toast({
          title: existingReview ? "Review Updated" : "Review Posted",
          description: `Your review for ${beachName} has been ${
            existingReview ? "updated" : "posted"
          } successfully.`,
        });
        onSuccess?.();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to save review",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error submitting review:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderStarRating = (
    category: keyof ReviewFormData,
    label: string,
    icon: React.ReactNode
  ) => {
    const rating = formData[category] as number;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {icon}
          <Label className="text-sm font-medium">{label}</Label>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => handleRatingChange(category, star)}
              className="p-1 hover:scale-110 transition-transform"
            >
              <Star
                className={`h-6 w-6 ${
                  star <= rating
                    ? "text-yellow-500 fill-yellow-500"
                    : "text-gray-300 hover:text-yellow-300"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    );
  };

  if (!user) {
    const signInMessage = (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">
          Please sign in to write a review.
        </p>
      </div>
    );

    return isInDialog ? (
      signInMessage
    ) : (
      <Card>
        <CardContent>{signInMessage}</CardContent>
      </Card>
    );
  }

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Star Ratings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderStarRating(
          "overall_rating",
          "Overall Experience",
          <Star className="h-4 w-4" />
        )}
        {renderStarRating(
          "wave_quality_rating",
          "Wave Quality",
          <Star className="h-4 w-4" />
        )}
        {renderStarRating(
          "crowd_density_rating",
          "Crowd Level",
          <Star className="h-4 w-4" />
        )}
        {renderStarRating(
          "parking_rating",
          "Parking",
          <Star className="h-4 w-4" />
        )}
        {renderStarRating(
          "accessibility_rating",
          "Accessibility",
          <Star className="h-4 w-4" />
        )}
      </div>

      {/* Visit Date */}
      <div className="space-y-2">
        <Label htmlFor="visit-date">Visit Date (Optional)</Label>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !formData.visit_date && "text-muted-foreground"
              )}
              type="button"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formData.visit_date ? (
                format(formData.visit_date, "PPP")
              ) : (
                <span>When did you visit?</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={formData.visit_date}
              onSelect={(date) => {
                setFormData((prev) => ({
                  ...prev,
                  visit_date: date || undefined,
                }));
                if (date) {
                  setCalendarOpen(false);
                }
              }}
              disabled={(date) =>
                date > new Date() || date < new Date("1900-01-01")
              }
              initialFocus
            />
            <div className="p-3 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, visit_date: undefined }));
                  setCalendarOpen(false);
                }}
                type="button"
              >
                Clear Date
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Review Title</Label>
        <Input
          id="title"
          placeholder="Summarize your experience..."
          value={formData.title}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, title: e.target.value }))
          }
          maxLength={200}
        />
      </div>

      {/* Content */}
      <div className="space-y-2">
        <Label htmlFor="content">Your Review</Label>
        <Textarea
          id="content"
          placeholder="Share your detailed experience at this beach..."
          value={formData.content}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, content: e.target.value }))
          }
          className="min-h-[120px]"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {existingReview ? "Updating..." : "Posting..."}
            </>
          ) : existingReview ? (
            "Update Review"
          ) : (
            "Post Review"
          )}
        </Button>
      </div>
    </form>
  );

  return isInDialog ? (
    <div className="space-y-4">{formContent}</div>
  ) : (
    <Card>
      <CardHeader>
        <CardTitle>
          {existingReview ? "Edit Your Review" : "Write a Review"} for{" "}
          {beachName}
        </CardTitle>
      </CardHeader>
      <CardContent>{formContent}</CardContent>
    </Card>
  );
}
