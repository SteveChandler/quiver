/**
 * Forecast Weighting Service
 *
 * Silently blends multiple data sources (NOAA, CDIP, expert predictions)
 * to improve forecast accuracy without exposing individual sources.
 *
 * This service uses expert predictions to calibrate and weight automated
 * model forecasts, improving accuracy for SoCal beaches.
 */

import { createClient } from '@supabase/supabase-js';
import { WaveCastReport, WaveCastParsedData } from '@/types/wavecast';

interface ForecastData {
  wave_height_ft: number;
  wave_period_s: number;
  wave_direction_deg: number;
  wind_speed_mph?: number;
  wind_direction_deg?: number;
  confidence: number;
}

interface WeightedForecast {
  wave_height_ft: number;
  wave_period_s: number;
  wave_direction_deg: number;
  wind_speed_mph?: number;
  wind_direction_deg?: number;
  confidence: number;
  blend_ratio?: {
    automated: number;
    expert: number;
  };
}

interface ExpertCalibration {
  heightAdjustment: number; // Multiplier (0.9 = reduce by 10%, 1.1 = increase by 10%)
  periodAdjustment: number;
  confidenceBoost: number; // 0-1 boost to overall confidence
}

export class ForecastWeightingService {
  private readonly supabase;
  private readonly cacheTimeout = 60 * 60 * 1000; // 1 hour
  private latestExpertReport: WaveCastReport | null = null;
  private lastFetchTime = 0;
  // Track if the wavecast_reports table is unavailable (406 = table doesn't exist)
  private tableUnavailable = false;
  private tableCheckTime = 0;
  private readonly tableCheckInterval = 24 * 60 * 60 * 1000; // Retry once per day

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  /**
   * Blend automated forecast with expert predictions
   * Returns weighted forecast without exposing sources
   */
  async blendForecast(
    automatedForecast: ForecastData,
    beachName: string,
    forecastDate: Date
  ): Promise<WeightedForecast> {
    // Get expert calibration for this date
    const calibration = await this.getExpertCalibration(forecastDate);

    if (!calibration) {
      // No expert data available, return automated forecast as-is
      return {
        ...automatedForecast,
        blend_ratio: {
          automated: 1.0,
          expert: 0.0,
        },
      };
    }

    // Apply expert calibration to automated forecast
    const blendedForecast = this.applyCalibration(automatedForecast, calibration);

    // Calculate blend ratio based on expert confidence
    const expertWeight = this.calculateExpertWeight(calibration.confidenceBoost);

    return {
      ...blendedForecast,
      blend_ratio: {
        automated: 1 - expertWeight,
        expert: expertWeight,
      },
    };
  }

  /**
   * Get expert calibration data for a specific date
   * Extracts relevant adjustments from expert reports without exposing source
   */
  private async getExpertCalibration(date: Date): Promise<ExpertCalibration | null> {
    const expertReport = await this.getExpertReportForDate(date);

    if (!expertReport || !expertReport.parsed_data) {
      return null;
    }

    const parsedData = expertReport.parsed_data as WaveCastParsedData;

    // Extract calibration factors from expert data
    return this.extractCalibrationFactors(parsedData, expertReport.parsing_confidence);
  }

  /**
   * Extract calibration factors from expert predictions
   * This is where the "magic" happens - converting expert insights into numeric adjustments
   */
  private extractCalibrationFactors(
    parsedData: WaveCastParsedData,
    parsingConfidence: number
  ): ExpertCalibration {
    let heightAdjustment = 1.0;
    let periodAdjustment = 1.0;
    let confidenceBoost = 0.0;

    // Analyze swell quality and conditions
    const hasGroundSwell = parsedData.swells?.some((s) => s.type === 'ground_swell');
    const hasMultipleSwells = parsedData.swells?.length > 1;

    // Ground swell typically means better, more consistent waves
    if (hasGroundSwell) {
      heightAdjustment *= 1.05; // Slight height boost
      periodAdjustment *= 1.1; // Better period
      confidenceBoost += 0.1;
    }

    // Multiple swells can create confusion or reinforcement
    if (hasMultipleSwells && parsedData.swells.length > 2) {
      heightAdjustment *= 1.08; // Multiple swells often create larger sets
      confidenceBoost += 0.05;
    }

    // Weather conditions impact
    if (parsedData.weather?.wind_pattern === 'offshore') {
      heightAdjustment *= 1.03; // Offshore winds hold up waves
      confidenceBoost += 0.15; // Very predictable condition
    } else if (parsedData.weather?.wind_pattern === 'onshore') {
      heightAdjustment *= 0.95; // Onshore winds reduce quality
      confidenceBoost += 0.05; // Predictable but negative
    } else if (parsedData.weather?.wind_pattern === 'Santa Ana winds') {
      heightAdjustment *= 1.05; // Santa Anas = offshore
      confidenceBoost += 0.2; // Highly predictable premium conditions
    }

    // Expert confidence matters
    const expertConfidence = parsedData.confidence === 'high' ? 1.0 :
                            parsedData.confidence === 'medium' ? 0.7 : 0.4;

    // Parsing confidence also matters
    confidenceBoost *= Math.min(parsingConfidence, 1.0) * expertConfidence;

    // Cap adjustments to reasonable ranges
    heightAdjustment = Math.max(0.8, Math.min(1.2, heightAdjustment));
    periodAdjustment = Math.max(0.9, Math.min(1.1, periodAdjustment));
    confidenceBoost = Math.max(0, Math.min(0.3, confidenceBoost));

    return {
      heightAdjustment,
      periodAdjustment,
      confidenceBoost,
    };
  }

