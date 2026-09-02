import { MapPin } from "lucide-react";

import type { CityEditorialContent } from "@/types/editorial-content";

/**
 * Renders inside `.seo-paper-page`, which defines its own cream palette and never
 * overrides the shadcn tokens. `bg-card` / `text-muted-foreground` here resolved
 * to the twilight-dark card with paper-brown text (~1.6:1), so the panel uses the
 * paper colours directly, the way its sibling sections do.
 */
export function ReviewedCityEditorialSection({
  editorial,
}: {
  editorial: CityEditorialContent | null;
}) {
  if (!editorial?.seo_intro || !editorial.seo_local_guidance) return null;

  return (
    <section
      aria-labelledby="local-planning-guidance"
      data-testid="reviewed-city-editorial"
      className="my-8 rounded-[20px_8px_22px_10px] border-2 border-[#11100D] bg-[#FBF6E8] p-5 text-[#11100D] shadow-[3px_4px_0_rgba(17,16,13,0.2)] sm:p-6"
    >
      <p className="mb-3 inline-flex -rotate-[1.5deg] items-center gap-1.5 rounded-full border border-[#B65F1A]/30 bg-[#B65F1A]/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8F4A13]">
        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
        Access &amp; safety
      </p>
      <h2 id="local-planning-guidance" className="text-xl font-semibold md:text-2xl">
        Local planning guidance
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#655C4C]">{editorial.seo_intro}</p>
      <p className="mt-3 max-w-3xl text-[15px] font-medium leading-7 text-[#11100D]">
        {editorial.seo_local_guidance}
      </p>
    </section>
  );
}
