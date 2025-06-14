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
        <div className="flex justify-center items-center h-32">Loading...</div>
      }
    >
      <SessionFormContent initialMode={initialMode} />
    </Suspense>
  );
}
