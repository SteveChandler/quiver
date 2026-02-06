"use client";

import React, { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { SessionWizard } from "@/components/session/wizard/SessionWizard";
import { SessionFormMode, SessionFormState } from "@/hooks/use-session-form";
import {
  parseSessionWizardParams,
  extractFormState,
} from "@/lib/utils/session-wizard-params";
import { useAuth } from "@/context/auth-context";
import { ReviewPromptDialog } from "@/components/dialogs/review-prompt-dialog";
import { useReviewPrompt } from "@/hooks/use-review-prompt";
import { REVIEW_TIMEOUTS } from "@/lib/constants/review-tracking";
import { useSessionSubmission } from "./useSessionSubmission";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { ForecastFeedbackFlow } from "./ForecastFeedbackFlow";

interface NewSessionPageContentProps {
  initialFormState?: Partial<SessionFormState>;
  targetStep?: number;
  mode: SessionFormMode;
  convertSessionId?: string | null;
}

function NewSessionPageContent({
  initialFormState,
  targetStep,
  mode,
  convertSessionId,
}: NewSessionPageContentProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Post-session review prompt flow (using custom hook)
  const reviewPrompt = useReviewPrompt({
    autoDismissTimeout: REVIEW_TIMEOUTS.PROMPT_AUTO_DISMISS,
    onReviewSubmit: () => submission.startCelebrationAndRedirect("log"),
    onDismiss: () => submission.startCelebrationAndRedirect("log"),
  });

  // Session submission hook - manages all post-save flows
  const submission = useSessionSubmission({
    mode,
    user,
    reviewPrompt,
    convertSessionId,
  });

  useEffect(() => {
    submission.feedbackResolvedRef.current = submission.feedbackResolved;
  }, [submission.feedbackResolved]);

  // Handle cancellation
  const handleCancel = () => {
    router.push("/profile");
  };

  // Don't render if user is not authenticated
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 relative">
      <SessionWizard
        mode={mode}
        onComplete={submission.handleSessionComplete}
        onCancel={handleCancel}
        className="min-h-screen"
        initialFormState={initialFormState}
        targetStep={targetStep}
      />

      {/* Post-log forecast feedback modal */}
      <ForecastFeedbackFlow
        open={submission.feedbackOpen}
        session={submission.feedbackSession}
        forecast={submission.feedbackForecast}
        submitting={submission.feedbackSubmitting}
        onSubmit={submission.handleSubmitFeedback}
        onSkip={() => submission.handleSkipFeedback("skip")}
      />

      {/* Post-session review prompt modal */}
      <ReviewPromptDialog
        open={reviewPrompt.isOpen}
        reviewData={reviewPrompt.reviewData}
        onSuccess={reviewPrompt.handleSuccess}
        onSkip={() => reviewPrompt.handleSkip("skip")}
      />

      {/* Celebration overlay with share */}
      {submission.showCelebration && (
        <CelebrationOverlay
          mode={mode}
          savedSessionData={submission.savedSessionData}
          createdSessionId={submission.createdSessionId}
          shareSheetOpen={submission.shareSheetOpen}
          onShareSheetOpenChange={submission.handleShareSheetClose}
          onShareSession={submission.handleShareSession}
          onContinue={() => router.push("/profile")}
        />
      )}
    </div>
  );
}

function NewSessionPageWrapper() {
  const searchParams = useSearchParams();

  // Parse and validate URL parameters for wizard prefill
  const parseResult = parseSessionWizardParams(searchParams);

  // Extract mode and convertSessionId from URL (backwards compatible)
  const mode = (searchParams.get("mode") as SessionFormMode) || "plan";
  const convertSessionId = searchParams.get("convert");

  // Prepare initial form state and target step if validation succeeded
  let initialFormState: Partial<SessionFormState> | undefined;
  let targetStep: number | undefined;

  if (parseResult.success) {
    // Convert validated params to form state format
    initialFormState = extractFormState(parseResult.data);
    targetStep = parseResult.data.targetStep;

    // Log successful prefill (development only)
    if (process.env.NODE_ENV === "development") {
      console.log("Session wizard prefill data:", {
        beach: parseResult.data.beachName,
        startTime: parseResult.data.startTime,
        targetStep,
      });
    }
  } else if (
    parseResult.error &&
    parseResult.error !== "No prefill parameters provided"
  ) {
    // Only show warning for actual validation errors, not when user accesses /sessions/new directly
    console.warn(
      "Session wizard parameter validation failed:",
      parseResult.error
    );

    // Optionally show a subtle toast notification (non-blocking)
    if (
      typeof window !== "undefined" &&
      parseResult.error !== "No prefill parameters provided"
    ) {
      // Use setTimeout to avoid SSR issues with toast
      setTimeout(() => {
        toast.warning("Some prefill data was invalid and was ignored");
      }, 100);
    }

    // Use safe defaults from parse result
    initialFormState = parseResult.defaults as Partial<SessionFormState>;
  }

  return (
    <NewSessionPageContent
      initialFormState={initialFormState}
      targetStep={targetStep}
      mode={mode}
      convertSessionId={convertSessionId}
    />
  );
}

export default function NewSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading session form…</p>
          </div>
        </div>
      }
    >
      <NewSessionPageWrapper />
    </Suspense>
  );
}
