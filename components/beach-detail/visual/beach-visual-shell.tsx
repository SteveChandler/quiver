import type { ReactNode } from "react";

/** Cream paper for blocks drawn in dark zine ink, so they stay readable on the twilight stage. */
export const VISUAL_PAPER_CLASS = "rounded-2xl bg-[#F4EBD8] p-5 text-[#11100D] sm:p-7";

/** The visual beach page sits on the site's twilight stage, not the zine's cream paper. */
export function BeachVisualShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 pt-4 text-[#F5EEDC] sm:px-7">{children}</div>;
}
