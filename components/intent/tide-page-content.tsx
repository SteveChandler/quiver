import Link from "next/link";
import { FAQSection } from "@/components/seo/faq-schema";
import { generateIntentFAQ } from "@/lib/seo/intent-faq-generator";
import { CityMapView } from "@/components/city/city-map-view";
import type { SurfSpot } from "@/lib/data/surf-spots";
import type { CityTideDataExpanded } from "@/actions/forecast/intent-forecast-actions";
import type { IntentPageContent } from "@/lib/seo/intent-content-templates";
import type { IntentKey } from "@/lib/constants/intent-definitions";
import { SURF_INTENTS } from "@/lib/constants/surf-intents";
import { ContinueExploring } from "@/components/shared/continue-exploring";
import { SectionFadeUp } from "@/components/shared/section-fade-up";
import { TideBreadcrumbs } from "@/components/tide-stations/tide-breadcrumbs";
import { TideStationNow } from "@/components/tide-stations/tide-station-now";
import { TideWeekTable } from "@/components/tide-stations/tide-week-table";
import { TidePanelChart } from "@/components/tides/tide-panel-chart";
import { ZineSurface } from "@/components/zine";
import { formatZoneOffset } from "@/lib/tide-stations/format";
import { tideStationPath } from "@/lib/tide-stations/slug";
import { BeachTideCards } from "./beach-tide-cards";
import { UtilitySessionHandoff } from "./utility-session-handoff";
import { IntentAppHandoffCta } from "./intent-app-handoff-cta";
import { toCityMapSpot } from "@/lib/utils/map-client-props";

interface TidePageContentProps {
  cityName: string;
  citySlug: string;
  stateSlug: string;
  stateName: string;
  regionLabel: string;
  pageContent: IntentPageContent;
  tideData: CityTideDataExpanded;
  spots: SurfSpot[];
  baseUrl: string;
  bestTimeToSurfUrl?: string;
  excludeIntents?: IntentKey[];
}

/**
 * TidePageContent - Dedicated composition component for /tide/[city] pages.
 *
 * Composes: hero → chart → 7-day table → beach cards → map → editorial → CTAs
 * Following the BeginnerPageContent pattern for intent-specific pages.
 */
