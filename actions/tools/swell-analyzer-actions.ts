"use server";

import { createPublicReadClient } from "@/lib/supabase/server";
import { analyzeSwellMatch } from "@/lib/analyzers/swell-analyzer";
import { degreesToCardinal } from "@/lib/utils/geo-utils";
import type { ConditionEvaluation } from "@/types/morning-intel";

export interface SwellAnalyzerBeach {
  id: string;
  name: string;
  slug: string | null;
  swell_window_min_deg: number | null;
  swell_window_max_deg: number | null;
}

export interface CurrentSwellData {
  height: number | null;
  period: number | null;
  direction: number | null;
  cardinal: string | null;
  secondaryHeight: number | null;
  secondaryPeriod: number | null;
  secondaryDirection: number | null;
  secondaryCardinal: string | null;
  forecastAt: string;
}

export interface SwellAnalyzerData {
  beach: SwellAnalyzerBeach;
  currentSwell: CurrentSwellData | null;
  swellMatch: ConditionEvaluation | null;
}

export async function getSwellAnalyzerBeach(slug: string): Promise<{
  success: boolean;
  data?: SwellAnalyzerBeach;
  error?: string;
}> {
  const supabase = createPublicReadClient();

  const { data, error } = await supabase
    .from("beaches")
    .select("id, name, slug, swell_window_min_deg, swell_window_max_deg")
    .eq("slug", slug)
    .eq("is_private", false)
    .single();

  if (error || !data) {
    return { success: false, error: "Beach not found" };
  }

  return {
    success: true,
    data: {
      id: data.id,
      name: data.name,
      slug: data.slug,
      swell_window_min_deg: data.swell_window_min_deg ?? null,
      swell_window_max_deg: data.swell_window_max_deg ?? null,
    },
  };
}

export async function getSwellAnalyzerData(slug: string): Promise<{
  success: boolean;
  data?: SwellAnalyzerData;
  error?: string;
}> {
  const beachResult = await getSwellAnalyzerBeach(slug);
  if (!beachResult.success || !beachResult.data) {
    return { success: false, error: beachResult.error };
  }

  const beach = beachResult.data;

  // Fetch latest daily intel for this beach (most recent forecast date)
  const supabase = createPublicReadClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: intel } = await supabase
    .from("beach_daily_intel")
    .select(
      "forecast_date, primary_swell_height_ft, primary_swell_period_s, primary_swell_direction_deg, primary_swell_direction_text, secondary_swell_height_ft, secondary_swell_period_s, secondary_swell_direction_deg, secondary_swell_direction_text"
    )
    .eq("beach_id", beach.id)
    .gte("forecast_date", today)
    .order("forecast_date", { ascending: true })
    .limit(1);

  let currentSwell: CurrentSwellData | null = null;
  if (intel && intel.length > 0) {
    const f = intel[0];
    currentSwell = {
      height: f.primary_swell_height_ft ?? null,
      period: f.primary_swell_period_s ?? null,
      direction: f.primary_swell_direction_deg ?? null,
      cardinal: f.primary_swell_direction_text ??
        (f.primary_swell_direction_deg != null
          ? degreesToCardinal(f.primary_swell_direction_deg)
          : null),
      secondaryHeight: f.secondary_swell_height_ft ?? null,
      secondaryPeriod: f.secondary_swell_period_s ?? null,
      secondaryDirection: f.secondary_swell_direction_deg ?? null,
      secondaryCardinal: f.secondary_swell_direction_text ??
        (f.secondary_swell_direction_deg != null
          ? degreesToCardinal(f.secondary_swell_direction_deg)
          : null),
      forecastAt: f.forecast_date,
    };
  }

  // Evaluate swell match against beach's preferred window
  let swellMatch: ConditionEvaluation | null = null;
  if (currentSwell?.direction != null) {
    swellMatch = analyzeSwellMatch(currentSwell.direction, {
      name: beach.name,
      swellWindowMin: beach.swell_window_min_deg,
      swellWindowMax: beach.swell_window_max_deg,
    });
  }

  return {
    success: true,
    data: {
      beach,
      currentSwell,
      swellMatch,
    },
  };
}

