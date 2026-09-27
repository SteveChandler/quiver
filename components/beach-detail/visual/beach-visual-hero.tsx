"use client";

import { useSearchParams } from "next/navigation";
import { RipCurrentWarning } from "@/components/beach-detail/rip-current-warning";
import { HomeHeroMedia } from "@/components/oracle/zine/home-hero-media";
import type { BeachSources } from "@/hooks/use-beach-detail-data";
import type { SwellPartition } from "@/lib/domains/conditions/map-forecast";
import { captureClientPostHogEventAfterConsent } from "@/lib/posthog-client";
import { beachForecastHeadingSuffix, formatForecastHeadingDate } from "@/lib/utils/beach-forecast-heading";
import { normalizeForecastDateParam, normalizeForecastWindowParam } from "@/lib/utils/forecast-window-param";
import type { PublicSurfCall } from "@/lib/utils/public-surf-call";

export interface BeachHeroSurfFacts { size: string | null; swell: string | null; wind: string | null; bestWindow: string | null }
export interface BeachHeroDayFacts { water: string | null; nextLow: string | null; advisory: string | null }

interface BeachVisualHeroProps {
  beach: { id: string; name: string; lat: number | null; lon: number | null; city: string | null };
  timezone: string;
  localDate: string;
  forecastLocalDate: string | null;
  photoUrl: string | null;
  sources: BeachSources | null;
  swellPartition: SwellPartition | null;
  call: PublicSurfCall;
  surf: BeachHeroSurfFacts;
  beachDay: BeachHeroDayFacts;
}

const TIER_HEX = { EPIC: "#00D4AA", GOOD: "#00D4AA", FAIR: "#FDB84B", RIDEABLE: "#FDB84B", MEH: "#F4EBD8" } as const;
const BEACH_PRIORITY = ["cam", "photo", "swell", "satellite"] as const;

function sentenceCase(label: string): string {
  return label.charAt(0) + label.slice(1).toLowerCase();
}

function Facts({ items }: { items: Array<string | null> }) {
  const present = items.filter((item): item is string => Boolean(item));
  if (present.length === 0) return null;
  return <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#F5EEDC]/85">{present.map((item) => <span key={item}>{item}</span>)}</p>;
}

export function BeachVisualHero(props: BeachVisualHeroProps) {
  const { beach, timezone, localDate, call, surf, beachDay } = props;
  const searchParams = useSearchParams();
  const hasSelection = Boolean(
    normalizeForecastDateParam(searchParams?.get("date")) || normalizeForecastWindowParam(searchParams?.get("window")),
  );
  const suffix = beachForecastHeadingSuffix(formatForecastHeadingDate(props.forecastLocalDate, timezone), hasSelection);
  const hasBeachDay = Boolean(beachDay.water || beachDay.nextLow || beachDay.advisory);

  return (
    <section data-testid="beach-visual-hero" aria-labelledby="beach-hero-heading">
      <RipCurrentWarning beachId={beach.id} localDate={localDate} timezone={timezone} />
      <HomeHeroMedia
        beachName={beach.name}
        lat={beach.lat}
        lon={beach.lon}
        photoUrl={props.photoUrl}
        sources={props.sources}
        swellPartition={props.swellPartition}
        viewpointPriority={BEACH_PRIORITY}
        storageKey="quiver:beach-hero-viewpoint"
        aspectClassName="aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/9]"
        onViewpointChange={(viewpoint) =>
          captureClientPostHogEventAfterConsent("beach_hero_viewpoint_changed", { beach_id: beach.id, viewpoint })
        }
      >
        <div className="p-4 sm:p-7">
          <h1 id="beach-hero-heading" className="zine-display m-0 text-[#F5EEDC]">
            <span className="block text-5xl leading-none sm:text-7xl">{beach.name}</span>{" "}
            <span className="mt-2 block font-mono text-xs uppercase tracking-[0.2em] text-[#F5EEDC]/85 sm:text-sm">{suffix}</span>
          </h1>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div data-testid="beach-public-call" className="rounded-2xl border border-[#F5EEDC]/15 bg-[#0D1020]/60 p-4 backdrop-blur">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#F2C94C]">Surfing today · for most surfers</p>
              {call.kind === "call" ? (
                <p className="mt-1 flex items-baseline gap-3">
                  <span className="zine-display text-4xl uppercase" style={{ color: TIER_HEX[call.label] }}>{sentenceCase(call.label)}</span>
                  <span className="text-xl text-[#F5EEDC]" style={{ fontFamily: "var(--font-zine-marker), 'Permanent Marker', cursive" }}>{call.action}</span>
                </p>
              ) : call.kind === "no_call" ? (
                <>
                  <p className="zine-display mt-1 text-3xl text-[#F5EEDC]">No call today</p>
                  <p className="mt-1 text-sm text-[#F5EEDC]/85">{call.reason}</p>
                </>
              ) : null}
              <Facts items={[surf.size, surf.swell, surf.wind, surf.bestWindow ? `best ${surf.bestWindow}` : null]} />
            </div>
            {hasBeachDay ? (
              <div className="rounded-2xl border border-[#F5EEDC]/15 bg-[#0D1020]/60 p-4 backdrop-blur">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#F2C94C]">Beach day today</p>
                {beachDay.water ? <p className="zine-display mt-1 text-4xl text-[#7FDCF0]">{beachDay.water}</p> : null}
                <Facts items={[beachDay.nextLow, beachDay.advisory]} />
              </div>
            ) : null}
          </div>
        </div>
      </HomeHeroMedia>
    </section>
  );
}
