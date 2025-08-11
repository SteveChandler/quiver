"use client";

import { useCallback, useState } from "react";
import { HelpCircle, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import {
  createForecastSnapshot,
  // TODO: These functions are not currently exported
  // getBeachAccuracy,
  // getSessionForecastSnapshots,
} from "@/actions/forecast-calibration-actions";
import type {
  BeachForecastAccuracy,
  SessionForecastSnapshot,
  Session,
  Forecast,
} from "@/types/database";
import type { ForecastFeedback } from "@/components/forecast/forecast-feedback-form";

interface UseForecastCalibrationProps {
  sessionId?: string;
  beachId?: string;
}

export function useForecastCalibration({
  sessionId,
  beachId,
}: UseForecastCalibrationProps = {}) {
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Fetch beach accuracy data
  const fetchBeachAccuracy = useCallback(async () => {
    if (!beachId) return null;
    // TODO: Implement getBeachAccuracy when available
    return { success: false, error: "Not implemented", data: null };
  }, [beachId]);

  const {
    data: beachAccuracy,
    loading: accuracyLoading,
    error: accuracyError,
    refetch: refetchAccuracy,
  } = useDataFetcher(fetchBeachAccuracy);

  // Fetch session snapshots for comparison
  const fetchSessionSnapshots = useCallback(async () => {
    if (!beachId) return [];
    // TODO: Implement getSessionForecastSnapshots when available
    return { success: false, error: "Not implemented", data: [] };
  }, [beachId]);

  const {
    data: sessionSnapshots = [],
    loading: snapshotsLoading,
    error: snapshotsError,
    refetch: refetchSnapshots,
  } = useDataFetcher(fetchSessionSnapshots);

  // Submit forecast feedback
  const submitForecastFeedback = useCallback(
    async (
      session: Session,
      forecast: Forecast | null,
      feedback: ForecastFeedback
    ) => {
      if (!session.id) {
        throw new Error("Session ID is required");
      }

      setSubmittingFeedback(true);

      try {
        // Prepare forecast snapshot data
        const forecastSnapshot = forecast
          ? {
              wave_height: forecast.wave_height,
              wind_speed: forecast.wind_speed,
              wind_direction: forecast.wind_direction,
              water_temp: forecast.water_temp,
              air_temperature: forecast.air_temperature,
              confidence_score: forecast.confidence_score,
              data_source: forecast.data_source,
              forecast_time: forecast.valid_time,
              swell_1_height: forecast.swell_1_height,
              swell_1_period: forecast.swell_1_period,
              swell_1_direction: forecast.swell_1_direction,
              swell_2_height: forecast.swell_2_height,
              swell_2_period: forecast.swell_2_period,
              swell_2_direction: forecast.swell_2_direction,
            }
          : {};

        // Prepare actual conditions from feedback
        const actualConditions = {
          wave_height: feedback.waveHeight,
          wind_condition: feedback.windCondition,
          wind_speed: feedback.windSpeed,
          overall_accuracy: feedback.overallAccuracy,
          notes: feedback.notes,
          session_rating: session.rating,
          session_duration: session.duration_minutes,
          wave_quality: session.wave_quality,
          crowd_level: session.crowd_level,
          water_temp: session.water_temp,
        };

        // Create forecast snapshot
        const result = await createForecastSnapshot(
          session.id,
          forecastSnapshot,
          actualConditions
        );

        if (result.success) {
          toast.success(
            "Forecast feedback submitted! Thank you for helping improve forecasts."
          );

          // Refetch data to show updated accuracy
          refetchAccuracy();
          refetchSnapshots();

          return result.data;
        } else {
          throw new Error(result.message || "Failed to submit feedback");
        }
      } catch (error) {
        console.error("Error submitting forecast feedback:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to submit forecast feedback";
        toast.error(errorMessage);
        throw error;
      } finally {
        setSubmittingFeedback(false);
      }
    },
    [refetchAccuracy, refetchSnapshots]
  );

  // Check if feedback has already been submitted for a session
  const hasFeedbackForSession = useCallback(
    (sessionId: string) => {
      return sessionSnapshots.some(
        (snapshot) => snapshot.session_id === sessionId
      );
    },
    [sessionSnapshots]
  );

  // Get accuracy statistics
  const getAccuracyStats = useCallback(() => {
    if (!beachAccuracy) return null;

    return {
      overallScore: beachAccuracy.overall_accuracy_score,
      waveHeightDelta: beachAccuracy.avg_wave_height_delta,
      windSpeedDelta: beachAccuracy.avg_wind_speed_delta,
      totalSessions: beachAccuracy.total_sessions_count,
      last30Days: beachAccuracy.last_30_days_count,
      last7Days: beachAccuracy.last_7_days_count,
      lastUpdated: beachAccuracy.updated_at,
    };
  }, [beachAccuracy]);

  // Get confidence level based on accuracy score
  const getConfidenceLevel = useCallback((score?: number | null) => {
    if (!score) {
      return {
        level: "unknown",
        color: "text-gray-600",
        bg: "bg-gray-50 border border-gray-200",
        icon: HelpCircle,
      } as const;
    }

    if (score >= 85) {
      return {
        level: "high",
        color: "text-green-600",
        bg: "bg-green-50 border border-green-200",
        icon: CheckCircle,
      } as const;
    } else if (score >= 70) {
      return {
        level: "medium",
        color: "text-yellow-600",
        bg: "bg-yellow-50 border border-yellow-200",
        icon: AlertTriangle,
      } as const;
    } else {
      return {
        level: "low",
        color: "text-red-600",
        bg: "bg-red-50 border border-red-200",
        icon: XCircle,
      } as const;
    }
  }, []);

  return {
    // Data
    beachAccuracy,
    sessionSnapshots,
    accuracyStats: getAccuracyStats(),

    // Loading states
    accuracyLoading,
    snapshotsLoading,
    submittingFeedback,
    loading: accuracyLoading || snapshotsLoading,

    // Error states
    accuracyError,
    snapshotsError,
    error: accuracyError || snapshotsError,

    // Actions
    submitForecastFeedback,
    refetchAccuracy,
    refetchSnapshots,

    // Utilities
    hasFeedbackForSession,
    getConfidenceLevel,
  };
}
