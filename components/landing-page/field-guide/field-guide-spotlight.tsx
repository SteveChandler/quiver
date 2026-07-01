import type { ReactElement } from "react";
import Image from "next/image";

import { QuiverSticker, ZineSurface } from "@/components/zine";

// 2026-06-20 beach/cam inventory query snapshot:
// 318 active breaks, 73 with cams, 245 wave-map-only.
const SWELL_VIEW_STAT_LINE =
  "318 breaks · 73 cams · wave maps for the other 245";
const SWELL_VIEW_PREVIEW_SRC = "/images/landing/swell-view-preview-v2.png";

export function FieldGuideSpotlight(): ReactElement {
  return (
    <ZineSurface
      sectionLabel="Now free"
      data-testid="field-guide-spotlight"
      className="bg-[#0D1020] px-3 py-0 sm:px-6 sm:py-0"
      stageClassName="mx-auto max-w-5xl !py-0"
      paperClassName="relative overflow-hidden !px-5 !py-7 sm:!px-8 sm:!py-8"
      showMasthead={false}
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)] md:items-center">
        <div className="relative z-10">
          <span className="inline-block -rotate-2 rounded-[10px_4px_10px_4px] border-2 border-[#11100D] bg-[#C0DD97] px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#27500A]">
            FREE · NEW IN THE APP
          </span>
          <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[#0B3A75]">
            {SWELL_VIEW_STAT_LINE}
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
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <QuiverSticker
            sticker="creamCoastMap"
            className="pointer-events-none absolute -left-5 -top-6 z-20 w-24 -rotate-6"
            sizes="6rem"
          />
          <div className="halftone-photo relative aspect-[4/3] w-full overflow-hidden border-2 border-[#11100D] bg-[#0D1020] shadow-[3px_5px_0_rgba(0,0,0,0.2)]">
            <Image
              src={SWELL_VIEW_PREVIEW_SRC}
              alt="Quiver Swell View — live swell field over a stretch of coast"
              fill
              sizes="(max-width: 768px) 100vw, 470px"
              className="object-cover object-left"
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
