import Image from "next/image";
import Link from "next/link";

import type { SpotPageData } from "@/lib/utils/spot-data-transformer";
import { getOptimizedImageUrl } from "@/lib/image-proxy";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { getIntentSlug } from "@/lib/utils/slug-helpers";
import {
  HalftonePhoto,
  RoughEdgeFilter,
} from "@/components/beach-detail/zine/atoms";
import { SpotHeroSection } from "./spot-hero-section";
import { SpotLocationMap } from "./spot-location-map";
import { SpotPhotoGallery } from "./spot-photo-gallery";
import {
  SpotGeneratedIcon,
  type SpotGeneratedIconName,
} from "./spot-generated-icon";

interface NearbySpotCardData {
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  region: string | null;
  overview: string | null;
  breakType: string | null;
  skillLevel: string | null;
  tideAdvice: string | null;
  swellAdvice: string | null;
  windAdvice: string | null;
  photoUrl: string | null;
}

interface SpotPageContentProps {
  spot: SpotPageData;
  cityName: string;
  updatedAt: string;
  featuredPhotoUrl: string | null;
  featuredPhotoAttribution?: string | null;
  nearbySpots: NearbySpotCardData[];
}

interface PlanningCard {
  title: string;
  value: string;
  icon: SpotGeneratedIconName;
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  return values.reduce<string[]>((accumulator, value) => {
    const trimmed = value?.trim();
    if (!trimmed || accumulator.includes(trimmed)) {
      return accumulator;
    }

    accumulator.push(trimmed);
    return accumulator;
  }, []);
}

