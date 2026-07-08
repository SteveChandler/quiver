import type { ReactElement } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Compass, MapPin, Waves } from "lucide-react";
import { ConditionsTicker } from "@/components/conditions/conditions-ticker";
import { MultiDayForecastTable } from "@/components/forecast/forecast-table";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEnhancedBeachForecasts } from "@/actions/forecast-actions";
import { getCurrentForecast } from "@/lib/utils/current-forecast-utils";
import { forecastToConditionsData } from "@/lib/mappers/conditions-mappers";
import { buildBeachUrlWithTab } from "@/lib/utils/beach-url-utils";
import type { Beach, Database } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

export const dynamic = "force-dynamic";

interface CustomSpotPageProps {
  params: Promise<{ id: string }>;
}

type CustomSpotRow = Database["public"]["Tables"]["custom_spots"]["Row"];
type BeachPhotoPreview = Pick<
  Database["public"]["Tables"]["beach_photos"]["Row"],
  "image_url" | "thumb_url"
>;

const PRIVATE_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
  },
};

async function getVisibleCustomSpot(id: string): Promise<CustomSpotRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("custom_spots")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[CustomSpotDetailPage] Error fetching custom spot:", error);
    return null;
  }

  return data as CustomSpotRow | null;
}

async function getNearestBeach(beachId: string | null): Promise<Beach | null> {
  if (!beachId) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("beaches")
    .select("*")
    .eq("id", beachId)
    .maybeSingle();

  if (error) {
    console.error("[CustomSpotDetailPage] Error fetching nearest beach:", error);
    return null;
  }

  return data as Beach | null;
}

async function getBorrowedForecasts(
  beachId: string | null,
): Promise<EnhancedForecastEntity[]> {
  if (!beachId) return [];

  const result = await getEnhancedBeachForecasts(beachId, 10);
  if (!result.success || !result.data) return [];

  return result.data;
}

function normalizePhotoUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null;

  return trimmed;
}

async function getNearestBeachPhoto(
  beachId: string | null,
): Promise<string | null> {
  if (!beachId) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("beach_photos")
    .select("image_url, thumb_url")
    .eq("beach_id", beachId)
    .eq("approved", true)
    .is("deleted_at", null)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[CustomSpotDetailPage] Error fetching nearest beach photo:", error);
    return null;
  }

  const photo = data as BeachPhotoPreview | null;
  return normalizePhotoUrl(photo?.thumb_url) ?? normalizePhotoUrl(photo?.image_url);
}

function formatNumber(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "Not set";
  return `${Math.round(value)} deg`;
}

function formatSwellWindow(spot: CustomSpotRow): string {
  if (spot.swell_window_min_deg == null || spot.swell_window_max_deg == null) {
    return "Not set";
  }

  return `${Math.round(spot.swell_window_min_deg)}-${Math.round(
    spot.swell_window_max_deg,
  )} deg`;
}

function formatDistance(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "Nearest forecast spot";
  return `${value.toFixed(1)} mi to nearest forecast spot`;
}

export async function generateMetadata(
  props: CustomSpotPageProps,
): Promise<Metadata> {
  const { id } = await props.params;
  const spot = await getVisibleCustomSpot(id);

  if (!spot) {
    return {
      title: "Custom Spot",
      robots: PRIVATE_ROBOTS,
    };
  }

  return {
    title: `${spot.name} Surf Forecast | Quiver`,
    description: `Borrowed surf forecast and local conditions for ${spot.name}.`,
    robots:
      spot.visibility === "public"
        ? { index: true, follow: true }
        : PRIVATE_ROBOTS,
  };
}

