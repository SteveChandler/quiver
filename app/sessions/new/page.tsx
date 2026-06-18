"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { SessionScrollForm } from "@/components/session-forms/SessionScrollForm";
import { SessionFormMode, SessionFormState } from "@/hooks/use-session-form";
import {
  parseSessionWizardParams,
  extractFormState,
} from "@/lib/utils/session-wizard-params";
import { useAuth } from "@/context/auth-context";
import { FormErrorBoundary } from "@/components/error-boundaries";
import { useSessionSubmission } from "./useSessionSubmission";
import { PostSessionShare } from "@/components/session/post-session-share";
import { ShareSheet } from "@/components/share/share-sheet";
import { useNearestBeach } from "@/hooks/use-nearest-beach";

interface NewSessionPageContentProps {
  initialFormState?: Partial<SessionFormState>;
  mode: SessionFormMode;
  forecastFeedbackId?: string;
}

function NewSessionPageContent({
  initialFormState,
  mode,
  forecastFeedbackId,
}: NewSessionPageContentProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Auto-detect nearest beach for quick-log mode
  const nearestBeach = useNearestBeach({
    urlBeachId: initialFormState?.selectedBeachId,
    urlBeachName: initialFormState?.selectedBeach,
    skipGps: mode !== "log",
  });

  // Session submission hook - manages all post-save flows
  const submission = useSessionSubmission({
    mode,
    user,
    forecastFeedbackId,
  });

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
          <p className="text-gray-600">Paddling out...</p>
        </div>
      </div>
    );
  }

  // Derive display props from saved session data
  const beachName =
    submission.savedSessionData?.selectedBeach ||
    submission.savedSessionData?.selectedBeachId ||
    "";
  const overallRating = submission.savedSessionData?.overallRating
    ? Number(submission.savedSessionData.overallRating)
    : 0;
  const waveSize =
    submission.savedSessionData?.waveSize ||
    submission.savedSessionData?.waveHeight ||
    "";

  return (
    <div className="min-h-screen bg-gray-50 relative">
      <FormErrorBoundary formId="session-form">
        <SessionScrollForm
          initialMode={mode}
          onComplete={submission.handleSessionComplete}
          onCancel={handleCancel}
          className="min-h-screen"
          initialFormState={
            // Pre-fill beach from auto-detection when high confidence
            nearestBeach.confidence === "high" && nearestBeach.beach
              ? {
                  ...initialFormState,
                  selectedBeachId: initialFormState?.selectedBeachId || nearestBeach.beach.id,
                  selectedBeach: initialFormState?.selectedBeach || nearestBeach.beach.name,
                }
              : initialFormState
          }
          quickMode={mode === "log"}
          detectedBeach={nearestBeach.beach}
          detectedSource={nearestBeach.source}
          detectedConfidence={nearestBeach.confidence}
        />
      </FormErrorBoundary>

      {/* Post-session share prompt — rendered after a successful log */}
      {submission.showSharePrompt && mode === "log" && (
        <>
          {!submission.shareSheetOpen && (
            <PostSessionShare
              beachName={beachName}
              overallRating={overallRating}
              waveSize={waveSize}
              onShare={submission.handleShareSession}
              onSkip={submission.handleSkipShare}
              shareCardUrl={submission.shareCardUrl ?? undefined}
            />
          )}
          {submission.shareCardUrl && (
            <ShareSheet
              open={submission.shareSheetOpen}
              onOpenChange={submission.handleShareSheetClose}
              imageUrl={submission.shareCardUrl}
              type="session"
              filename="quiver-session"
              title="Check out my session!"
              text={
                beachName
                  ? `Just logged a session at ${beachName} on Quiver.`
                  : "Just logged a surf session on Quiver."
              }
              shareUrl={
                submission.createdSessionId
                  ? `/sessions/${submission.createdSessionId}`
                  : undefined
              }
            />
          )}
        </>
      )}
    </div>
  );
}

function NewSessionPageWrapper() {
  const searchParams = useSearchParams();

  // Parse and validate URL parameters for wizard prefill
  const parseResult = parseSessionWizardParams(searchParams);

  const mode: SessionFormMode = "log";

  // Prepare initial form state if validation succeeded
  let initialFormState: Partial<SessionFormState> | undefined;
  let forecastFeedbackId: string | undefined;

  if (parseResult.success) {
    // Convert validated params to form state format
    initialFormState = extractFormState(parseResult.data);
    forecastFeedbackId = parseResult.data.forecastFeedbackId;

    // Log successful prefill (development only)
    if (process.env.NODE_ENV === "development") {
      console.log("Session form prefill data:", {
        beach: parseResult.data.beachName,
        startTime: parseResult.data.startTime,
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
      mode={mode}
      forecastFeedbackId={forecastFeedbackId}
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
