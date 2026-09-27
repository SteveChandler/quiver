import type { ReactNode } from "react";

/** The visual beach page sits on the site's twilight stage, not the zine's cream paper. */
export function BeachVisualShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 pt-4 text-[#F5EEDC] sm:px-7">{children}</div>;
}