export default async function CustomSpotDetailPage(
  props: CustomSpotPageProps,
): Promise<ReactElement> {
  const { id } = await props.params;
  const spot = await getVisibleCustomSpot(id);

  if (!spot) notFound();

  const [nearestBeach, forecasts, heroPhotoUrl] = await Promise.all([
    getNearestBeach(spot.nearest_beach_id),
    getBorrowedForecasts(spot.nearest_beach_id),
    getNearestBeachPhoto(spot.nearest_beach_id),
  ]);
  const currentForecast = getCurrentForecast(forecasts);
  const beachTimezone = nearestBeach?.timezone ?? null;
  const fullForecastHref = nearestBeach
    ? buildBeachUrlWithTab(nearestBeach, "forecast")
    : null;

  return (
    <ZineSurface
      sectionLabel="Custom spot"
      editionLabel="Borrowed forecast"
      data-testid="custom-spot-zine-surface"
    >
      <main className="font-sans text-[#11100D]">
        <nav className="mb-8">
          <Link
            href="/map"
            className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#11100D]/62 transition-colors hover:text-[#F78E42] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to map
          </Link>
        </nav>

        <header className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-end">
          <div className="relative">
            <QuiverSticker
              sticker="orangeTape"
              className="absolute -top-7 left-6 hidden w-36 rotate-[2deg] opacity-85 sm:block"
            />
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <span className="label-black">Custom spot</span>
              <span className="border-2 border-[#11100D] bg-[#F78E42] px-3 py-1 font-mono text-[11px] font-black uppercase tracking-[0.14em] text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.24)]">
                {spot.visibility}
              </span>
            </div>
            <h1 className="zine-h1 font-heading font-black uppercase leading-[0.88] tracking-normal text-[#11100D]">
              {spot.name}
            </h1>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs uppercase tracking-[0.12em] text-[#11100D]/65">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-[#11100D]" aria-hidden="true" />
                {spot.lat.toFixed(4)}, {spot.lon.toFixed(4)}
              </span>
              {nearestBeach ? (
                <>
                  <span aria-hidden>/</span>
                  <span>Forecast borrowed from {nearestBeach.name}</span>
                </>
              ) : null}
            </div>
          </div>

          {nearestBeach && heroPhotoUrl ? (
            <div className="polaroid rot-2">
              <div className="photo">
                <Image
                  src={heroPhotoUrl}
                  alt={`${nearestBeach.name} surf zone`}
                  width={800}
                  height={600}
                  className="h-full w-full object-cover saturate-[0.78]"
                  sizes="(min-width: 1024px) 400px, 100vw"
                />
                <div className="absolute inset-0 bg-[#F4EBD8]/10 mix-blend-screen" />
                <QuiverSticker
                  sticker="breakingWave"
                  className="absolute -bottom-5 -right-4 w-28 -rotate-[2deg] drop-shadow-md"
                />
              </div>
              <p className="cap">Borrowed from {nearestBeach.name}</p>
            </div>
          ) : (
            <div className="torn torn-tb relative hidden min-h-48 border-2 border-[#11100D] bg-[#FBF6E8] p-6 lg:block">
              <QuiverSticker
                sticker="breakingWave"
                className="absolute -right-4 -top-4 w-28 -rotate-[2deg] opacity-85"
              />
              <p className="max-w-xs font-heading text-2xl font-black uppercase leading-tight text-[#11100D]">
                Forecast borrowed, photo pending.
              </p>
            </div>
          )}
        </header>

        <section className="torn torn-tb mt-12 border-2 border-[#11100D] bg-[#FBF6E8]">
          <div className="mb-4 flex items-center gap-3">
            <span className="circled bg-[#F78E42]/35 font-mono text-base">01</span>
            <h2 className="font-heading text-2xl font-black uppercase leading-tight text-[#11100D]">
              Current conditions
            </h2>
          </div>
          {currentForecast ? (
            <div className="overflow-hidden border-2 border-[#11100D] bg-[#FBF6E8] font-mono shadow-[2px_3px_0_rgba(17,16,13,0.18)] [&_span]:!text-[#11100D] [&_svg]:!text-[#11100D]">
              <ConditionsTicker
                data={forecastToConditionsData(currentForecast, nearestBeach)}
                beachName={spot.name}
                showFrequency={Boolean(nearestBeach)}
                className="border-0 bg-[#FBF6E8] text-[#11100D]"
              />
            </div>
          ) : (
            <p className="font-mono text-sm uppercase tracking-[0.08em] text-[#11100D]/68">
              Forecast data is not available for this custom spot yet.
            </p>
          )}
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.85fr_1.35fr]">
          <section className="torn torn-tb border-2 border-[#11100D] bg-[#F0E5CC]">
            <div className="mb-5 flex items-center gap-3">
              <QuiverSticker
                sticker="surfWax"
                className="w-14 rotate-[3deg] drop-shadow-sm"
              />
              <h2 className="flex items-center gap-2 font-heading text-2xl font-black uppercase leading-tight text-[#11100D]">
                <Compass className="h-5 w-5" aria-hidden="true" />
                Spot setup
              </h2>
            </div>
            <div className="space-y-3 text-sm">
              <DetailRow
                label="Break"
                value={spot.break_type ?? "Not set"}
                mono={false}
              />
              <DetailRow
                label="Facing"
                value={formatNumber(spot.facing_direction_deg)}
              />
              <DetailRow
                label="Offshore"
                value={formatNumber(spot.offshore_direction_deg)}
              />
              <DetailRow label="Swell window" value={formatSwellWindow(spot)} />
              <DetailRow
                label="Forecast source"
                value={
                  nearestBeach
                    ? `${nearestBeach.name} (${formatDistance(
                        spot.nearest_beach_distance_mi,
                      )})`
                    : "No nearest beach linked"
                }
              />
            </div>
          </section>

          <section className="torn torn-tb border-2 border-[#11100D] bg-[#FBF6E8]">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-heading text-2xl font-black uppercase leading-tight text-[#11100D]">
                <Waves className="h-5 w-5" aria-hidden="true" />
                Borrowed forecast
              </h2>
              {fullForecastHref ? (
                <Link
                  href={fullForecastHref}
                  className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#11100D] underline decoration-[#F78E42] decoration-2 underline-offset-4 transition-colors hover:text-[#F78E42]"
                >
                  Full forecast
                </Link>
              ) : null}
            </div>
            <div
              className="zine-forecast-table overflow-x-auto border-2 border-[#11100D] bg-[#F4EBD8] p-3 font-mono shadow-[2px_3px_0_rgba(17,16,13,0.18)]"
              data-testid="custom-spot-forecast-table"
            >
              <MultiDayForecastTable
                forecasts={forecasts}
                beachTimezone={beachTimezone}
              />
            </div>
          </section>
        </div>
      </main>
    </ZineSurface>
  );
}

function DetailRow({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-dashed border-[#11100D]/24 pb-2 last:border-b-0 last:pb-0">
      <span className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#11100D]/58">
        {label}
      </span>
      <span
        className={`text-right font-bold text-[#11100D] ${
          mono ? "font-mono" : "font-sans"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
