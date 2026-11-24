"use client";

import Link from "next/link";
import { ZineSurface } from "@/components/zine";

export default function TideStationError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ZineSurface sectionLabel="Tides">
      <main className="mx-auto max-w-5xl px-4 py-12 text-[#11100D] sm:px-6">
        <h1 className="zine-display text-3xl font-bold">Tides are taking a breather</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed">
          We couldn&apos;t load this station&apos;s tide table just now. Give it a minute and try again.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-5">
          <button type="button" onClick={reset} className="border-2 border-[#11100D] bg-[#F4EBD8] px-4 py-2 font-heading font-bold hover:bg-[#11100D] hover:text-[#F4EBD8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            Try again
          </button>
          <Link href="/tides" className="font-semibold text-[#AA4918] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            Back to tides
          </Link>
        </div>
      </main>
    </ZineSurface>
  );
}
