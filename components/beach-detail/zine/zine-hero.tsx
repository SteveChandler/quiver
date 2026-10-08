import type { ReactNode } from "react";
import type { Beach } from "@/types/database";
import type { BeachSources } from "@/hooks/use-beach-detail-data";
import type { ZineBeachPhoto } from "./types";
import { PhotoAttribution } from "@/components/photos/photo-attribution";
import { buildCamEmbed } from "@/lib/media/cam-embed";
import { CamsSection } from "@/components/beach-detail/cams-section";
import { getOptimizedImageUrl } from "@/lib/image-proxy";
import {
  SaltyEyebrow,
  SkillBars,
  DoodleReef,
  DoodleStar,
  MapDoodle,
} from "./atoms";

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
  const skill = (beach.skill_level || "All").toUpperCase();
  const breakType = (beach.break_type || "Spot").toUpperCase();
  const rating = typeof beach.average_rating === "number" ? beach.average_rating.toFixed(1) : null;
  const reviewCount = beach.review_count ?? 0;
  const filledStars = rating ? Math.round(parseFloat(rating)) : 0;
  const locationName = [beach.city, beach.state].filter(Boolean).join(", ");
  const HeadingTag = headingLevel;
  // The hero panel shows real imagery when there is some, else the spot map.
  // The collapsed section below adds only what the hero did not already show.
  const hasLiveCam =
    !!sources?.camera_url && buildCamEmbed(sources.camera_url).kind !== "none";
  const heroShowsPhoto = !!(
    beachPhoto?.image_url ??
    sources?.diorama_url ??
    (!hasLiveCam ? sources?.cam_thumbnail_url : null)
  );

  return (
    <section>
      <div className="grid gap-4">
      <div className="min-w-0">
        <SaltyEyebrow text={`FIELD GUIDE · ${(beach.city || "FIELD").toUpperCase()}`} />

        <HeadingTag
          className="zine-h1 mt-3"
          style={{
            fontFamily: "var(--font-zine-display), 'Space Grotesk', sans-serif",
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

        <HeroMediaPanel
          beachPhoto={beachPhoto}
          sources={sources}
          hasLiveCam={hasLiveCam}
          beachName={beach.name}
          locationName={locationName || beach.name}
          lat={beach.lat}
          lon={beach.lon}
          aspectDeg={beach.aspect_deg}
          breakType={beach.break_type}
          features={beach.features}
        />

        {summarySlot ? <div className="mt-5">{summarySlot}</div> : null}

        {forecastSlot ? <div className="mt-5">{forecastSlot}</div> : null}
        {children}
        <details className="mt-6 border-t border-[#11100D]/30 pt-4">
          <summary className="cursor-pointer text-base font-bold focus-visible:outline focus-visible:outline-2">About this spot · ratings &amp; ideal conditions</summary>
        <div className="flex flex-wrap items-center gap-4 md:gap-6 mt-5">
          <MetaItem icon={<SkillBars size={28} />} label={skill} />
          <Divider />
          <MetaItem icon={<DoodleReef size={28} />} label={breakType} sub="BREAK" />
          {rating && (
            <>
              <Divider />
              <RatingStamp rating={rating} filled={filledStars} />
            </>
          )}
          {reviewCount > 0 && (
            <>
              <Divider />
              <ReviewCircle count={reviewCount} />
            </>
          )}
        </div>

        {/* Hero prose sits in the left column so it fills the space beside the
            taller photo/map stack rather than leaving dead cream paper there. */}
        {beach.best_conditions_prose && (
          <p
            className="mt-6"
            style={{
              fontFamily: "var(--font-sans), sans-serif",
              fontWeight: 400,
              fontSize: 17,
              color: "#11100D",
              lineHeight: 1.5,
              maxWidth: "68ch",
            }}
          >
            {beach.best_conditions_prose}
          </p>
        )}
        </details>
      </div>

      {/* The photo now leads the hero; the live cam embed and the spot map stay
          collapsed so no iframe loads with the first paint. */}
      {hasLiveCam || heroShowsPhoto ? (
      <details className="mt-4"><summary className="cursor-pointer text-base font-bold focus-visible:outline focus-visible:outline-2">{hasLiveCam && heroShowsPhoto ? "Live cam & spot map" : hasLiveCam ? "Live cam" : "Spot map"}</summary><TapedMapPhoto
        showLiveCam={hasLiveCam}
        showMap={heroShowsPhoto}
        beachName={beach.name}
        locationName={locationName || beach.name}
        sources={sources}
        lat={beach.lat}
        lon={beach.lon}
        aspectDeg={beach.aspect_deg}
        breakType={beach.break_type}
        features={beach.features}
      /></details>
      ) : null}
      </div>
    </section>
  );
}

function Divider() {
  return <span className="hidden md:inline-block" style={{ width: 1, height: 38, background: "rgba(17,16,13,0.25)" }} aria-hidden />;
}

function MetaItem({ icon, label, sub }: { icon: React.ReactNode; label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <div style={{ height: 30, display: "flex", alignItems: "center" }}>{icon}</div>
      <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#11100D", fontWeight: 700 }}>
        {label}
        {sub && <span style={{ opacity: 0.55 }}> {sub}</span>}
      </span>
    </div>
  );
}

function RatingStamp({ rating, filled }: { rating: string; filled: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="rot-neg"
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "2.5px solid #11100D",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-zine-display), 'Space Grotesk', sans-serif",
          fontSize: 22,
          color: "#8A5E00",
          fontWeight: 900,
          position: "relative",
          filter: "url(#zine-rough-edge)",
          background: "rgba(244,235,216,0.6)",
        }}
      >
        {rating}
        <span style={{ position: "absolute", inset: 4, border: "1.5px solid #11100D", borderRadius: "50%", opacity: 0.5 }} aria-hidden />
      </div>
      <div className="flex gap-0.5" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <DoodleStar key={i} size={10} color="#8A5E00" filled={i < filled} />
        ))}
      </div>
      <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>RATING</span>
    </div>
  );
}

