import type { ReactElement } from "react";
import Link from "next/link";

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
      paperClassName="relative overflow-hidden !px-5 !py-6 sm:!px-8 sm:!py-7 md:!px-10 md:!py-8"
      showMasthead={false}
    >
      <div className="relative grid min-w-0 gap-5 md:grid-cols-[minmax(0,0.98fr)_minmax(320px,0.72fr)] md:items-center lg:gap-8">
        <div className="relative z-10 min-w-0">
          <h1 className="zine-h1 max-w-3xl leading-[0.94] text-[#11100D] md:max-w-[620px] md:!text-[clamp(60px,5.9vw,76px)] md:leading-[0.92]">
            Know where to paddle out before dawn.
          </h1>
          <p className="mt-4 max-w-xl font-mono text-sm leading-relaxed text-[#11100D]/80 sm:text-base md:text-sm">
            A local read for every break, built around the boards you actually
            ride.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              href={downloadHref}
              data-testid="field-guide-hero-primary-cta"
              className="inline-flex min-h-12 items-center justify-center rounded-[14px_6px_16px_6px] bg-[#F78E42] px-6 py-3 font-mono text-sm font-bold uppercase tracking-[0.14em] text-[#11100D] shadow-[2px_4px_0_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3A75]"
            >
              Get the app
            </Link>
            <Link
              href="#demo"
              className="inline-flex min-h-11 items-center px-1 py-2 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#11100D]/75 underline decoration-[#F78E42] decoration-2 underline-offset-4 transition-colors hover:text-[#11100D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3A75]"
            >
              Watch demo
            </Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-sm min-w-0 md:max-w-[430px] lg:max-w-[470px]">
          <QuiverSticker
            sticker="orangeTape"
            className="absolute -left-3 -top-3 z-20 w-20 -rotate-6"
            sizes="6rem"
          />
          <FieldGuideHeroVideo />
        </div>
      </div>
    </ZineSurface>
  );
}
