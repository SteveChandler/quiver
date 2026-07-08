import type { ReactElement } from "react";
import Link from "next/link";

import {
  HandArrow,
  SaltyEyebrow,
} from "@/components/beach-detail/zine/atoms";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import type { FirstTouchPlatform } from "@/lib/analytics/web-context";
import { FieldGuideHeroVideo } from "./field-guide-hero-video";

interface FieldGuideHeroProps {
  platform: FirstTouchPlatform;
}

export function FieldGuideHero({ platform }: FieldGuideHeroProps): ReactElement {
  const downloadHref = `/download?source=landing_hero&placement=hero&platform=${platform}`;

  return (
    <ZineSurface
      sectionLabel="Cover"
      data-testid="field-guide-hero"
      className="bg-[#0D1020] px-3 pb-0 pt-4 sm:px-6 sm:pb-0 sm:pt-5"
      stageClassName="mx-auto max-w-5xl !py-0"
      paperClassName="relative overflow-hidden !px-5 !py-7 sm:!px-8 sm:!py-8 md:!px-10 md:!py-8"
      showMasthead={false}
    >
      <div className="relative grid gap-6 md:grid-cols-[minmax(0,0.98fr)_minmax(320px,0.72fr)] md:items-start lg:gap-8">
        <QuiverSticker
          sticker="halftoneCircle"
          className="pointer-events-none absolute -right-14 -top-14 w-44 rotate-12 opacity-35"
          sizes="11rem"
        />
        <div className="relative z-10">
          <SaltyEyebrow text="THE SURFER'S FIELD GUIDE" />
          <h1 className="zine-h1 mt-3 max-w-3xl leading-[0.96] text-[#11100D] md:max-w-[620px] md:!text-[clamp(60px,5.9vw,76px)] md:leading-[0.92]">
            Know where to paddle out before dawn.
          </h1>
          <p className="mt-3 max-w-2xl font-mono text-sm leading-relaxed text-[#11100D]/80 sm:text-base md:max-w-xl md:text-sm">
            Quiver reads every break like a local: clean forecasts, board-aware
            picks, and the session notes that make the next call sharper.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 md:mt-5">
            <Link
              href={downloadHref}
              className="inline-flex min-h-12 items-center justify-center rounded-[14px_6px_16px_6px] bg-[#F78E42] px-6 py-3 font-mono text-sm font-bold uppercase tracking-[0.14em] text-[#11100D] shadow-[2px_4px_0_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3A75]"
            >
              Get the app
            </Link>
            <Link
              href="#demo"
              className="inline-flex min-h-12 items-center justify-center rounded-[12px_5px_14px_5px] border-2 border-[#11100D] bg-[#F4EBD8] px-5 py-3 font-mono text-sm font-bold uppercase tracking-[0.14em] text-[#11100D] shadow-[2px_4px_0_rgba(0,0,0,0.14)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3A75]"
            >
              Watch demo
            </Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-sm md:mt-6 md:max-w-[430px] lg:max-w-[470px]">
          <QuiverSticker
            sticker="orangeTape"
            className="absolute -left-4 -top-4 z-20 w-24 -rotate-6"
            sizes="6rem"
          />
          <FieldGuideHeroVideo />
          <div className="absolute -bottom-7 -right-2 hidden md:block">
            <HandArrow dir="curve-right" length={96} />
          </div>
          <QuiverSticker
            sticker="breakingWave"
            className="absolute -bottom-8 -left-7 w-32 rotate-6"
            sizes="8rem"
          />
        </div>
      </div>
    </ZineSurface>
  );
}