function toSentenceCase(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function compactCopy(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const trimmed = value.slice(0, maxLength).trim();
  const lastSpace = trimmed.lastIndexOf(" ");
  const safeTrimmed = lastSpace > 0 ? trimmed.slice(0, lastSpace) : trimmed;
  return `${safeTrimmed}...`;
}

function buildSpotSummary(spot: SpotPageData): string {
  const primary = uniqueNonEmpty([
    spot.speakableSummary,
    spot.overview,
    spot.description,
    spot.conditions,
  ])[0];

  if (primary) {
    return primary;
  }

  return `${spot.name} is a ${spot.skillLevel?.toLowerCase() || "versatile"} surf break with live wind, tide, and wave updates in Quiver.`;
}

function buildIntroParagraphs(spot: SpotPageData, summary: string): string[] {
  const paragraphs = uniqueNonEmpty([
    summary,
    spot.overview && spot.overview !== summary ? spot.overview : null,
    spot.conditions,
    spot.history,
    spot.description && spot.description !== summary ? spot.description : null,
  ]);

  return paragraphs.slice(0, 2).map((paragraph) => compactCopy(paragraph, 260));
}

function buildPlanningCards(spot: SpotPageData): PlanningCard[] {
  const cards: PlanningCard[] = [];

  if (spot.tideAdvice) {
    cards.push({
      title: "Tide window",
      value: spot.tideAdvice,
      icon: "tide-window",
    });
  }

  if (spot.swellAdvice) {
    cards.push({
      title: "Swell match",
      value: spot.swellAdvice,
      icon: "swell-match",
    });
  }

  if (spot.windAdvice) {
    cards.push({
      title: "Wind read",
      value: spot.windAdvice,
      icon: "wind-read",
    });
  }

  if (spot.waterTemp) {
    cards.push({
      title: "Water temp",
      value: spot.waterTemp,
      icon: "water-temp",
    });
  }

  if (spot.bestSeason) {
    cards.push({
      title: "Best season",
      value: spot.bestSeason,
      icon: "best-season",
    });
  }

  const sessionProfile = uniqueNonEmpty([
    spot.breakType ? `${spot.breakType} break` : null,
    spot.skillLevel ? `${spot.skillLevel} friendly` : null,
  ]).join(" · ");
  if (sessionProfile) {
    cards.push({
      title: "Session profile",
      value: sessionProfile,
      icon: "session-profile",
    });
  }

  return cards;
}

function buildSupportSections(spot: SpotPageData): Array<{
  title: string;
  body: string;
}> {
  const sections: Array<{ title: string; body: string }> = [];

  const lineupNotes = uniqueNonEmpty([
    spot.crowdFactor ? `Expect a ${spot.crowdFactor.toLowerCase()} lineup.` : null,
    spot.hazards?.length ? `Watch for ${spot.hazards.join(", ")}.` : null,
  ]).join(" ");

  if (lineupNotes) {
    sections.push({ title: "Lineup notes", body: lineupNotes });
  }

  const accessNotes = uniqueNonEmpty([
    spot.parking,
    spot.parkingTips,
    spot.amenities?.length ? `Nearby support: ${spot.amenities.join(", ")}.` : null,
  ]).join(" ");

  if (accessNotes) {
    sections.push({ title: "Access and logistics", body: accessNotes });
  }

  return sections;
}

function buildLongformSections(spot: SpotPageData): Array<{
  title: string;
  body: string[];
}> {
  const sections: Array<{ title: string; body: string[] }> = [];

  const howItBreaks = uniqueNonEmpty([
    spot.conditions,
    spot.bestConditions,
    spot.swellAdvice,
    spot.windAdvice,
  ]);
  if (howItBreaks.length > 0) {
    sections.push({ title: "How this spot usually works", body: howItBreaks });
  }

  const localTexture = uniqueNonEmpty([
    spot.history,
    spot.overview,
    spot.description,
  ]).filter((paragraph) => paragraph !== spot.speakableSummary);
  if (localTexture.length > 0) {
    sections.push({ title: "Local texture", body: localTexture.slice(0, 2) });
  }

  const sessionNotes = uniqueNonEmpty([
    spot.beginnerNotes,
    spot.bestSeason ? `Prime season: ${spot.bestSeason}.` : null,
    spot.waterTemp ? `Water temperature: ${spot.waterTemp}.` : null,
  ]);
  if (sessionNotes.length > 0) {
    sections.push({ title: "Before you paddle out", body: sessionNotes });
  }

  return sections.slice(0, 3);
}

function buildUtilityLinks(spot: SpotPageData, cityName: string): Array<{
  href: string;
  label: string;
  description: string;
}> {
  if (!spot.citySlug) {
    return [];
  }

  const intentSlug = getIntentSlug(spot.citySlug, spot.state);

  return [
    {
      href: `/beginner/${intentSlug}`,
      label: "Beginner guide",
      description: `Find softer ${cityName} peaks and easier learning windows.`,
    },
    {
      href: `/least-crowded/${intentSlug}`,
      label: "Least crowded",
      description: "Scout backups when the main lot or lineup gets busy.",
    },
    {
      href: `/tide/${intentSlug}`,
      label: "Tide swings",
      description: "Check when the tide lines up with your target session.",
    },
    {
      href: `/water-temp/${intentSlug}`,
      label: "Water temp",
      description: "Dial in suit choice before you leave the house.",
    },
    {
      href: `/dawn-patrol/${intentSlug}`,
      label: "Dawn patrol",
      description: "Compare first-light windows for cleaner, lower-wind surf.",
    },
    {
      href: `/sunset/${intentSlug}`,
      label: "Sunset session",
      description: "Keep an evening fallback ready when the morning misses.",
    },
    {
      href: `/longboard/${intentSlug}`,
      label: "Longboard spots",
      description: "Pivot to mellower peaks when you want easier trims and glide.",
    },
  ];
}

export function SpotPageContent({
  spot,
  cityName,
  updatedAt,
  featuredPhotoUrl,
  featuredPhotoAttribution,
  nearbySpots,
}: SpotPageContentProps) {
  const summary = buildSpotSummary(spot);
  const introParagraphs = buildIntroParagraphs(spot, summary);
  const planningCards = buildPlanningCards(spot);
  const supportSections = buildSupportSections(spot);
  const longformSections = buildLongformSections(spot);
  const utilityLinks = buildUtilityLinks(spot, cityName);
  const locationText = uniqueNonEmpty([cityName, spot.region]).join(" · ");
  const heroBadges = uniqueNonEmpty([
    spot.breakType ? toSentenceCase(spot.breakType) : null,
    spot.skillLevel ? toSentenceCase(spot.skillLevel) : null,
    spot.bestSeason ? `Best ${spot.bestSeason}` : null,
  ]).slice(0, 3);
  const nearbyHeading = spot.citySlug ? `More ${cityName} options` : "Nearby alternatives";

  return (
    <div className="zine-tab bg-transparent">
      <RoughEdgeFilter />
      <SpotHeroSection
        spotName={spot.name}
        latitude={spot.latitude}
        longitude={spot.longitude}
        featuredPhotoUrl={featuredPhotoUrl}
        attribution={featuredPhotoAttribution}
        eyebrow="Live surf intel"
        subtitle={summary}
        metadata={`Updated ${updatedAt} PT${locationText ? ` · ${locationText}` : ""}`}
        badges={heroBadges}
      />

      <section className="zine-paper mt-6">
        <div className="grid gap-5 md:grid-cols-[1.45fr_0.9fr] md:gap-6">
          <div
            data-testid="spot-summary-card"
            className="torn torn-tb relative rot-1"
            style={{
              background: "#F0E5CC",
              padding: "22px 22px 26px",
            }}
          >
            <span className="tape tl" aria-hidden />
            <div className="label-black mb-4" style={{ fontSize: 13 }}>
              Spot overview
            </div>
            <h2
              className="mt-3"
              style={{
                fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
                fontWeight: 400,
                fontSize: "clamp(34px, 5vw, 58px)",
                lineHeight: 0.98,
                letterSpacing: "-0.03em",
                textTransform: "uppercase",
                color: "#11100D",
                margin: 0,
              }}
            >
              What to know before you go
            </h2>
            <div
              className="mt-5 space-y-5"
              style={{
                fontFamily: "var(--font-body), 'DM Sans', sans-serif",
                fontSize: 16,
                lineHeight: 1.55,
                color: "#11100D",
              }}
            >
              {introParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>

          <aside className="notebook rot-2 relative">
            <span className="tape tr" aria-hidden />
            <p
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#0B3A75",
                margin: 0,
              }}
            >
              Reading the numbers
            </p>
            <h2
              className="mt-3"
              style={{
                fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
                fontWeight: 400,
                fontSize: "clamp(28px, 4vw, 46px)",
                lineHeight: 1.02,
                letterSpacing: "-0.03em",
                color: "#11100D",
                margin: 0,
              }}
            >
              How to read Quiver wave height
            </h2>
            <p
              className="mt-4"
              style={{
                fontFamily: "var(--font-body), 'DM Sans', sans-serif",
                fontSize: 15,
                lineHeight: 1.75,
                color: "#11100D",
              }}
            >
              Use Quiver&apos;s wave number to judge session size. At calibrated beaches it
              reflects face height at the break. At uncalibrated beaches Quiver labels it as
              approximate forecast height instead of overclaiming local certainty.
            </p>
            <p
              className="mt-3"
              style={{
                fontFamily: "var(--font-handwritten), cursive",
                fontSize: 22,
                lineHeight: 1.15,
                color: "#11100D",
                fontWeight: 700,
              }}
            >
              Bigger jumps mean quickly more power, so a move from 1-2 ft to 3-4 ft is a real
              step up even when the forecast still looks small.
            </p>
          </aside>
        </div>

        {planningCards.length > 0 && (
          <section className="mt-10" aria-labelledby="spot-planning-title">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "#11100D",
                    opacity: 0.7,
                    margin: 0,
                  }}
                >
                  Session planning
                </p>
                <h2
                  id="spot-planning-title"
                  className="mt-2"
                  style={{
                    fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
                    fontWeight: 400,
                    fontSize: "clamp(28px, 4vw, 42px)",
                    lineHeight: 1.02,
                    letterSpacing: "-0.03em",
                    color: "#11100D",
                    margin: 0,
                  }}
                >
                  Scan the setup before you paddle out
                </h2>
              </div>
            </div>
            <div
              data-testid="spot-planning-grid"
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              {planningCards.map((card) => {
                return (
                  <article
                    key={card.title}
                    className="torn relative"
                      style={{
                        background: "#F0E5CC",
                        padding: "18px 18px 20px",
                      }}
                    >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border-[2.5px] border-[#11100D] bg-[#F4EBD8]">
                      <SpotGeneratedIcon
                        name={card.icon}
                        size={42}
                        className="h-10 w-10 object-contain"
                      />
                    </div>
                    <p
                      className="mt-4"
                      style={{
                        fontFamily: "var(--font-mono), monospace",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "#11100D",
                        opacity: 0.75,
                      }}
                    >
                      {card.title}
                    </p>
                    <p
                      className="mt-2"
                      style={{
                        fontFamily: "var(--font-body), 'DM Sans', sans-serif",
                        fontSize: 15,
                        lineHeight: 1.6,
                        color: "#11100D",
                      }}
                    >
                      {card.value}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {spot.id && (
          <section className="mt-10" aria-labelledby="spot-gallery-title">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "#11100D",
                    opacity: 0.7,
                    margin: 0,
                  }}
                >
                  Visual check
                </p>
                <h2
                  id="spot-gallery-title"
                  className="mt-2"
                  style={{
                    fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
                    fontWeight: 400,
                    fontSize: "clamp(28px, 4vw, 42px)",
                    lineHeight: 1.02,
                    letterSpacing: "-0.03em",
                    color: "#11100D",
                    margin: 0,
                  }}
                >
                  See how {spot.name} is showing up lately
                </h2>
              </div>
            </div>
            <SpotPhotoGallery beachId={spot.id} spotName={spot.name} showHeader={false} />
          </section>
        )}

        {nearbySpots.length > 0 && (
          <section className="mt-10" aria-labelledby="spot-nearby-title">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "#11100D",
                    opacity: 0.7,
                    margin: 0,
                  }}
                >
                  Backup plan
                </p>
                <h2
                  id="spot-nearby-title"
                  className="mt-2"
                  style={{
                    fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
                    fontWeight: 400,
                    fontSize: "clamp(28px, 4vw, 42px)",
                    lineHeight: 1.02,
                    letterSpacing: "-0.03em",
                    color: "#11100D",
                    margin: 0,
                  }}
                >
                  {nearbyHeading}
                </h2>
              </div>
            </div>
            <div
              data-testid="spot-nearby-grid"
              className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
            >
              {nearbySpots.map((nearbySpot) => {
                const href = nearbySpot.city && nearbySpot.state
                  ? buildBeachUrl({
                      slug: nearbySpot.slug,
                      city: nearbySpot.city,
                      state: nearbySpot.state,
                    })
                  : `/spots/${nearbySpot.slug}`;
                const teaser = compactCopy(
                  nearbySpot.overview ||
                    nearbySpot.swellAdvice ||
                    nearbySpot.windAdvice ||
                    nearbySpot.tideAdvice ||
                    `${nearbySpot.name} is a useful backup when you need another read in the same zone.`,
                  135
                );

                return (
                  <Link
                    key={nearbySpot.slug}
                    href={href}
                    className="group block"
                    style={{
                      transform: `rotate(${(Number.parseInt(nearbySpot.slug.length.toString(), 10) % 3) - 1}deg)`,
                      transformOrigin: "center",
                    }}
                  >
                    <article
                      style={{
                        background: "#F4EBD8",
                        border: "2.5px solid #11100D",
                        borderRadius: 4,
                        boxShadow: "3px 4px 0 rgba(17,16,13,0.25)",
                        padding: 10,
                        transition: "transform 180ms ease, box-shadow 180ms ease",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                      }}
                      className="group-hover:translate-y-[-2px] group-hover:shadow-[5px_6px_0_rgba(17,16,13,0.3)]"
                    >
                      <div style={{ aspectRatio: "4 / 3", overflow: "hidden", border: "2px solid #11100D" }}>
                        <HalftonePhoto
                          src={nearbySpot.photoUrl ? getOptimizedImageUrl(nearbySpot.photoUrl) : null}
                          alt={nearbySpot.photoUrl ? `${nearbySpot.name} surf photo` : undefined}
                          height={180}
                          label={uniqueNonEmpty([nearbySpot.city, nearbySpot.region]).join(" · ") || "Nearby spot"}
                        />
                      </div>
                      <div className="mt-3 flex flex-1 flex-col">
                        <h3
                          style={{
                            fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
                            fontWeight: 400,
                            fontSize: 22,
                            lineHeight: 1.02,
                            letterSpacing: "-0.02em",
                            textTransform: "uppercase",
                            color: "#11100D",
                            margin: 0,
                          }}
                        >
                          {nearbySpot.name}
                        </h3>
                        <div
                          className="mt-2 flex flex-wrap items-center gap-2"
                          style={{
                            fontFamily: "var(--font-mono), monospace",
                            fontSize: 11,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: "#11100D",
                            opacity: 0.8,
                            fontWeight: 700,
                          }}
                        >
                          {uniqueNonEmpty([
                            nearbySpot.breakType ? toSentenceCase(nearbySpot.breakType) : null,
                            nearbySpot.skillLevel ? toSentenceCase(nearbySpot.skillLevel) : null,
                          ]).map((badge) => (
                            <span key={badge}>{badge}</span>
                          ))}
                        </div>
                        <p
                          className="mt-3"
                          style={{
                            fontFamily: "var(--font-body), 'DM Sans', sans-serif",
                            fontSize: 14,
                            lineHeight: 1.55,
                            color: "#11100D",
                            margin: 0,
                          }}
                        >
                          {teaser}
                        </p>
                      </div>
                      <span
                        className="mt-4 inline-flex items-center gap-2 self-start"
                        style={{
                          fontFamily: "var(--font-mono), monospace",
                          fontSize: 11,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          color: "#0B3A75",
                          fontWeight: 700,
                        }}
                      >
                        Open surf report
                        <SpotGeneratedIcon
                          name="launch-arrow"
                          size={20}
                          className="h-4 w-4 object-contain"
                        />
                      </span>
                    </article>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {(supportSections.length > 0 || utilityLinks.length > 0 || (spot.latitude && spot.longitude)) && (
          <section className="mt-10 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="space-y-5">
              {supportSections.length > 0 && (
                <div
                  data-testid="spot-support-grid"
                  className="grid gap-5 md:grid-cols-2"
                >
                  {supportSections.map((section) => (
                    <article
                      key={section.title}
                      className={section.title === "Lineup notes" ? "rot-3 relative" : "torn relative"}
                      style={
                        section.title === "Lineup notes"
                          ? undefined
                          : { background: "#F0E5CC", padding: "20px 18px" }
                      }
                    >
                      {section.title === "Lineup notes" ? (
                        <div className="hazards-panel">
                          <div className="mb-3 mt-1 flex items-center justify-between">
                            <div
                              style={{
                                background: "#B91C1C",
                                color: "#F4EBD8",
                                fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
                                fontWeight: 900,
                                fontSize: 20,
                                padding: "6px 14px",
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                filter: "url(#zine-rough-edge)",
                                transform: "rotate(-1deg)",
                              }}
                            >
                              {section.title}
                            </div>
                          </div>
                          <p
                            style={{
                              fontFamily: "var(--font-mono), monospace",
                              fontSize: 14,
                              color: "#F4EBD8",
                              lineHeight: 1.5,
                              margin: 0,
                            }}
                          >
                            {section.body}
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="label-black" style={{ fontSize: 12 }}>
                            {section.title}
                          </div>
                          <p
                            className="mt-4"
                            style={{
                              fontFamily: "var(--font-body), 'DM Sans', sans-serif",
                              fontSize: 15,
                              lineHeight: 1.6,
                              color: "#11100D",
                              margin: 0,
                            }}
                          >
                            {section.body}
                          </p>
                        </>
                      )}
                    </article>
                  ))}
                </div>
              )}

              {longformSections.length > 0 && (
                <div className="space-y-3">
                  {longformSections.map((section) => (
                    <details
                      key={section.title}
                      className="torn group overflow-hidden"
                      style={{ background: "#F4EBD8" }}
                    >
                      <summary
                        className="cursor-pointer list-none px-5 py-4"
                        style={{
                          fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
                          fontWeight: 400,
                          fontSize: 22,
                          lineHeight: 1.05,
                          color: "#11100D",
                        }}
                      >
                        {section.title.toUpperCase()}
                      </summary>
                      <div
                        className="border-t border-[#11100D]/15 px-5 py-4"
                        style={{
                          fontFamily: "var(--font-body), 'DM Sans', sans-serif",
                          fontSize: 15,
                          lineHeight: 1.6,
                          color: "#11100D",
                        }}
                      >
                        {section.body.map((paragraph) => (
                          <p key={paragraph} className="mt-3 first:mt-0">
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-5">
              {spot.latitude && spot.longitude && (
                <article className="torn relative rot-neg" style={{ background: "#F0E5CC", padding: "16px" }}>
                  <div className="mb-4 px-2 pt-2">
                    <p
                      style={{
                        fontFamily: "var(--font-mono), monospace",
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: "#11100D",
                        opacity: 0.7,
                        margin: 0,
                      }}
                    >
                      Get oriented
                    </p>
                    <h2
                      className="mt-2"
                      style={{
                        fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
                        fontWeight: 400,
                        fontSize: 34,
                        lineHeight: 1.02,
                        letterSpacing: "-0.03em",
                        color: "#11100D",
                        margin: 0,
                        textTransform: "uppercase",
                      }}
                    >
                      Find the zone fast
                    </h2>
                  </div>
                  <SpotLocationMap
                    latitude={spot.latitude}
                    longitude={spot.longitude}
                    spotName={spot.name}
                  />
                </article>
              )}

              {utilityLinks.length > 0 && (
                <article className="utility-strip rot-1">
                  <p
                    style={{
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "#11100D",
                      opacity: 0.7,
                      margin: 0,
                    }}
                  >
                    Keep planning
                  </p>
                  <h2
                    className="mt-2"
                    style={{
                      fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
                      fontWeight: 400,
                      fontSize: 34,
                      lineHeight: 1.02,
                      letterSpacing: "-0.03em",
                      color: "#11100D",
                      margin: 0,
                    }}
                  >
                    Build the rest of the session around {cityName}
                  </h2>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {utilityLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="block rounded-sm border-[2px] border-[#11100D] bg-[#F4EBD8] p-4 transition hover:translate-y-[-1px]"
                        style={{ boxShadow: "2px 3px 0 rgba(17,16,13,0.18)" }}
                      >
                        <p
                          style={{
                            fontFamily: "var(--font-mono), monospace",
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            color: "#0B3A75",
                            margin: 0,
                          }}
                        >
                          {link.label}
                        </p>
                        <p
                          className="mt-2"
                          style={{
                            fontFamily: "var(--font-body), 'DM Sans', sans-serif",
                            fontSize: 14,
                            lineHeight: 1.5,
                            color: "#11100D",
                            margin: 0,
                          }}
                        >
                          {link.description}
                        </p>
                      </Link>
                    ))}
                  </div>
                </article>
              )}

              <article className="torn relative rot-3" style={{ background: "#F0E5CC", padding: "18px 18px 20px" }}>
                <p
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "#B91C1C",
                    margin: 0,
                  }}
                >
                  Confidence note
                </p>
                <h2
                  className="mt-2"
                  style={{
                    fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
                    fontWeight: 400,
                    fontSize: 30,
                    lineHeight: 1.04,
                    letterSpacing: "-0.03em",
                    color: "#11100D",
                    margin: 0,
                    textTransform: "uppercase",
                  }}
                >
                  {spot.beginnerNotes ? "Beginner notes" : "Pivot plan"}
                </h2>
                <p
                  className="mt-4"
                  style={{
                    fontFamily: "var(--font-body), 'DM Sans', sans-serif",
                    fontSize: 15,
                    lineHeight: 1.6,
                    color: "#11100D",
                    margin: 0,
                  }}
                >
                  {spot.beginnerNotes ||
                    `If ${spot.name} gets too busy or too ruffled, use the local tide, crowd, and time-of-day guides to line up a cleaner backup in ${cityName}.`}
                </p>
                {spot.citySlug && (
                  <Link
                    href={
                      spot.beginnerNotes
                        ? `/beginner/${getIntentSlug(spot.citySlug, spot.state)}`
                        : `/least-crowded/${getIntentSlug(spot.citySlug, spot.state)}`
                    }
                    className="mt-4 inline-flex items-center gap-2"
                    style={{
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "#B91C1C",
                    }}
                  >
                    {spot.beginnerNotes ? `See beginner spots in ${cityName}` : `Find a less crowded ${cityName} backup`}
                    <SpotGeneratedIcon
                      name="launch-arrow"
                      size={20}
                      className="h-4 w-4 object-contain"
                    />
                  </Link>
                )}
              </article>
            </div>
          </section>
        )}

        {spot.faq && spot.faq.length > 0 && (
          <section className="mt-10" aria-labelledby="spot-faq-title">
            <p
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#11100D",
                opacity: 0.7,
                margin: 0,
              }}
            >
              Quick answers
            </p>
            <h2
              id="spot-faq-title"
              className="mt-2"
              style={{
                fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
                fontWeight: 400,
                fontSize: "clamp(28px, 4vw, 42px)",
                lineHeight: 1.02,
                letterSpacing: "-0.03em",
                color: "#11100D",
                margin: 0,
              }}
            >
              {spot.name} FAQs
            </h2>
            <div className="mt-5 space-y-3">
              {spot.faq.map((item) => (
                <details
                  key={item.question}
                  className="torn group overflow-hidden"
                  style={{ background: "#F4EBD8" }}
                >
                  <summary
                    className="cursor-pointer list-none px-5 py-4"
                    style={{
                      fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
                      fontWeight: 400,
                      fontSize: 20,
                      lineHeight: 1.08,
                      color: "#11100D",
                    }}
                  >
                    {item.question}
                  </summary>
                  <div
                    className="border-t border-[#11100D]/15 px-5 py-4"
                    style={{
                      fontFamily: "var(--font-body), 'DM Sans', sans-serif",
                      fontSize: 15,
                      lineHeight: 1.6,
                      color: "#11100D",
                    }}
                  >
                    {item.answer}
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}
      </section>
    </div>
  );
}
