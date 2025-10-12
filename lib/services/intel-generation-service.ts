/**
 * Intel Generation Service
 * Reusable service for generating beach surf intelligence
 * Used by both scheduled workflow and on-demand generation
 */

import { createClient } from "@supabase/supabase-js";
import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { Database } from "@/types/database";
import type { BeachPreferences, ForecastSlice, MorningIntelData } from "@/types/morning-intel";
import {
  deriveSurfRange,
  recommendTideWindow,
  primarySecondarySwell,
  windAt,
  bestWindowHeuristic,
  confidenceHeuristic,
  analyzeConditions,
} from "@/lib/utils/morning-intel-utils";

const TIMEZONE = "America/Los_Angeles";

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
      .select("tide_min_ft, tide_max_ft")
      .eq("id", beachId)
      .single();

    if (error || !beach) return false;

    return !!(
      beach.tide_min_ft !== null &&
      beach.tide_max_ft !== null
    );
  }

  /**
   * Generate intel for a specific beach
   */
  async generateIntel(beachId: string, targetTime: string = "06:00"): Promise<MorningIntelData> {
    // 1. Fetch beach preferences
    const beachPrefs = await this.fetchBeachPreferences(beachId);
    
    // 2. Fetch forecast data
    const forecasts = await this.fetchForecasts(beachId);
    
    // 3. Analyze conditions
    const intel = this.analyzeForecasts(forecasts, beachPrefs, targetTime);
    
    return intel;
  }

  /**
   * Fetch beach preferences
   */
  private async fetchBeachPreferences(beachId: string): Promise<BeachPreferences | null> {
    const { data: beach, error } = await this.supabase
      .from("beaches")
      .select(
        "name, swell_window_min_deg, swell_window_max_deg, wind_offshore_deg, wind_offshore_tol_deg, tide_min_ft, tide_max_ft, hazards, skill_level, break_type"
      )
      .eq("id", beachId)
      .single();

    if (error || !beach) return null;

    return {
      name: beach.name,
      swellWindowMin: beach.swell_window_min_deg,
      swellWindowMax: beach.swell_window_max_deg,
      windOffshoreDeg: beach.wind_offshore_deg,
      windOffshoreTol: beach.wind_offshore_tol_deg,
      tideMinFt: beach.tide_min_ft,
      tideMaxFt: beach.tide_max_ft,
      hazards: beach.hazards,
      skillLevel: beach.skill_level,
      breakType: beach.break_type,
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
  private async fetchForecasts(beachId: string): Promise<ForecastSlice> {
    const now = new Date();
    const today = formatInTimeZone(now, TIMEZONE, "yyyy-MM-dd");
    const tomorrow = formatInTimeZone(addDays(now, 1), TIMEZONE, "yyyy-MM-dd");

    const { data: forecasts, error } = await this.supabase
      .from("enhanced_forecasts")
      .select(
        "forecast_date, forecast_time, wave_height, wave_period, wave_direction, wind_speed, wind_direction, tide_height, tide_status, next_tide_time, next_tide_type, next_tide_height, swell_1_height, swell_1_period, swell_1_direction, swell_2_height, swell_2_period, swell_2_direction, confidence_score"
      )
      .eq("beach_id", beachId)
      .in("forecast_date", [today, tomorrow])
      .gte("forecast_time", "04:00:00")
      .lte("forecast_time", "12:00:00")
      .order("forecast_date", { ascending: true })
      .order("forecast_time", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch forecasts: ${error.message}`);
    }

    // Parse text values to numbers
    const parsedForecasts = (forecasts || []).map((f: any) => ({
      ...f,
      wave_height: this.parseNumericValue(f.wave_height),
      wave_period: this.parseNumericValue(f.wave_period),
      wave_direction: this.parseDirection(f.wave_direction),
      swell_1_height: this.parseNumericValue(f.swell_1_height),
      swell_1_period: this.parseNumericValue(f.swell_1_period),
      swell_1_direction: this.parseDirection(f.swell_1_direction),
      swell_2_height: this.parseNumericValue(f.swell_2_height),
      swell_2_period: this.parseNumericValue(f.swell_2_period),
      swell_2_direction: this.parseDirection(f.swell_2_direction),
      wind_speed: this.parseNumericValue(f.wind_speed),
      wind_direction: this.parseDirection(f.wind_direction),
      tide_height: this.parseNumericValue(f.tide_height),
      tide_status: f.tide_status,
      next_tide_time: f.next_tide_time,
      next_tide_type: f.next_tide_type,
      next_tide_height: f.next_tide_height,
    }));

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
    targetTime: string
  ): MorningIntelData {
    const now = new Date();
    const date = formatInTimeZone(now, TIMEZONE, "yyyy-MM-dd");

    // Calculate metrics
    const surf = deriveSurfRange(slice.forecasts);
    const tide = recommendTideWindow(slice.forecasts, beachPrefs);
    const swells = primarySecondarySwell(slice.forecasts);
    const wind = windAt(targetTime, slice.forecasts, TIMEZONE);
    const bestWindow = bestWindowHeuristic(slice.forecasts, slice.tides, TIMEZONE);
    const confidence = confidenceHeuristic(slice.forecasts, slice.tides);

    // Analyze conditions
    let conditions = undefined;
    if (beachPrefs) {
      conditions = analyzeConditions(
        {
          surf,
          tide,
          swells,
          wind,
          bestWindow,
          confidence,
        },
        beachPrefs
      );
    }

    // Generate notes
    let notes = "";
    if (wind.quality === "offshore") {
      notes = `${wind.quality.charAt(0).toUpperCase() + wind.quality.slice(1)} winds create clean, organized waves.`;
    } else if (wind.quality === "onshore") {
      notes = `${wind.quality.charAt(0).toUpperCase() + wind.quality.slice(1)} winds may create choppy conditions.`;
    }

    if (bestWindow.start && bestWindow.end) {
      notes += ` Best window: ${bestWindow.start}-${bestWindow.end}.`;
    }

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
        generatedAt: new Date().toISOString(),
        dataCompleteness: slice.forecasts.length > 0 ? 0.8 : 0,
        sources: {
          wave: slice.forecasts.some((f) => f.wave_height !== null),
          tide: slice.forecasts.some((f) => f.tide_height !== null),
          wind: slice.forecasts.some((f) => f.wind_speed !== null),
          swell: slice.forecasts.some((f) => f.swell_1_height !== null),
        },
      },
    };
  }

  /**
   * Save intel to database
   */
  async saveIntel(
    beachId: string,
    intel: MorningIntelData,
    generationTime: string
  ): Promise<void> {
    const today = new Date().toISOString().split("T")[0];

    // Parse best window string (e.g., "06:00–08:30 on the drop" or "06:00-08:30")
    // Handle both regular dash (-) and em-dash (–)
    const windowMatch = intel.bestWindow.match(/(\d{2}:\d{2})[\-–](\d{2}:\d{2})/);
    const windowStart = windowMatch ? windowMatch[1] : null;
    const windowEnd = windowMatch ? windowMatch[2] : null;
    
    // Store original message in description field when times can't be parsed
    // This provides fallback text like "N/A" or "Variable conditions..."
    const windowDescription = !windowMatch ? intel.bestWindow : null;

    // Determine wind quality from offshore boolean and description
    const windQuality = intel.wind.offshore
      ? "offshore"
      : intel.wind.description.toLowerCase().includes("onshore")
      ? "onshore"
      : "cross-shore";

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

          // Tide
          tide_height_ft: intel.tide.height,
          tide_time: (intel.tide as any).recommendedTime || null,
          tide_status: intel.tide.direction,
          tide_optimal_range: (intel.tide as any).optimalRange || null,
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
          conditions_score: intel.conditions?.score || null,

          // Full data
          raw_intel_data: intel as any,
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

