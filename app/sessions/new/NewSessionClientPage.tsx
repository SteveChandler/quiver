"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { SessionScrollForm } from "@/components/session-forms/SessionScrollForm";
import type { SessionFormMode, SessionFormState } from "@/hooks/use-session-form";
import {
  parseSessionWizardParams,
  extractFormState,
} from "@/lib/utils/session-wizard-params";
import { useAuth } from "@/context/auth-context";
import { FormErrorBoundary } from "@/components/error-boundaries";
import { PostSessionShare } from "@/components/session/post-session-share";
import { ShareSheet } from "@/components/share/share-sheet";
import { useNearestBeach } from "@/hooks/use-nearest-beach";
import {
  buildSessionEmailWebSignInUrl,
  buildSessionNativeAppUrl,
  EmailSessionAppBridge,
  isSessionEmailAppBridgeRequest,
} from "./email-app-bridge";
import { useSessionSubmission } from "./useSessionSubmission";

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
  const { user } = useAuth();

  const nearestBeach = useNearestBeach({
    urlBeachId: initialFormState?.selectedBeachId,
    urlBeachName: initialFormState?.selectedBeach,
    skipGps: mode !== "log",
  });

  const submission = useSessionSubmission({
    mode,
    user,
    forecastFeedbackId,
  });

  const handleCancel = () => {
    router.push("/profile");
  };

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
              beachId={submission.savedSessionData?.selectedBeachId || undefined}
              sessionId={submission.createdSessionId ?? undefined}
              initialPhoto={submission.savedSessionData?.photos?.[0] ?? null}
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
  const { isAuthenticated } = useAuth();
  const [continueOnWeb, setContinueOnWeb] = useState(false);
  const parseResult = parseSessionWizardParams(searchParams);
  const emailBridgeSearchParams = new URLSearchParams(searchParams.toString());
  const shouldShowEmailBridge =
    !continueOnWeb && isSessionEmailAppBridgeRequest(emailBridgeSearchParams);

  const mode: SessionFormMode = "log";
  let initialFormState: Partial<SessionFormState> | undefined;
  let forecastFeedbackId: string | undefined;

  if (parseResult.success) {
    initialFormState = extractFormState(parseResult.data);
    forecastFeedbackId = parseResult.data.forecastFeedbackId;

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
    console.warn(
      "Session wizard parameter validation failed:",
      parseResult.error
    );

    if (
      typeof window !== "undefined" &&
      parseResult.error !== "No prefill parameters provided"
    ) {
      setTimeout(() => {
        toast.warning("Some prefill data was invalid and was ignored");
      }, 100);
    }

    initialFormState = parseResult.defaults as Partial<SessionFormState>;
  }

  if (shouldShowEmailBridge) {
    return (
      <EmailSessionAppBridge
        appUrl={buildSessionNativeAppUrl(emailBridgeSearchParams)}
        signInUrl={buildSessionEmailWebSignInUrl(emailBridgeSearchParams)}
        isAuthenticated={isAuthenticated}
        onContinueWeb={() => setContinueOnWeb(true)}
      />
    );
  }

  return (
    <NewSessionPageContent
      initialFormState={initialFormState}
      mode={mode}
      forecastFeedbackId={forecastFeedbackId}
    />
  );
}

export function NewSessionClientPage() {
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
