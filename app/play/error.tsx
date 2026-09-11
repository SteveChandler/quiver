"use client";

import { useEffect, type ReactElement } from "react";

import { logErrorBoundary } from "@/components/error-boundaries";
import { Button } from "@/components/ui/button";
import { ZineSurface } from "@/components/zine/zine-surface";

interface PlayErrorProps {
  error: Error & { digest?: string };
  reset(): void;
}

export default function PlayError({ error, reset }: PlayErrorProps): ReactElement {
  useEffect(() => {
    logErrorBoundary(error, {
      tier: "tier_1",
      boundaryType: "route",
      route: "/play",
    });
  }, [error]);

  return (
    <ZineSurface sectionLabel="ONE MORE WAVE" className="min-h-screen bg-[#0B5FA5]" stageClassName="min-h-screen pt-20" paperClassName="!bg-[#B8F1FF]">
      <section className="m-auto max-w-lg border-4 border-[#0A1D2B] bg-[#127CC1] p-7 text-center text-[#F8FEFF] shadow-[5px_5px_0_#0A1D2B] [font-family:var(--font-play-pixel)] [text-shadow:1px_1px_0_#0A1D2B]">
        <p className="mx-auto w-fit bg-[#D93B72] px-3 py-2 text-xs uppercase">Set went quiet</p>
        <h1 className="mt-4 text-2xl uppercase">The ocean took that one.</h1>
        <p className="mt-3 text-sm text-[#B8F1FF]">Paddle back out and load the same heat again.</p>
        <Button type="button" onClick={reset} className="mt-5 rounded-none border-2 border-[#29C7F6] bg-[#0B5FA5] text-xs uppercase text-[#F8FEFF] hover:bg-[#127CC1]">
          Try again
        </Button>
      </section>
    </ZineSurface>
  );
}
