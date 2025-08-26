"use client";

import { Suspense } from "react";
import { SessionForm } from "./SessionForm";
import { SessionFormMode } from "@/hooks/use-session-form";

interface SessionFormWrapperProps {
  initialMode?: SessionFormMode;
}

function SessionFormContent({ initialMode }: SessionFormWrapperProps) {
  return <SessionForm initialMode={initialMode} />;
}

export function SessionFormWrapper({
  initialMode = "plan",
}: SessionFormWrapperProps) {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }
    >
      <SessionFormContent initialMode={initialMode} />
    </Suspense>
  );
}
