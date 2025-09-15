"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { useForm, FormProvider } from "react-hook-form";
import ConditionsStep from "@/app/(journal)/new/steps/ConditionsStep";

export default function JournalNewPage() {
  const searchParams = useSearchParams();
  const step = searchParams.get("step");

  const form = useForm({
    defaultValues: {
      sessionId: "",
      beachId: "",
      conditions: {},
    },
  });

  const isReady = Boolean(form.watch("sessionId") && form.watch("beachId"));

  return (
    <div className="container mx-auto max-w-2xl p-4">
      <FormProvider {...form}>
        {step === "conditions" ? (
          <ConditionsStep isReady={isReady} questions={null} />
        ) : (
          <div className="text-sm text-muted-foreground">Provide step=conditions to view the Conditions step.</div>
        )}
      </FormProvider>
    </div>
  );
}


