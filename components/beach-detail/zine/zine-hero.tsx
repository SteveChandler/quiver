import type { ReactNode } from "react";
import type { Beach } from "@/types/database";
import type { BeachSources } from "@/hooks/use-beach-detail-data";
import type { ZineBeachPhoto } from "./types";
import { PhotoAttribution } from "@/components/photos/photo-attribution";
import { buildCamEmbed } from "@/lib/media/cam-embed";
import { CamsSection } from "@/components/beach-detail/cams-section";
import {
  SaltyEyebrow,
  HalftonePhoto,
  MapDoodle,
  HandArrow,
} from "./atoms";
import { ZineAboutSpot } from "./zine-about-spot";

export type ZineHeroHeadingLevel = "h1" | "h2";

interface ZineHeroProps {
  beach: Beach;
  beachPhoto?: ZineBeachPhoto | null;
  sources?: BeachSources | null;
  headingLevel?: ZineHeroHeadingLevel;
  headingSuffix?: string;
  /** Route-specific answer, shown directly below the beach location. */
  summarySlot?: ReactNode;
  /** Server-rendered forecast answer, shown in the hero's left column. */
  forecastSlot?: ReactNode;
  children?: ReactNode;
}

export function ZineHero({
  beach,
  beachPhoto,
  sources,
  headingLevel = "h1",
  headingSuffix,
  summarySlot,
  forecastSlot,
  children,
}: ZineHeroProps) {
  const locationName = [beach.city, beach.state].filter(Boolean).join(", ");
  const HeadingTag = headingLevel;

  return (
    <section>
      <div className="grid gap-4">
      <div className="min-w-0">
        <SaltyEyebrow text={`FIELD GUIDE · ${(beach.city || "FIELD").toUpperCase()}`} />

        <HeadingTag
          className="zine-h1 mt-3"
          style={{
            fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
            fontWeight: 400,
            color: "#11100D",
            letterSpacing: "-0.02em",
            lineHeight: 0.95,
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          {beach.name}
          {headingSuffix ? (
            <span className="zine-h1-suffix">{headingSuffix}</span>
          ) : null}
        </HeadingTag>
        {locationName && (
          <p
            className="mt-1"
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 12,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#11100D",
              opacity: 0.7,
              fontWeight: 700,
            }}
          >
            {locationName}
          </p>
        )}

        {summarySlot ? <div className="mt-5">{summarySlot}</div> : null}

        {forecastSlot ? <div className="mt-5">{forecastSlot}</div> : null}
        {children}
        <ZineAboutSpot beach={beach} />
      </div>

      <details className="mt-4"><summary className="cursor-pointer text-base font-bold focus-visible:outline focus-visible:outline-2">Spot photo, map &amp; camera</summary><TapedMapPhoto
        beachPhoto={beachPhoto}
        beachName={beach.name}
        locationName={locationName || beach.name}
        sources={sources}
        lat={beach.lat}
        lon={beach.lon}
        aspectDeg={beach.aspect_deg}
        breakType={beach.break_type}
        features={beach.features}
      /></details>
      </div>
    </section>
  );
}

function TapedMapPhoto({
  beachPhoto,
  beachName,
  locationName,
  sources,
  lat,
  lon,
  aspectDeg,
  breakType,
  features,
}: {
  beachPhoto?: ZineBeachPhoto | null;
  beachName: string;
  locationName: string;
  sources?: BeachSources | null;
  lat?: number | null;
  lon?: number | null;
  aspectDeg?: number | null;
  breakType?: string | null;
  features?: string[] | null;
}) {
  const hasEmbeddableCam =
    !!sources?.camera_url && buildCamEmbed(sources.camera_url).kind !== "none";
  const hasStoredCamStill = !!sources?.cam_thumbnail_url;
  const shouldShowCamFrame = hasEmbeddableCam || hasStoredCamStill;

  return (
    <div className="relative flex flex-col gap-3 md:gap-3.5">
      {/* Hero slot — live cam (when available) or halftone photo */}
      {shouldShowCamFrame ? (
        <TapedCamFrame
          sources={sources!}
          beachName={beachName}
          showLiveLabel={hasEmbeddableCam}
        />
      ) : (
        <div className="relative" style={{ transform: "rotate(1.4deg)" }}>
          <span className="tape tl" aria-hidden />
          <span className="tape tr" aria-hidden />
          <HalftonePhoto src={beachPhoto?.image_url} alt={beachPhoto ? `${beachName} surf zine photo` : undefined} label="HERO PHOTO" height={300} />
          {beachPhoto?.image_url &&
          (beachPhoto.attribution || beachPhoto.attribution_html) ? (
            <PhotoAttribution
              attribution={beachPhoto.attribution ?? null}
              attributionHtml={beachPhoto.attribution_html}
              className="absolute bottom-2 right-2 z-20 max-w-[70%] truncate bg-[#11100D]/75 px-2 py-1 font-mono text-[10px] text-[#F4EBD8] underline-offset-2 hover:underline"
            />
          ) : null}
        </div>
      )}

      {/* Map doodle with location stamp */}
      <div className="relative" style={{ transform: "rotate(-1.2deg)", marginTop: 4 }}>
        <span className="tape tl" aria-hidden />
        <span className="tape br" aria-hidden />
        <div className="absolute z-10" style={{ top: 10, left: -10, transform: "rotate(-3deg)" }} aria-hidden>
          <div
            className="label-black"
            style={{
              background: "#F4EBD8",
              color: "#11100D",
              border: "2.5px solid #11100D",
              boxShadow: "2px 3px 0 rgba(0,0,0,0.25)",
              fontSize: 13,
            }}
          >
            {beachName.toUpperCase()}
            <br />
            <span style={{ fontSize: 11, opacity: 0.8, letterSpacing: "0.1em" }}>{locationName.toUpperCase()}</span>
          </div>
        </div>
        <MapDoodle
          height={380}
          beachName={beachName}
          locationName={locationName}
          lat={lat}
          lon={lon}
          aspectDeg={aspectDeg}
          breakType={breakType}
          features={features}
        />
      </div>
    </div>
  );
}

function TapedCamFrame({
  sources,
  beachName,
  showLiveLabel,
}: {
  sources: BeachSources;
  beachName: string;
  showLiveLabel: boolean;
}) {
  return (
    <div className="zine-hero-cam-frame relative" style={{ transform: "rotate(1.4deg)" }}>
      <span className="tape tl" aria-hidden />
      <span className="tape tr" aria-hidden />
      {showLiveLabel ? (
        <div
          className="absolute z-10 hidden md:block"
          style={{
            top: -26,
            right: -8,
            fontFamily: "var(--font-handwritten), cursive",
            fontSize: 22,
            color: "#11100D",
            fontWeight: 700,
            transform: "rotate(-6deg)",
          }}
          aria-hidden
        >
          Live now
          <HandArrow dir="curve-right" length={70} style={{ position: "absolute", left: -45, top: 12 }} />
        </div>
      ) : null}
      <div
        className="overflow-hidden"
        style={{
          border: "3px solid #11100D",
          borderRadius: 4,
          boxShadow: "4px 5px 0 rgba(17,16,13,0.3)",
          background: "#11100D",
        }}
      >
        <CamsSection sources={sources} variant="hero" beachName={beachName} />
      </div>
    </div>
  );
}
