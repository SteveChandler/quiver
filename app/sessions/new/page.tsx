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

interface NewSessionPageContentProps {
  initialFormState?: Partial<SessionFormState>;
  mode: SessionFormMode;
  convertSessionId?: string | null;
}

function NewSessionPageContent({
  initialFormState,
  mode,
  convertSessionId,
}: NewSessionPageContentProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Session submission hook - manages all post-save flows
  const submission = useSessionSubmission({
    mode,
    user,
    convertSessionId,
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
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 relative">
      <FormErrorBoundary formId="session-form">
        <SessionScrollForm
          initialMode={mode}
          onComplete={submission.handleSessionComplete}
          onCancel={handleCancel}
          className="min-h-screen"
          initialFormState={initialFormState}
        />
      </FormErrorBoundary>


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

  // Prepare initial form state if validation succeeded
  let initialFormState: Partial<SessionFormState> | undefined;

  if (parseResult.success) {
    // Convert validated params to form state format
    initialFormState = extractFormState(parseResult.data);

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
