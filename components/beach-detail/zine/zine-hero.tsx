import type { ReactNode } from "react";
import type { Beach } from "@/types/database";
import type { BeachSources } from "@/hooks/use-beach-detail-data";
import type { ZineBeachPhoto } from "./types";
import { PhotoAttribution } from "@/components/photos/photo-attribution";
import { buildCamEmbed } from "@/lib/media/cam-embed";
import { CamsSection } from "@/components/beach-detail/cams-section";
import {
  SaltyEyebrow,
  SkillBars,
  DoodleReef,
  DoodleStar,
  HalftonePhoto,
  MapDoodle,
  HandArrow,
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
}

export function ZineHero({
  beach,
  beachPhoto,
  sources,
  headingLevel = "h1",
  headingSuffix,
  summarySlot,
  forecastSlot,
}: ZineHeroProps) {
  const skill = (beach.skill_level || "All").toUpperCase();
  const breakType = (beach.break_type || "Spot").toUpperCase();
  const rating = typeof beach.average_rating === "number" ? beach.average_rating.toFixed(1) : null;
  const reviewCount = beach.review_count ?? 0;
  const filledStars = rating ? Math.round(parseFloat(rating)) : 0;
  const locationName = [beach.city, beach.state].filter(Boolean).join(", ");
  const HeadingTag = headingLevel;

  return (
    <section>
      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr] md:gap-7 items-start">
      <div>
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

        {forecastSlot ? <div className="mt-6">{forecastSlot}</div> : null}

        {/* Hero prose sits in the left column so it fills the space beside the
            taller photo/map stack rather than leaving dead cream paper there. */}
        {beach.best_conditions_prose && (
          <p
            className="mt-6"
            style={{
              fontFamily:
                "var(--font-zine-marker), 'Permanent Marker', cursive",
              fontWeight: 400,
              fontSize: 22,
              color: "#11100D",
              letterSpacing: "-0.01em",
              lineHeight: 1.25,
              maxWidth: "78ch",
            }}
          >
            {beach.best_conditions_prose}
          </p>
        )}
      </div>

      <TapedMapPhoto
        beachPhoto={beachPhoto}
        beachName={beach.name}
        locationName={locationName || beach.name}
        sources={sources}
        lat={beach.lat}
        lon={beach.lon}
        aspectDeg={beach.aspect_deg}
        breakType={beach.break_type}
        features={beach.features}
      />
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
          border: "2.5px solid #0B3A75",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
          fontSize: 22,
          color: "#0B3A75",
          fontWeight: 900,
          position: "relative",
          filter: "url(#zine-rough-edge)",
          background: "rgba(244,235,216,0.6)",
        }}
      >
        {rating}
        <span style={{ position: "absolute", inset: 4, border: "1.5px solid #0B3A75", borderRadius: "50%", opacity: 0.5 }} aria-hidden />
      </div>
      <div className="flex gap-0.5" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <DoodleStar key={i} size={10} color="#0B3A75" filled={i < filled} />
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
          fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
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
          {/* "Line up here" annotation — only when we have a real photo to
              point at. The fallback ocean silhouette has no specific feature,
              so suppressing the arrow there reads as honest "no photo yet". */}
          {beachPhoto?.image_url && (
            <div
              className="absolute z-10 hidden md:block"
              style={{
                bottom: 16,
                left: 18,
                fontFamily: "var(--font-handwritten), cursive",
                fontSize: 22,
                color: "#F4EBD8",
                fontWeight: 700,
                transform: "rotate(-4deg)",
                textShadow: "1px 1px 0 rgba(17,16,13,0.7)",
              }}
              aria-hidden
            >
              Line up here
              <HandArrow
                dir="curve-right"
                length={80}
                color="#F4EBD8"
                strokeWidth={2.8}
                style={{ position: "absolute", left: 28, top: -28 }}
              />
            </div>
          )}
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
