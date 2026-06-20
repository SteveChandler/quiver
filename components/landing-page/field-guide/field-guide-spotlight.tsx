import type { ReactElement } from "react";
import Image from "next/image";
import Link from "next/link";

import { QuiverSticker, ZineSurface } from "@/components/zine";
import type { FirstTouchPlatform } from "@/lib/analytics/web-context";

interface FieldGuideSpotlightProps {
  platform: FirstTouchPlatform;
}

export function FieldGuideSpotlight({
  platform,
}: FieldGuideSpotlightProps): ReactElement {
  const downloadHref = `/download?source=landing_swell_view&placement=spotlight&platform=${platform}`;

  return (
    <ZineSurface
      sectionLabel="Now free"
      data-testid="field-guide-spotlight"
      className="bg-[#0D1020] px-3 py-0 sm:px-6 sm:py-0"
      stageClassName="mx-auto max-w-6xl !py-0"
      paperClassName="relative overflow-hidden !px-5 !py-7 sm:!px-8 sm:!py-8"
      showMasthead={false}
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)] md:items-center">
        <div className="relative z-10">
          <span className="inline-block -rotate-2 rounded-[10px_4px_10px_4px] border-2 border-[#11100D] bg-[#C0DD97] px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#27500A]">
            FREE · NEW IN THE APP
          </span>
          <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[#0B3A75]">
            318 breaks · 73 cams · wave maps for the other 245
          </p>
          <h2 className="zine-h1 mt-2 max-w-xl leading-[0.96] text-[#11100D] md:!text-[clamp(40px,4.4vw,58px)]">
            Quiver&apos;s Swell View is here.
          </h2>
          <p className="mt-3 max-w-xl font-mono text-sm leading-relaxed text-[#11100D]/80">
            We built it as an internal tool for our forecast team a year ago.
            Over a million images analyzed and classified.
          </p>
          <p className="mt-2 max-w-xl font-mono text-sm font-bold leading-relaxed text-[#11100D]">
            Today we&apos;re releasing it — free, in the app.
          </p>
          <div className="mt-4">
            <Link
              href={downloadHref}
              className="inline-flex min-h-12 items-center justify-center rounded-[14px_6px_16px_6px] bg-[#F78E42] px-6 py-3 font-mono text-sm font-bold uppercase tracking-[0.14em] text-[#11100D] shadow-[2px_4px_0_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3A75]"
            >
              Get the app
            </Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <QuiverSticker
            sticker="creamCoastMap"
            className="pointer-events-none absolute -left-5 -top-6 z-20 w-24 -rotate-6"
            sizes="6rem"
          />
          <div className="halftone-photo relative aspect-[4/3] w-full overflow-hidden border-2 border-[#11100D] bg-[#0D1020] shadow-[3px_5px_0_rgba(0,0,0,0.2)]">
            <Image
              src="/images/landing/swell-view-preview.png"
              alt="Quiver Swell View — live swell field over a stretch of coast"
              fill
              sizes="(max-width: 768px) 100vw, 470px"
              className="object-cover"
            />
            <div className="absolute bottom-1.5 right-1.5 z-10 border border-[#11100D] bg-[#F4EBD8]/85 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#11100D]">
              Swell View
            </div>
          </div>
        </div>
      </div>
    </ZineSurface>
  );
}