export function TidePageContent({
  cityName,
  citySlug,
  stateSlug,
  stateName,
  regionLabel,
  pageContent,
  tideData,
  spots,
  baseUrl,
  bestTimeToSurfUrl,
  excludeIntents,
}: TidePageContentProps) {
  const definition = SURF_INTENTS["tide"];
  const faqItems = generateIntentFAQ(
    "tide",
    cityName,
    spots.slice(0, 3).map((s) => s.name),
    stateSlug
  );

  // An empty series shows nothing rather than "no data" boxes.
  const view = tideData.view && tideData.view.extremes.length > 0 ? tideData.view : null;
  const sourceLine = view
    ? `Predicted tides from ${view.station ? `the NOAA gauge at ${view.station.name}` : "NOAA"}. Times are local (${formatZoneOffset(view.renderedAtMs, view.timeZone)}). Not live water levels.`
    : null;

  return (
    <div>
      <ZineSurface sectionLabel="Tides" data-testid="city-tide-paper">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-10 text-[#11100D]">
          <TideBreadcrumbs
            crumbs={[
              { name: "Quiver", path: "/" },
              { name: `${cityName} Surf`, path: `/${stateSlug}/${citySlug}` },
              { name: "Tides", path: `/tide/${citySlug}` },
            ]}
          />
          <header className="mb-8">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[#8A5E00]">
              Tides · {regionLabel}
            </p>
            <h1 className="mt-2 font-heading text-3xl font-bold leading-tight text-[#11100D] md:text-4xl">
              {pageContent.heading}
            </h1>
            {sourceLine && <p className="mt-3 text-sm leading-relaxed text-[#11100D]/75">{sourceLine}</p>}
            <p className="mt-3 text-base leading-relaxed text-[#11100D]/85">{pageContent.intro}</p>
          </header>

          {view && (
            <div className="space-y-8">
              <TideStationNow extremes={view.extremes} timeZone={view.timeZone} renderedAtMs={view.renderedAtMs} />

              <section aria-labelledby="tide-chart-heading">
                <h2 id="tide-chart-heading" className="mb-3 font-heading text-2xl font-bold text-[#11100D]">
                  Tide chart
                </h2>
                <TidePanelChart
                  curve={view.curve}
                  extremes={view.extremes}
                  timeZone={view.timeZone}
                  renderedAtMs={view.renderedAtMs}
                />
              </section>

              {view.days.length > 0 && (
                <section aria-labelledby="tide-week-heading">
                  <h2 id="tide-week-heading" className="mb-3 font-heading text-2xl font-bold text-[#11100D]">
                    Next 7 days
                  </h2>
                  <TideWeekTable days={view.days} timeZone={view.timeZone} />
                </section>
              )}

              {view.station && (
                <section
                  aria-labelledby="tide-station-heading"
                  className="border-2 border-dashed border-[#11100D] p-4"
                  data-testid="city-tide-station"
                >
                  <p
                    id="tide-station-heading"
                    className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[#8A5E00]"
                  >
                    Tide station
                  </p>
                  <p className="mt-2 text-[#11100D]">
                    <span className="font-semibold">{view.station.name}</span>
                    <span className="font-mono text-sm text-[#11100D]/70"> · NOAA {view.station.sourceStationId}</span>
                  </p>
                  <Link
                    href={tideStationPath(view.station.slug)}
                    className="mt-2 inline-block font-semibold text-[#AA4918] underline underline-offset-2"
                  >
                    Full station tides →
                  </Link>
                </section>
              )}

              <BeachTideCards
                beaches={tideData.beachTidePreferences}
                citySlug={citySlug}
                stateSlug={stateSlug}
                cityName={cityName}
              />
            </div>
          )}
        </div>
      </ZineSurface>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="space-y-12">
          <SectionFadeUp>
            <UtilitySessionHandoff
              bestTimeToSurfUrl={bestTimeToSurfUrl}
              cityName={cityName}
              citySlug={citySlug}
              intent="tide"
              stateSlug={stateSlug}
            />
          </SectionFadeUp>

          <SectionFadeUp>
            <IntentAppHandoffCta intent="tide" cityName={cityName} citySlug={citySlug} />
          </SectionFadeUp>

          {/* Map & Recommendations */}
          {spots.length > 0 && (
            <SectionFadeUp>
              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                  Top spot recommendations
                </h2>
                <p className="mb-6 text-sm text-gray-600">
                  Sort your quiver, choose the right tide window, and jot down a
                  backup in case the main peak gets stacked.
                </p>
                <CityMapView
                  spots={spots.map(toCityMapSpot)}
                  cityName={cityName}
                  citySlug={citySlug}
                  stateSlug={stateSlug}
                  countrySlug="usa"
                />
              </section>
            </SectionFadeUp>
          )}

          {/* Editorial Focus Section */}
          <SectionFadeUp>
            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                What to focus on today
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {definition.focusPoints.map((point) => (
                  <li
                    key={point}
                    className="rounded-xl border border-blue-100/50 bg-gradient-to-br from-white/90 to-blue-50/30 p-4 text-sm text-gray-700 shadow-sm"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            </section>
          </SectionFadeUp>

          {/* Continue Exploring */}
          <SectionFadeUp>
            <ContinueExploring
              currentIntent="tide"
              citySlug={citySlug}
              cityName={cityName}
              stateSlug={stateSlug}
              stateName={stateName}
              bestTimeToSurfUrl={bestTimeToSurfUrl}
              excludeIntents={excludeIntents}
            />
          </SectionFadeUp>

          {/* FAQ Accordion */}
          <SectionFadeUp>
            <FAQSection items={faqItems} locationName={cityName} />
          </SectionFadeUp>
        </div>
      </div>
    </div>
  );
}