  /**
   * Apply calibration adjustments to automated forecast
   */
  private applyCalibration(
    forecast: ForecastData,
    calibration: ExpertCalibration
  ): WeightedForecast {
    return {
      wave_height_ft: forecast.wave_height_ft * calibration.heightAdjustment,
      wave_period_s: forecast.wave_period_s * calibration.periodAdjustment,
      wave_direction_deg: forecast.wave_direction_deg,
      wind_speed_mph: forecast.wind_speed_mph,
      wind_direction_deg: forecast.wind_direction_deg,
      confidence: Math.min(1.0, forecast.confidence + calibration.confidenceBoost),
    };
  }

  /**
   * Calculate expert weight based on confidence boost
   * Higher confidence = more weight on expert adjustments
   */
  private calculateExpertWeight(confidenceBoost: number): number {
    // Expert weight ranges from 0.2 to 0.4 (never dominate automated models)
    // This ensures expert insights enhance but don't override automated forecasts
    return 0.2 + (confidenceBoost * 0.67); // 0.67 scales 0-0.3 boost to 0-0.2 weight
  }

  /**
   * Get expert report for a specific date (with caching)
   */
  private async getExpertReportForDate(date: Date): Promise<WaveCastReport | null> {
    const dateStr = date.toISOString().split('T')[0];
    const now = Date.now();

    // Skip if table is known to be unavailable (check once per day)
    if (this.tableUnavailable && now - this.tableCheckTime < this.tableCheckInterval) {
      return null;
    }

    // Check cache
    if (
      this.latestExpertReport &&
      this.latestExpertReport.report_date === dateStr &&
      now - this.lastFetchTime < this.cacheTimeout
    ) {
      return this.latestExpertReport;
    }

    try {
      // Try exact date match first
      const { data: exactMatch, error: exactError } = await this.supabase
        .from('wavecast_reports')
        .select('*')
        .eq('report_date', dateStr)
        .maybeSingle();

      // Check for 406 (table doesn't exist) - mark as unavailable
      if (exactError && (exactError as any).code === '42P01') {
        console.warn('⚠️ wavecast_reports table does not exist, skipping expert data');
        this.tableUnavailable = true;
        this.tableCheckTime = now;
        return null;
      }

      if (!exactError && exactMatch) {
        this.tableUnavailable = false; // Table exists
        this.latestExpertReport = exactMatch as WaveCastReport;
        this.lastFetchTime = now;
        return this.latestExpertReport;
      }

      // If no exact match, get most recent report (within last 3 days)
      const threeDaysAgo = new Date(date);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const { data: recentReport, error: recentError } = await this.supabase
        .from('wavecast_reports')
        .select('*')
        .gte('report_date', threeDaysAgo.toISOString().split('T')[0])
        .lte('report_date', dateStr)
        .order('report_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!recentError && recentReport) {
        this.latestExpertReport = recentReport as WaveCastReport;
        this.lastFetchTime = now;
        return this.latestExpertReport;
      }

      return null;
    } catch (error) {
      // Handle HTTP 406 (Not Acceptable) - table doesn't exist
      const errorMessage = String(error);
      if (errorMessage.includes('406') || errorMessage.includes('relation') || errorMessage.includes('does not exist')) {
        console.warn('⚠️ wavecast_reports table unavailable, skipping expert data for 24h');
        this.tableUnavailable = true;
        this.tableCheckTime = now;
      } else {
        console.error('Error fetching expert report:', error);
      }
      return null;
    }
  }

  /**
   * Batch blend multiple forecasts
   */
  async blendMultipleForecasts(
    forecasts: Array<{ forecast: ForecastData; beachName: string; date: Date }>
  ): Promise<WeightedForecast[]> {
    const promises = forecasts.map(({ forecast, beachName, date }) =>
      this.blendForecast(forecast, beachName, date)
    );

    return Promise.all(promises);
  }

  /**
   * Get statistics about expert data availability
   */
  async getExpertDataStats(): Promise<{
    hasRecentData: boolean;
    latestReportDate: string | null;
    reportsLast7Days: number;
  }> {
    // Skip if table is known to be unavailable
    if (this.tableUnavailable && Date.now() - this.tableCheckTime < this.tableCheckInterval) {
      return {
        hasRecentData: false,
        latestReportDate: null,
        reportsLast7Days: 0,
      };
    }

    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentReports, error } = await this.supabase
        .from('wavecast_reports')
        .select('report_date')
        .gte('report_date', sevenDaysAgo.toISOString().split('T')[0])
        .order('report_date', { ascending: false });

      if (error) {
        // Check for table not existing
        if ((error as any).code === '42P01') {
          this.tableUnavailable = true;
          this.tableCheckTime = Date.now();
        }
        throw error;
      }

      return {
        hasRecentData: (recentReports?.length || 0) > 0,
        latestReportDate: recentReports?.[0]?.report_date || null,
        reportsLast7Days: recentReports?.length || 0,
      };
    } catch (error) {
      // Silently handle table not existing
      const errorMessage = String(error);
      if (!errorMessage.includes('406') && !errorMessage.includes('does not exist')) {
        console.error('Error fetching expert data stats:', error);
      }
      return {
        hasRecentData: false,
        latestReportDate: null,
        reportsLast7Days: 0,
      };
    }
  }
}

/**
 * Singleton instance
 */
let forecastWeightingServiceInstance: ForecastWeightingService | null = null;

export function getForecastWeightingService(): ForecastWeightingService {
  if (!forecastWeightingServiceInstance) {
    forecastWeightingServiceInstance = new ForecastWeightingService();
  }
  return forecastWeightingServiceInstance;
}
