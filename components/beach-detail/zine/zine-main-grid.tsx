import type { Beach } from "@/types/database";
import type { ZineBeachPhoto } from "./types";
import { formatMonthRange } from "@/lib/utils/date-time";
import { HalftonePhoto, DoodleStar, DoodleWarning, DoodleSkull, HandArrow } from "./atoms";

interface ZineMainGridProps {
  beach: Beach;
  beachPhoto?: ZineBeachPhoto | null;
}

export function ZineMainGrid({ beach, beachPhoto }: ZineMainGridProps) {
  return (
    <section className="grid gap-5 md:grid-cols-[1fr_1.05fr_0.85fr] mt-7 items-start">
      <AboutSpotArticle beach={beach} beachPhoto={beachPhoto} />
      <LocalKnowledgeNotebook beach={beach} />
      <HazardsPanel beach={beach} />
    </section>
  );
}

function AboutSpotArticle({ beach, beachPhoto }: { beach: Beach; beachPhoto?: ZineBeachPhoto | null }) {
  const seasonLabel =
    beach.best_months && beach.best_months.length > 0 ? formatMonthRange(beach.best_months) : null;
  const breakType = (beach.break_type || "spot").toLowerCase();
  const tideRange =
    beach.preferred_tide_ft_min != null && beach.preferred_tide_ft_max != null
      ? `${beach.preferred_tide_ft_min}–${beach.preferred_tide_ft_max} ft`
      : null;

  return (
    <article
      className="torn torn-tb relative rot-1"
      style={{
        background: "#F0E5CC",
        padding: "22px 22px 24px",
        boxShadow: "2px 4px 0 rgba(0,0,0,0.18), 0 10px 22px rgba(0,0,0,0.12)",
      }}
    >
      <span className="tape tl" aria-hidden />
      <div className="label-black mb-3" style={{ fontSize: 13 }}>
        ABOUT THIS SPOT
      </div>

      {beach.best_conditions_prose ? (
        <p
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "#11100D",
            margin: 0,
          }}
        >
          {beach.best_conditions_prose}
        </p>
      ) : (
        <p
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "#11100D",
            margin: 0,
          }}
        >
          {beach.name} is a <span className="hl-blue">{breakType}</span>
          {tideRange ? (
            <>
              {" "}that works best on{" "}
              <span className="hl">{beach.preferred_tide_direction || "select"} tide at {tideRange}</span>
            </>
          ) : null}
          .
          {seasonLabel && (
            <>
              {" "}Prime season <span className="hl-pink">{seasonLabel}</span>.
            </>
          )}
        </p>
      )}

      {beachPhoto?.image_url && (
        <div
          className="relative"
          style={{ marginTop: 14, transform: "rotate(0.8deg)" }}
        >
          <span className="tape tl" aria-hidden />
          <span className="tape br" aria-hidden />
          <HalftonePhoto src={beachPhoto.image_url} alt={`${beach.name} reef`} label="REEF · LOW TIDE" height={140} />
        </div>
      )}

      {beach.wave_tips && (
        <div className="mt-4 flex items-start gap-2">
          <HandArrow dir="down-right" length={48} />
          <span
            style={{
              fontFamily: "var(--font-handwritten), cursive",
              fontSize: 19,
              color: "#11100D",
              fontWeight: 700,
              lineHeight: 1.15,
            }}
          >
            {truncate(beach.wave_tips, 110)}
          </span>
        </div>
      )}
    </article>
  );
}

function LocalKnowledgeNotebook({ beach }: { beach: Beach }) {
  const notes: string[] = [];
  if (beach.wave_tips) notes.push(beach.wave_tips);
  if (beach.crowd_tips) notes.push(beach.crowd_tips);
  if (beach.parking_tips) notes.push(`Parking: ${beach.parking_tips}`);
  if (beach.access_tips) notes.push(`Access: ${beach.access_tips}`);

  // If the beach has nothing entered yet, render a graceful fallback.
  if (notes.length === 0) {
    notes.push("No local notes yet — be the first to add some.");
  }

  return (
    <article className="notebook rot-2 relative">
      <span className="tape tr" aria-hidden />
      <div className="text-center mb-1">
        <div
          className="label-black"
          style={{
            fontSize: 13,
            background: "#F4EBD8",
            color: "#11100D",
            border: "2.5px solid #11100D",
            boxShadow: "2px 3px 0 rgba(0,0,0,0.25)",
          }}
        >
          LOCAL KNOWLEDGE
        </div>
      </div>
      <h3
        className="text-center my-3"
        style={{
          fontFamily: "var(--font-zine-marker), 'Permanent Marker', cursive",
          fontWeight: 400,
          fontSize: 26,
          color: "#11100D",
        }}
      >
        Wave Notes
      </h3>
      <ul className="list-none p-0 m-0">
        {notes.slice(0, 5).map((n, i) => (
          <li key={i} className="flex gap-2 mb-3 items-start">
            <DoodleStar size={14} color="#11100D" />
            <span
              style={{
                fontFamily: "var(--font-handwritten), cursive",
                fontSize: 19,
                color: "#11100D",
                lineHeight: 1.15,
                fontWeight: 500,
                flex: 1,
              }}
            >
              {n}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function HazardsPanel({ beach }: { beach: Beach }) {
  const items = (beach.hazards ?? []).filter(Boolean);
  if (items.length === 0) return null;

  return (
    <article className="rot-3 relative">
      <div className="hazards-panel">
        <div className="flex items-center justify-between mb-3 mt-1">
          <div
            style={{
              background: "#B91C1C",
              color: "#F4EBD8",
              fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
              fontWeight: 900,
              fontSize: 22,
              padding: "6px 14px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              filter: "url(#zine-rough-edge)",
              transform: "rotate(-1deg)",
            }}
          >
            HAZARDS
          </div>
          <DoodleWarning size={36} />
        </div>

        <ul className="list-none p-0 m-0">
          {items.map((it, i) => (
            <li
              key={i}
              className="flex gap-2 mb-2.5 items-start"
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 14,
                color: "#F4EBD8",
                lineHeight: 1.3,
              }}
            >
              <span style={{ color: "#FF5C5C", fontWeight: 700, fontSize: 16, lineHeight: 1 }}>×</span>
              <span style={{ flex: 1 }}>{it}</span>
            </li>
          ))}
        </ul>

        <div
          className="mt-4 inline-flex items-center gap-2.5"
          style={{
            border: "2.5px solid #F4EBD8",
            padding: "10px 14px",
            fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
            fontWeight: 900,
            fontSize: 13,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            filter: "url(#zine-rough-edge)",
          }}
        >
          <DoodleSkull size={22} color="#F4EBD8" />
          KNOW BEFORE YOU GO.
        </div>
      </div>
    </article>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}
