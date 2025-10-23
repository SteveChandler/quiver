"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  voteForecastAccuracy,
  getUserForecastVote,
  type ForecastVoteInput,
} from "@/actions/forecast-verification-actions";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { useRouter, usePathname } from "next/navigation";

interface ForecastVerificationWidgetProps {
  forecastId: string;
  beachId: string;
  className?: string;
  onVoteSuccess?: () => void;
}

/**
 * ForecastVerificationWidget - Interactive widget for users to verify forecast accuracy
 *
 * Allows authenticated users to vote on whether a forecast was accurate,
 * with optional notes. Users can vote once per forecast and update their vote.
 *
 * Part of the forecast transparency and community engagement feature set.
 */
export function ForecastVerificationWidget({
  forecastId,
  beachId,
  className,
  onVoteSuccess,
}: ForecastVerificationWidgetProps) {
  const [selectedVote, setSelectedVote] = useState<boolean | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const redirectTo =
    pathname && pathname.length > 0 ? pathname : `/forecast/${beachId}`;

  // Fetch existing vote
  const fetchExistingVote = useCallback(async () => {
    try {
      const result = await getUserForecastVote(forecastId);

      if (result.success) {
        return result.data ?? null;
      }

      if (result.error) {
        throw new Error(result.error);
      }

      return null;
    } catch (error) {
      console.error("Failed to fetch existing vote:", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to fetch existing vote");
    }
  }, [forecastId]);

  const {
    data: existingVote,
    loading: loadingVote,
    error: fetchVoteError,
    refetch: refetchExistingVote,
  } = useDataFetcher(fetchExistingVote, { skip: !isAuthenticated });

  useEffect(() => {
    if (fetchVoteError && isAuthenticated) {
      const message =
        typeof fetchVoteError === "string"
          ? fetchVoteError
          : "Failed to load your previous verification";
      toast.error(message);
    }
  }, [fetchVoteError, isAuthenticated]);

  // Initialize form with existing vote if present
  useEffect(() => {
    if (existingVote) {
      setSelectedVote(existingVote.was_accurate);
      setNotes(existingVote.notes || "");
      setHasSubmitted(true);
    }
  }, [existingVote]);

  const handleVote = async (wasAccurate: boolean) => {
    // Toggle if clicking same button, otherwise set new vote
    const newVote = selectedVote === wasAccurate ? null : wasAccurate;
    setSelectedVote(newVote);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedVote === null) {
      toast.error("Please select whether the forecast was accurate");
      return;
    }

    setIsSubmitting(true);

    try {
      const voteInput: ForecastVoteInput = {
        forecastId,
        beachId,
        wasAccurate: selectedVote,
        notes: notes.trim() || undefined,
      };

      const result = await voteForecastAccuracy(voteInput);

      if (result.success) {
        setHasSubmitted(true);
        const isUpdate = result.data?.isUpdate;
        await refetchExistingVote();
        toast.success(
          isUpdate
            ? "Your verification has been updated"
            : "Thanks for verifying this forecast!"
        );
        onVoteSuccess?.();
      } else {
        toast.error(result.error || "Failed to submit verification");
      }
    } catch (error) {
      console.error("Error submitting verification:", error);
      toast.error("An error occurred while submitting your verification");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormChanged =
    selectedVote !== existingVote?.was_accurate ||
    (notes.trim() || "") !== (existingVote?.notes || "");

  if (!isAuthenticated) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            Verify This Forecast
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Sign in to vote on forecast accuracy, share notes, and help the
            community surf smarter.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button
              onClick={() =>
                router.push(
                  `/auth/sign-in?redirectTo=${encodeURIComponent(redirectTo)}`
                )
              }
              className="w-full sm:w-auto"
              disabled={authLoading}
            >
              <ThumbsUp className="w-4 h-4 mr-2" />
              Sign In to Verify
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                router.push(
                  `/auth/sign-up?redirectTo=${encodeURIComponent(redirectTo)}`
                )
              }
              className="w-full sm:w-auto"
              disabled={authLoading}
            >
              Join Quiver
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loadingVote) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2
            role="img"
            aria-hidden="true"
            className="w-6 h-6 animate-spin text-muted-foreground"
          />
        </CardContent>
      </Card>
    );
  }

  if (fetchVoteError) {
    const message =
      typeof fetchVoteError === "string"
        ? fetchVoteError
        : "Please try again.";

    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-8 text-center">
          <XCircle className="w-8 h-8 text-red-500" />
          <div>
            <p className="font-medium">Unable to load your verification</p>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={refetchExistingVote}
            disabled={isSubmitting}
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          {hasSubmitted ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Your Verification
            </>
          ) : (
            <>Was this forecast accurate?</>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Vote buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant={selectedVote === true ? "default" : "outline"}
              onClick={() => handleVote(true)}
              disabled={isSubmitting}
              className={cn(
                "flex-1",
                selectedVote === true &&
                  "bg-green-600 hover:bg-green-700 text-white"
              )}
            >
              <ThumbsUp className="w-4 h-4 mr-2" />
              Accurate
            </Button>
            <Button
              type="button"
              variant={selectedVote === false ? "default" : "outline"}
              onClick={() => handleVote(false)}
              disabled={isSubmitting}
              className={cn(
                "flex-1",
                selectedVote === false &&
                  "bg-red-600 hover:bg-red-700 text-white"
              )}
            >
              <ThumbsDown className="w-4 h-4 mr-2" />
              Inaccurate
            </Button>
          </div>

          {/* Optional notes */}
          {selectedVote !== null && (
            <div className="space-y-2">
              <label
                htmlFor="verification-notes"
                className="text-sm font-medium"
              >
                Notes (optional)
              </label>
              <Textarea
                id="verification-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any details about conditions..."
                disabled={isSubmitting}
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {notes.length}/500 characters
              </p>
            </div>
          )}

          {/* Submit button */}
          {selectedVote !== null && (
            <div className="flex justify-between items-center">
              {hasSubmitted && !isFormChanged ? (
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              ) : (
                <div></div>
              )}
              <Button
                type="submit"
                disabled={isSubmitting || (hasSubmitted && !isFormChanged)}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : hasSubmitted && isFormChanged ? (
                  "Update Verification"
                ) : hasSubmitted ? (
                  "Verified"
                ) : (
                  "Submit Verification"
                )}
              </Button>
            </div>
          )}
        </form>

        {/* Help text */}
        {!hasSubmitted && (
          <p className="text-xs text-muted-foreground mt-4">
            Help the community by verifying forecast accuracy. Your feedback
            helps everyone make better surf decisions.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
