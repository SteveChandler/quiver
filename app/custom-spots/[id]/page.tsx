import type { ReactElement } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Compass, MapPin, Waves } from "lucide-react";
import { ConditionsTicker } from "@/components/conditions/conditions-ticker";
import { MultiDayForecastTable } from "@/components/forecast/forecast-table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEnhancedBeachForecasts } from "@/actions/forecast-actions";
import { getCurrentForecast } from "@/lib/utils/current-forecast-utils";
import { forecastToConditionsData } from "@/lib/mappers/conditions-mappers";
import type { Beach, Database } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

export const dynamic = "force-dynamic";

interface CustomSpotPageProps {
  params: Promise<{ id: string }>;
}

type CustomSpotRow = Database["public"]["Tables"]["custom_spots"]["Row"];

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

  const [nearestBeach, forecasts] = await Promise.all([
    getNearestBeach(spot.nearest_beach_id),
    getBorrowedForecasts(spot.nearest_beach_id),
  ]);
  const currentForecast = getCurrentForecast(forecasts);
  const beachTimezone = nearestBeach?.timezone ?? null;

  return (
    <main className="min-h-screen bg-background">
      <section className="container mx-auto max-w-5xl space-y-6 px-4 py-6">
        <Link
          href="/map"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to map
        </Link>

        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Custom spot</Badge>
            <Badge variant={spot.visibility === "public" ? "outline" : "default"}>
              {spot.visibility}
            </Badge>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-normal">{spot.name}</h1>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {spot.lat.toFixed(4)}, {spot.lon.toFixed(4)}
              {nearestBeach ? ` · Forecast borrowed from ${nearestBeach.name}` : ""}
            </p>
          </div>
        </header>

        {currentForecast ? (
          <ConditionsTicker
            data={forecastToConditionsData(currentForecast, nearestBeach)}
            beachName={spot.name}
            showFrequency={Boolean(nearestBeach)}
          />
        ) : (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Forecast data is not available for this custom spot yet.
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Compass className="h-5 w-5" aria-hidden="true" />
                Spot setup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <DetailRow label="Break" value={spot.break_type ?? "Not set"} />
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Waves className="h-5 w-5" aria-hidden="true" />
                Borrowed forecast
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MultiDayForecastTable
                forecasts={forecasts}
                beachTimezone={beachTimezone}
              />
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2 last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
