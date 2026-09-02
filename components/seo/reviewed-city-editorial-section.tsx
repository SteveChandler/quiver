import Image from "next/image";
import { MapPin } from "lucide-react";

import type { CityEditorialPhoto } from "@/lib/data/server/city-editorial-photo";
import type { CityEditorialContent } from "@/types/editorial-content";

/**
 * Renders inside `.seo-paper-page`, which defines its own cream palette and never
 * overrides the shadcn tokens. `bg-card` / `text-muted-foreground` here resolved
 * to the twilight-dark card with paper-brown text (~1.6:1), so the panel uses the
 * paper colours directly, the way its sibling sections do.
 */
export function ReviewedCityEditorialSection({
  editorial,
  photo,
  photoAlt,
}: {
  editorial: CityEditorialContent | null;
  photo?: CityEditorialPhoto | null;
  /** Usually the beach name; the stored title is often a file name. */
  photoAlt?: string;
}) {
  if (!editorial?.seo_intro || !editorial.seo_local_guidance) return null;

  return (
    <section
      aria-labelledby="local-planning-guidance"
      data-testid="reviewed-city-editorial"
      className="my-8 rounded-[20px_8px_22px_10px] border-2 border-[#11100D] bg-[#FBF6E8] p-5 text-[#11100D] shadow-[3px_4px_0_rgba(17,16,13,0.2)] sm:p-6"
    >
      <div className={photo ? "grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(220px,36%)] md:items-start" : undefined}>
        <div>
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
        </div>

        {photo && (
          <figure className="md:mt-1 md:rotate-[1.2deg]" data-testid="reviewed-city-editorial-photo">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[6px_14px_6px_12px] border-2 border-[#11100D] bg-[#EEE3C9] shadow-[3px_3px_0_rgba(17,16,13,0.18)]">
              <Image
                src={photo.src}
                alt={photoAlt ?? photo.title ?? ""}
                fill
                priority
                sizes="(min-width: 768px) 36vw, 100vw"
                className="object-cover"
              />
            </div>
            {(photo.creator || photo.licenseCode) && (
              <figcaption className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#655C4C]">
                Photo
                {photo.creator ? ` · ${photo.creator}` : ""}
                {photo.licenseCode ? ` · ${photo.licenseCode}` : ""}
              </figcaption>
            )}
          </figure>
        )}
      </div>
    </section>
  );
}
