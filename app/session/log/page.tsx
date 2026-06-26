"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SessionEmailLogFallback } from "./SessionEmailLogFallback";

export default function SessionLogPage() {
  return (
    <Suspense>
      <SessionLogContent />
    </Suspense>
  );
}

function SessionLogContent() {
  const searchParams = useSearchParams();

  return (
    <SessionEmailLogFallback
      token={searchParams.get("token")}
      beachId={searchParams.get("beach_id")}
      windowStart={searchParams.get("window_start")}
      beachName={searchParams.get("beach_name") || "your session"}
      score={searchParams.get("score")}
    />
  );
}