function ReviewCircle({ count }: { count: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        style={{
          width: 50,
          height: 50,
          borderRadius: "50%",
          border: "2.5px solid #11100D",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-zine-display), 'Space Grotesk', sans-serif",
          fontSize: count > 99 ? 14 : 18,
          color: "#11100D",
          fontWeight: 900,
          filter: "url(#zine-rough-edge)",
          transform: "rotate(3deg)",
        }}
      >
        {count > 999 ? "999+" : count}
      </div>
      <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>REVIEWS</span>
    </div>
  );
}

/**
 * Native Beach Detail's media panel: real place imagery under the beach name,
 * in a comic panel (3 pt ink outline, large sticker corners, hard ink drop,
 * ink halftone on the right half). No tilt and no tape. Falls back from the
 * beach photo to its diorama, then a stored cam still (labelled as a still,
 * when no live stream exists), then the spot map, so it never shows an empty
 * placeholder. A live cam embed stays in the collapsed section below.
 */
function HeroMediaPanel({
  beachPhoto,
  sources,
  hasLiveCam,
  beachName,
  locationName,
  lat,
  lon,
  aspectDeg,
  breakType,
  features,
}: {
  beachPhoto?: ZineBeachPhoto | null;
  sources?: BeachSources | null;
  hasLiveCam: boolean;
  beachName: string;
  locationName: string;
  lat?: number | null;
  lon?: number | null;
  aspectDeg?: number | null;
  breakType?: string | null;
  features?: string[] | null;
}) {
  const photoUrl = beachPhoto?.image_url ?? sources?.diorama_url ?? null;
  const showsCamStill = !photoUrl && !hasLiveCam && !!sources?.cam_thumbnail_url;
  const showsBeachPhoto = !!beachPhoto?.image_url;

  return (
    <div className="mb-2 mr-2 mt-5" data-testid="zine-hero-media">
      <div
        className="relative overflow-hidden"
        style={{
          border: "3px solid #11100D",
          borderRadius: "16px 6px 18px 8px",
          boxShadow: "8px 8px 0 #11100D",
          background: "#11100D",
        }}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- matches HalftonePhoto: the image proxy already sizes the photo, and cover-fit needs no Next image wrapper
          <img
            src={getOptimizedImageUrl(photoUrl)}
            alt={`${beachName}, ${locationName}`}
            className="block h-[240px] w-full object-cover sm:h-[320px] md:h-[380px]"
          />
        ) : showsCamStill ? (
          <CamsSection sources={sources!} variant="hero" beachName={beachName} />
        ) : (
          <MapDoodle
            height={320}
            beachName={beachName}
            locationName={locationName}
            lat={lat}
            lon={lon}
            aspectDeg={aspectDeg}
            breakType={breakType}
            features={features}
          />
        )}
        {/* Native's panel halftone sits on drawn panels only; over a photo it
            reads as a seam down the middle. */}
        {!photoUrl && !showsCamStill ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-1/2 right-0"
            style={{
              backgroundImage: "radial-gradient(rgba(17,16,13,0.07) 1.1px, transparent 1.3px)",
              backgroundSize: "6px 6px",
            }}
          />
        ) : null}
        {showsBeachPhoto && (beachPhoto!.attribution || beachPhoto!.attribution_html) ? (
          <PhotoAttribution
            attribution={beachPhoto!.attribution ?? null}
            attributionHtml={beachPhoto!.attribution_html}
            className="absolute bottom-2 right-2 z-20 max-w-[70%] truncate bg-[#11100D]/75 px-2 py-1 font-mono text-[10px] text-[#F4EBD8] underline-offset-2 hover:underline"
          />
        ) : null}
      </div>
    </div>
  );
}

function TapedMapPhoto({
  showLiveCam,
  showMap,
  beachName,
  locationName,
  sources,
  lat,
  lon,
  aspectDeg,
  breakType,
  features,
}: {
  showLiveCam: boolean;
  showMap: boolean;
  beachName: string;
  locationName: string;
  sources?: BeachSources | null;
  lat?: number | null;
  lon?: number | null;
  aspectDeg?: number | null;
  breakType?: string | null;
  features?: string[] | null;
}) {
  return (
    <div className="relative flex flex-col gap-3 md:gap-3.5">
      {showLiveCam ? (
        <TapedCamFrame sources={sources!} beachName={beachName} showLiveLabel />
      ) : null}

      {/* Map doodle with location stamp */}
      {showMap ? (
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
      ) : null}
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
            top: -24,
            right: 0,
            fontFamily: "var(--font-mono), monospace",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#4A463C",
          }}
          aria-hidden
        >
          Live now
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
