import Link from "next/link";
import type { ReactElement } from "react";

import { formatReleaseDate, getLatestRelease } from "@/lib/data/whats-new";

/**
 * One-line "what shipped" strip under the hero. Reads the newest release from
 * the same data as /whats-new, so it updates when the release notes do.
 */
export function FieldGuideReleaseStrip(): ReactElement {
  const latest = getLatestRelease();

  return (
    <Link
      href="/whats-new"
      data-testid="field-guide-release-strip"
      className="group mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t-2 border-dashed border-[#11100D]/30 pt-4 font-mono text-xs text-[#11100D]/80 transition-colors hover:text-[#11100D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3A75]"
    >
      <span className="inline-flex items-center bg-[#11100D] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#FBF6E8]">
        New
      </span>
      <span className="uppercase tracking-[0.18em] text-[#11100D]/55">
        {formatReleaseDate(latest.date)}
      </span>
      <span className="font-bold text-[#11100D]">{latest.title}</span>
      <span className="ml-auto underline decoration-[#F78E42] decoration-2 underline-offset-4 group-hover:decoration-4">
        See what&apos;s new
      </span>
    </Link>
  );
}
