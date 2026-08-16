import Image from "next/image";
import type { ReactElement } from "react";

import { AutoplayVideo } from "./autoplay-video";

const HERO_VIDEO_SRC = "/videos/quiver-landing-hero-720.mp4";
const HERO_POSTER_SRC = "/images/hero/quiver-landing-hero-poster.jpg";

export function FieldGuideHeroVideo(): ReactElement {
  return (
    <div
      id="demo"
      className="halftone-photo relative aspect-video w-full overflow-hidden bg-[#C8C2B0]"
      data-testid="field-guide-hero-video"
    >
      <Image
        src={HERO_POSTER_SRC}
        alt="Quiver app launch video preview"
        fill
        priority
        sizes="(min-width: 1024px) 470px, (min-width: 768px) 430px, 100vw"
        className="object-cover"
      />
      <AutoplayVideo
        src={HERO_VIDEO_SRC}
        ariaLabel="Quiver app launch video preview"
        className="absolute inset-0 h-full w-full object-cover"
        playLabel="Play demo"
        playButtonClassName="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 border-2 border-[#11100D] bg-[#F4EBD8] px-4 py-2 font-mono text-xs font-black uppercase tracking-[0.14em] text-[#11100D] shadow-[2px_3px_0_rgba(17,16,13,0.2)] transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3A75]"
      />
      <div className="absolute bottom-1.5 right-1.5 z-10 border border-[#11100D] bg-[#F4EBD8]/85 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#11100D]">
        App preview
      </div>
    </div>
  );
}
