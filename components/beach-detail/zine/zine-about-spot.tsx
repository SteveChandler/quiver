import type { ReactNode } from "react";
import type { Beach } from "@/types/database";
import { SkillBars, DoodleReef, DoodleStar } from "./atoms";

interface ZineAboutSpotProps {
  beach: Beach;
  open?: boolean;
}

export function ZineAboutSpot({ beach, open = false }: ZineAboutSpotProps) {
  const skill = (beach.skill_level || "All").toUpperCase();
  const breakType = (beach.break_type || "Spot").toUpperCase();
  const rating = typeof beach.average_rating === "number" ? beach.average_rating.toFixed(1) : null;
  const reviewCount = beach.review_count ?? 0;
  const filledStars = rating ? Math.round(parseFloat(rating)) : 0;

  return (
    <details className="mt-6 border-t border-[#11100D]/30 pt-4" open={open}>
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
    </details>
  );
}

function Divider() {
  return <span className="hidden md:inline-block" style={{ width: 1, height: 38, background: "rgba(17,16,13,0.25)" }} aria-hidden />;
}

function MetaItem({ icon, label, sub }: { icon: ReactNode; label: string; sub?: string }) {
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
