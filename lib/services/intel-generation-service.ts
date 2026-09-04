/**
 * Intel Generation Service
 * Reusable service for generating beach surf intelligence
 * Used by both scheduled workflow and on-demand generation
 */

import { createClient } from "@supabase/supabase-js";
import { currentWaterQuality } from "@/lib/services/water-quality/current-status";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { Database, Json } from "@/types/database";
import { DEFAULT_TIMEZONE } from "@/lib/utils/timezone-utils";
import type {
  BeachPreferences,
  ForecastSlice,
  MorningIntelData,
  MorningIntelRecommendationSummary,
} from "@/types/morning-intel";
import {
  deriveSurfRange,
  recommendTideWindow,
  primarySecondarySwell,
  windAt,
  bestWindowHeuristic,
  confidenceHeuristic,
  analyzeConditions,
  getConservativeRecommendation,
} from "@/lib/utils/morning-intel-utils";
import { scoreNativeConditionInputs } from "@/lib/scoring/native-condition-score";

export class IntelGenerationService {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient<Database>(supabaseUrl, supabaseKey);
  }

  /**
   * Check if beach can have intel generated
   */
  async canGenerateIntel(beachId: string): Promise<boolean> {
    const { data: beach, error } = await this.supabase
      .from("beaches")
      .select("preferred_tide_ft_min, preferred_tide_ft_max")
      .eq("id", beachId)
      .single();

    if (error || !beach) return false;

    return !!(
      beach.preferred_tide_ft_min !== null &&
      beach.preferred_tide_ft_max !== null
    );
  }

  /**
   * Generate intel for a specific beach
   */
  async generateIntel(
    beachId: string,
    targetTime: string = "06:00",
    timezone?: string | null
  ): Promise<MorningIntelData> {
    // 1. Fetch beach preferences
    const beachPrefs = await this.fetchBeachPreferences(beachId);

    // 2. Fetch forecast data
    const forecasts = await this.fetchForecasts(beachId, timezone);

    // 3. Fetch water quality (optional — missing rows are handled gracefully)
    // Cast through `any` because the typed client was constructed before beach_water_quality
    // was added to the generated Database type and is regenerated separately.
    const { data: wqData } = await (this.supabase as any)
      .from("beach_water_quality")
      .select("status, latest_sample_date")
      .eq("beach_id", beachId)
      .maybeSingle() as { data: { status: string; latest_sample_date: string | null } | null };

    // 4. Analyze conditions
    const effectiveWq = wqData
      ? (await currentWaterQuality([{ ...wqData, beach_id: beachId }]))[0] : null;
    const intel = this.analyzeForecasts(forecasts, beachPrefs, targetTime, timezone,
      effectiveWq ? { ...effectiveWq, latest_sample_date: effectiveWq.county_advisory_status ? null : effectiveWq.latest_sample_date } : null);

    return intel;
  }

  /**
   * Fetch beach preferences
   */
  private async fetchBeachPreferences(beachId: string): Promise<BeachPreferences | null> {
    const { data: beach, error } = await this.supabase
      .from("beaches")
      .select(
        "name, swell_window_min_deg, swell_window_max_deg, wind_offshore_deg, wind_offshore_tol_deg, preferred_tide_ft_min, preferred_tide_ft_max, hazards, skill_level, break_type, aspect_deg"
      )
      .eq("id", beachId)
      .single();

    if (error || !beach) return null;

    const aspectDeg: number | null = beach.aspect_deg ?? null;
    const expectedOffshoreDeg =
      aspectDeg == null ? null : (Number(aspectDeg) + 180) % 360;

    const dbWindOffshoreDeg: number | null = beach.wind_offshore_deg ?? null;
    const shortestAngleDiff = (a: number, b: number) => {
      return Math.abs((((a - b) % 360) + 540) % 360 - 180);
    };

    let windOffshoreDegUsed: number | null = dbWindOffshoreDeg;
    let windOffshoreDegSource: "db" | "computed_from_aspect" | "db_overridden_with_aspect" =
      "db";

    if (dbWindOffshoreDeg == null && expectedOffshoreDeg != null) {
      windOffshoreDegUsed = expectedOffshoreDeg;
      windOffshoreDegSource = "computed_from_aspect";
    } else if (dbWindOffshoreDeg != null && expectedOffshoreDeg != null) {
      const diff = shortestAngleDiff(dbWindOffshoreDeg, expectedOffshoreDeg);
      if (diff > 90) {
        windOffshoreDegUsed = expectedOffshoreDeg;
        windOffshoreDegSource = "db_overridden_with_aspect";
      }
    }

    return {
      name: beach.name,
      swellWindowMin: beach.swell_window_min_deg,
      swellWindowMax: beach.swell_window_max_deg,
      windOffshoreDeg: windOffshoreDegUsed,
      windOffshoreTol: beach.wind_offshore_tol_deg,
      tideMinFt: beach.preferred_tide_ft_min,
      tideMaxFt: beach.preferred_tide_ft_max,
      hazards: beach.hazards,
      skillLevel: beach.skill_level,
      breakType: beach.break_type,
      // Extra fields for payload/debugging
      aspectDeg,
      windOffshoreDegSource,
    };
  }

  /**
   * Parse numeric value from text with units
   */
  private parseNumericValue(value: string | number | null): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return value;
    
    const match = String(value).match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
  }

  /**
   * Parse direction from text or number
   */
  private parseDirection(value: string | number | null): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return value;
    
    const cardinalMap: Record<string, number> = {
      "N": 0, "NNE": 22.5, "NE": 45, "ENE": 67.5,
      "E": 90, "ESE": 112.5, "SE": 135, "SSE": 157.5,
      "S": 180, "SSW": 202.5, "SW": 225, "WSW": 247.5,
      "W": 270, "WNW": 292.5, "NW": 315, "NNW": 337.5,
    };
    
    const direction = String(value).trim().toUpperCase();
    return cardinalMap[direction] ?? this.parseNumericValue(value);
  }

  /**
   * Fetch forecast data
   */
  private async fetchForecasts(
    beachId: string,
    timezone?: string | null
  ): Promise<ForecastSlice> {
    const now = new Date();
    const tz = timezone || DEFAULT_TIMEZONE;
    const today = formatInTimeZone(now, tz, "yyyy-MM-dd");
    const morningStart = fromZonedTime(`${today}T04:00:00`, tz);
    const morningEnd = fromZonedTime(`${today}T13:00:00`, tz);

    const { data: forecasts, error } = await this.supabase
      .from("enhanced_forecasts")
      .select(
        "forecast_at, forecast_date, forecast_time, wave_height, wave_period, wave_direction, wind_speed, wind_direction, tide_height, tide_status, next_tide_time, next_tide_type, next_tide_height, swell_1_height, swell_1_period, swell_1_direction, swell_2_height, swell_2_period, swell_2_direction, confidence_score"
      )
      .eq("beach_id", beachId)
      .gte("forecast_at", morningStart.toISOString())
      .lt("forecast_at", morningEnd.toISOString())
      .order("forecast_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch forecasts: ${error.message}`);
    }

    // Parse text values to numbers and map to ForecastSlice property names
    const parsedForecasts = (forecasts || []).map((f: any) => {
      const forecastAt = f.forecast_at ? new Date(f.forecast_at) : null;
      const hasValidForecastAt =
        forecastAt instanceof Date && !Number.isNaN(forecastAt.getTime());

      return {
        forecast_at: f.forecast_at ?? undefined,
        forecast_date: hasValidForecastAt
          ? formatInTimeZone(forecastAt, tz, "yyyy-MM-dd")
          : f.forecast_date,
        forecast_time: hasValidForecastAt
          ? formatInTimeZone(forecastAt, tz, "HH:mm:ss")
          : f.forecast_time,
        wave_height: this.parseNumericValue(f.wave_height),
        wave_period: this.parseNumericValue(f.wave_period),
        wave_direction: this.parseDirection(f.wave_direction),
        // Map swell_1_* to swell_* (ForecastSlice naming)
        swell_height: this.parseNumericValue(f.swell_1_height),
        swell_period: this.parseNumericValue(f.swell_1_period),
        swell_direction: this.parseDirection(f.swell_1_direction),
        // Map swell_2_* to secondary_swell_* (ForecastSlice naming)
        secondary_swell_height: this.parseNumericValue(f.swell_2_height),
        secondary_swell_period: this.parseNumericValue(f.swell_2_period),
        secondary_swell_direction: this.parseDirection(f.swell_2_direction),
        wind_speed: this.parseNumericValue(f.wind_speed),
        wind_direction: this.parseDirection(f.wind_direction),
        tide_height: this.parseNumericValue(f.tide_height),
        tide_status: f.tide_status,
        confidence_score: f.confidence_score,
      };
    });

    return {
      forecasts: parsedForecasts,
      tides: [], // Tide data is embedded in forecasts
    };
  }

  /**
   * Analyze forecasts and generate intel
   */
  private analyzeForecasts(
    slice: ForecastSlice,
    beachPrefs: BeachPreferences | null,
    targetTime: string,
    timezone?: string | null,
    wqData?: { status: string; latest_sample_date: string | null } | null
  ): MorningIntelData {
    const now = new Date();
    const tz = timezone || DEFAULT_TIMEZONE;
    const date = formatInTimeZone(now, tz, "yyyy-MM-dd");

    // Calculate metrics
    const surf = deriveSurfRange(slice.forecasts);
    const tide = recommendTideWindow(slice.forecasts, beachPrefs);
    const swells = primarySecondarySwell(slice.forecasts);
    const wind = windAt(targetTime, slice.forecasts, tz);
    const bestWindow = bestWindowHeuristic(slice.forecasts, slice.tides, tz);
    const confidence = confidenceHeuristic(slice.forecasts, slice.tides);

    // Analyze conditions
    let conditions = undefined;
    let recommendation: MorningIntelRecommendationSummary = {
      decision: "maybe",
      label: "Maybe",
      reasons: ["check the detailed forecast"],
    };
    if (beachPrefs) {
      conditions = analyzeConditions(
        {
          swellDirection: swells.primary?.direction ?? null,
          wind,
          tide,
        },
        beachPrefs
      );
      recommendation = getConservativeRecommendation(
        conditions,
        wqData ? { status: wqData.status } : undefined
      );
    }

    let notes = "";
    if (conditions) {
      if (recommendation.decision === "worth_it") {
        notes = "Worth it — conditions line up. Check the cam before you go.";
      } else if (recommendation.decision === "skip") {
        notes =
          recommendation.reasons.length > 0
            ? `Skip it — ${recommendation.reasons.join(" and ")} not ideal.`
            : "Skip it — conditions are not ideal.";
      } else {
        notes =
          recommendation.reasons.length > 0
            ? `Maybe — keep an eye on the ${recommendation.reasons.join(" and ")}.`
            : "Maybe — could be worth a look if you're nearby.";
      }
    }

    // Data completeness (same model as scripts/morningIntel.ts)
    const totalPossibleFields =
      slice.forecasts.length * 7 + (slice.tides.length > 0 ? 10 : 0);
    let presentFields = slice.tides.length > 0 ? 10 : 0;

    slice.forecasts.forEach((f) => {
      if (f.wave_height) presentFields++;
      if (f.wave_period) presentFields++;
      if (f.wind_speed) presentFields++;
      if (f.wind_direction) presentFields++;
      if (f.swell_height) presentFields++;
      if (f.swell_period) presentFields++;
      if (f.swell_direction) presentFields++;
    });

    const dataCompleteness =
      totalPossibleFields > 0 ? presentFields / totalPossibleFields : 0;

    return {
      spotName: beachPrefs?.name || "Beach",
      date,
      time: targetTime,
      surf,
      tide,
      swells,
      wind,
      bestWindow,
      confidence,
      notes,
      beachPreferences: beachPrefs || undefined,
      conditions,
      payload: {
        kind: "morning_intel_v2",
        generatedAt: new Date().toISOString(),
        date,
        time: targetTime,
        recommendation,
        conditions,
        bestWindow,
        confidence,
        surf,
        tide,
        wind,
        swells,
        dataCompleteness,
        sources: {
          wave: slice.forecasts.some((f) => f.wave_height !== null),
          tide: slice.forecasts.some((f) => f.tide_height !== null),
          wind: slice.forecasts.some((f) => f.wind_speed !== null),
          swell: slice.forecasts.some((f) => f.swell_height !== null),
        },
        beach: beachPrefs
          ? {
              name: beachPrefs.name,
              skillLevel: beachPrefs.skillLevel ?? null,
              hazards: beachPrefs.hazards ?? null,
              breakType: beachPrefs.breakType ?? null,
              aspectDeg: beachPrefs.aspectDeg ?? null,
              windOffshoreDegUsed: beachPrefs.windOffshoreDeg ?? null,
              windOffshoreDegSource: beachPrefs.windOffshoreDegSource ?? "db",
            }
          : undefined,
        waterQuality: wqData
          ? {
              status: wqData.status as "good" | "advisory" | "closure" | "unknown",
              latestSampleDate: wqData.latest_sample_date,
            }
          : undefined,
      },
    };
  }

  /**
   * Save intel to database
   */
  async saveIntel(
    beachId: string,
    intel: MorningIntelData,
    generationTime: string,
    timezone?: string | null
  ): Promise<void> {
    const tz = timezone || DEFAULT_TIMEZONE;
    const today = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");

    // Log timezone usage for debugging (safe for production - helps diagnose issues)
    console.log(`[IntelGenerationService] Saving intel for beach ${beachId}:`, {
      providedTimezone: timezone,
      effectiveTimezone: tz,
      computedForecastDate: today,
      generationTime,
      utcNow: new Date().toISOString(),
    });

    // Parse best window string (e.g., "06:00–08:30 on the drop" or "06:00-08:30")
    // Handle both regular dash (-) and em-dash (–)
    const windowMatch = intel.bestWindow.match(/(\d{2}:\d{2})[\-–](\d{2}:\d{2})/);
    let windowStart = windowMatch ? windowMatch[1] : null;
    let windowEnd = windowMatch ? windowMatch[2] : null;

    // Validate that start and end times are different
    // If they're identical, this indicates a bug in window generation
    if (windowStart && windowEnd && windowStart === windowEnd) {
      console.error(
        `Invalid surf window detected for beach ${beachId}: ${windowStart}-${windowEnd}. ` +
        `This indicates identical start/end times. Storing as description instead.`
      );
      // Set times to null and store the original message as description
      windowStart = null;
      windowEnd = null;
    }

    // Store original message in description field when times can't be parsed
    // This provides fallback text like "N/A" or "Variable conditions..."
    const windowDescription = !windowMatch || (windowStart === null && windowEnd === null) ? intel.bestWindow : null;

    // Determine wind quality from offshore boolean and description
    const windQuality = intel.wind.offshore
      ? "offshore"
      : intel.wind.description.toLowerCase().includes("onshore")
      ? "onshore"
      : "cross-shore";

    // Compute the same 0-100 condition score shown on web/native forecast views.
    let unifiedScore: number | null = null;
    if (intel.surf && intel.wind && intel.tide) {
      const waveHeight = (intel.surf.min + intel.surf.max) / 2;
      const wavePeriod = intel.swells.primary?.period ?? 0;
      unifiedScore = scoreNativeConditionInputs({
        waveHeightFt: waveHeight,
        windSpeedMph: intel.wind.speed,
        periodSec: wavePeriod,
        tideHeightFt: intel.tide.height,
        tideStatus: intel.tide.direction ?? null,
      });
    }

    const { error } = await this.supabase
      .from("beach_daily_intel")
      .upsert(
        {
          beach_id: beachId,
          forecast_date: today,
          generation_time: generationTime,
          generated_at: new Date().toISOString(),

          // Best window (parsed from string)
          best_window_start: windowStart,
          best_window_end: windowEnd,
          best_window_description: windowDescription,

          // Surf
          surf_min_ft: intel.surf.min,
          surf_max_ft: intel.surf.max,
          surf_description: intel.surf.dominant,

          // Tide - access extended fields from payload.tide which has the full type
          tide_height_ft: intel.tide.height,
          tide_time: intel.payload.tide.recommendedTime || null,
          tide_status: intel.tide.direction,
          tide_optimal_range: intel.payload.tide.optimalRange || null,
          next_tide_type: intel.tide.nextEvent?.type || null,
          next_tide_time: intel.tide.nextEvent?.time || null,
          next_tide_height_ft: intel.tide.nextEvent?.height || null,

          // Wind
          wind_speed_mph: intel.wind.speed,
          wind_direction_deg: intel.wind.direction,
          wind_direction_text: intel.wind.cardinal,
          wind_quality: windQuality,
          wind_description: intel.wind.description,

          // Swells
          primary_swell_height_ft: intel.swells.primary?.height || null,
          primary_swell_period_s: intel.swells.primary?.period || null,
          primary_swell_direction_deg: intel.swells.primary?.direction || null,
          primary_swell_direction_text: intel.swells.primary?.cardinal || null,

          secondary_swell_height_ft: intel.swells.secondary?.height || null,
          secondary_swell_period_s: intel.swells.secondary?.period || null,
          secondary_swell_direction_deg: intel.swells.secondary?.direction || null,
          secondary_swell_direction_text: intel.swells.secondary?.cardinal || null,

          // Analysis
          confidence: intel.confidence,
          recommendation: intel.notes,
          conditions_score: unifiedScore ?? intel.conditions?.score ?? null,

          // Full data - cast to Json type for JSONB column storage
          raw_intel_data: intel as unknown as Json,
        },
        {
          onConflict: "beach_id,forecast_date,generation_time",
          ignoreDuplicates: false,
        }
      );

    if (error) {
      throw new Error(`Failed to save intel: ${error.message}`);
    }
  }
}
