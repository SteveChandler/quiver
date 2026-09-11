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
    <ZineSurface sectionLabel="OUTSIDE" className="min-h-screen bg-[#0D1020]" stageClassName="min-h-screen pt-20">
      <section className="m-auto max-w-lg border-4 border-[#11100D] bg-[#F4EBD8] p-7 text-center text-[#11100D]">
        <p className="label-black mx-auto w-fit !bg-[#B91C1C]">Set went quiet</p>
        <h1 className="mt-4 font-heading text-3xl font-black uppercase">The ocean took that one.</h1>
        <p className="mt-3 text-sm text-[#11100D]/70">Paddle back out and load the same heat again.</p>
        <Button type="button" onClick={reset} className="mt-5 rounded-none font-heading font-black uppercase">
          Try again
        </Button>
      </section>
    </ZineSurface>
  );
}
