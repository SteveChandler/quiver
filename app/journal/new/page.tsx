"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useForm, FormProvider, useFormContext } from "react-hook-form";
import ConditionsStep from "@/app/(journal)/new/steps/ConditionsStep";

function JournalNewContent() {
  const searchParams = useSearchParams();
  const step = searchParams.get("step");
  const { watch } = useFormContext();
  const isReady = Boolean(watch("sessionId") && watch("beachId"));

  if (step === "conditions") {
    return <ConditionsStep isReady={isReady} questions={null} />;
  }

  return (
    <div className="text-sm text-muted-foreground">
      Provide step=conditions to view the Conditions step.
    </div>
  );
}

export default function JournalNewPage() {
  const form = useForm({
    defaultValues: {
      sessionId: "",
      beachId: "",
      conditions: {},
    },
  });

  return (
    <div className="container mx-auto max-w-2xl p-4">
      <FormProvider {...form}>
        <Suspense
          fallback={
            <div className="text-sm text-muted-foreground">Loading...</div>
          }
        >
          <JournalNewContent />
        </Suspense>
      </FormProvider>
    </div>
  );
}
