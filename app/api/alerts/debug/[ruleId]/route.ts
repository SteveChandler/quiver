import type { NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  createErrorResponse,
  validateUuidParam,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { evaluateConditions } from "@/lib/alerts/condition-evaluator";
import { filterToDaylight } from "@/lib/alerts/sunrise";
import { resolveWindDirection } from "@/lib/alerts/degree-utils";
import { getUtcDayBounds } from "@/lib/alerts/timezone-utils";
import type { AlertConditions, BeachAlertMeta, ForecastHour } from "@/lib/alerts/types";

export const GET = withAuth(
  async (_request: NextRequest, { user, supabase, params }: AuthenticatedContext) => {
    const uuidResult = validateUuidParam(params.ruleId, "ruleId");
    if ("error" in uuidResult) return uuidResult.error;
    const ruleId = uuidResult.value;

    // Use explicit column list to avoid TS type-depth issues with select("*")
    const { data: rule, error } = await (supabase as any)
      .from("alert_rules")
      .select(`
        id, user_id, beach_id, name, conditions,
        beaches!inner(id, name, slug, lat, lon, timezone, wind_offshore_deg, wind_offshore_tol_deg, aspect_deg,
          preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
          swell_window_center_deg, swell_window_halfwidth_deg)
      `)
      .eq("id", ruleId)
      .eq("user_id", user.id)
      .single();

    if (error || !rule) return createErrorResponse("Rule not found", 404);

    const beach = rule.beaches as BeachAlertMeta;
    const conditions = rule.conditions as AlertConditions;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: beach.timezone });
    const { start: todayStart, end: todayEnd } = getUtcDayBounds(today, beach.timezone);

    const { data: forecasts } = await supabase
      .from("enhanced_forecasts")
      .select(
        "forecast_at, wave_height, wave_period, swell_1_height, swell_1_period, swell_1_direction, wind_speed, wind_direction_deg, tide_height, tide_status"
      )
      .eq("beach_id", rule.beach_id)
      .gte("forecast_at", todayStart)
      .lt("forecast_at", todayEnd)
      .order("forecast_at", { ascending: true });

    if (!forecasts || forecasts.length === 0) {
      return createSuccessResponse({ rule_id: ruleId, reason: "no_forecast_data", checks: [] });
    }

    const parsed: ForecastHour[] = forecasts.map((f) => ({
      forecast_at: f.forecast_at,
      wave_height: f.wave_height ? parseFloat(f.wave_height) : null,
      wave_period: f.wave_period ? parseFloat(f.wave_period.replace("s", "")) : null,
      swell_1_height: f.swell_1_height ? parseFloat(f.swell_1_height) : null,
      swell_1_period: f.swell_1_period ? parseFloat(f.swell_1_period.replace("s", "")) : null,
      swell_1_direction: f.swell_1_direction ? parseFloat(String(f.swell_1_direction)) : null,
      wind_speed: f.wind_speed ? parseFloat(f.wind_speed) : null,
      wind_direction_deg: f.wind_direction_deg,
      tide_height: f.tide_height ? parseFloat(f.tide_height) : null,
      tide_status: f.tide_status,
    }));

    const daylight = filterToDaylight(parsed, beach.lat, beach.lon);
    const midday = daylight[Math.floor(daylight.length / 2)] ?? parsed[0];

    const checks: Array<{
      condition: string;
      rule_value: string;
      actual_value: string;
      passed: boolean;
    }> = [];

    if (conditions.swell_height_min != null) {
      checks.push({
        condition: "Swell height (min)",
        rule_value: `≥ ${conditions.swell_height_min}ft`,
        actual_value: midday.wave_height != null ? `${midday.wave_height}ft` : "N/A",
        passed: midday.wave_height != null && midday.wave_height >= conditions.swell_height_min,
      });
    }

    if (conditions.swell_height_max != null) {
      checks.push({
        condition: "Swell height (max)",
        rule_value: `≤ ${conditions.swell_height_max}ft`,
        actual_value: midday.wave_height != null ? `${midday.wave_height}ft` : "N/A",
        passed: midday.wave_height != null && midday.wave_height <= conditions.swell_height_max,
      });
    }

    if (conditions.swell_period_min != null) {
      const period = midday.swell_1_period ?? midday.wave_period;
      checks.push({
        condition: "Swell period",
        rule_value: `≥ ${conditions.swell_period_min}s`,
        actual_value: period != null ? `${period}s` : "N/A",
        passed: period != null && period >= conditions.swell_period_min,
      });
    }

    if (conditions.wind_speed_max_kt != null) {
      checks.push({
        condition: "Wind speed",
        rule_value: `≤ ${conditions.wind_speed_max_kt}kt`,
        actual_value: midday.wind_speed != null ? `${midday.wind_speed}kt` : "N/A",
        passed: midday.wind_speed != null && midday.wind_speed <= conditions.wind_speed_max_kt,
      });
    }

    if (conditions.wind_direction != null) {
      const resolved =
        midday.wind_direction_deg != null
          ? resolveWindDirection(
              midday.wind_direction_deg,
              beach.wind_offshore_deg,
              beach.wind_offshore_tol_deg,
              beach.aspect_deg
            )
          : null;
      checks.push({
        condition: "Wind direction",
        rule_value: conditions.wind_direction,
        actual_value: resolved ?? "N/A",
        passed: resolved === conditions.wind_direction,
      });
    }

    if (conditions.tide_height_min_ft != null || conditions.tide_height_max_ft != null) {
      checks.push({
        condition: "Tide height",
        rule_value: `${conditions.tide_height_min_ft ?? "any"} – ${conditions.tide_height_max_ft ?? "any"}ft`,
        actual_value: midday.tide_height != null ? `${midday.tide_height}ft` : "N/A",
        passed:
          midday.tide_height != null &&
          (conditions.tide_height_min_ft == null ||
            midday.tide_height >= conditions.tide_height_min_ft) &&
          (conditions.tide_height_max_ft == null ||
            midday.tide_height <= conditions.tide_height_max_ft),
      });
    }

    if (conditions.tide_direction != null) {
      checks.push({
        condition: "Tide direction",
        rule_value: conditions.tide_direction,
        actual_value: midday.tide_status ?? "N/A",
        passed: midday.tide_status === conditions.tide_direction,
      });
    }

    const anyHourMatches = daylight.some((f) => evaluateConditions(conditions, f, beach));

    return createSuccessResponse({
      rule_id: ruleId,
      date: today,
      daylight_hours: daylight.length,
      any_hour_matches: anyHourMatches,
      sample_hour: midday.forecast_at,
      checks,
    });
  },
  { errorMessage: "Failed to debug alert rule" }
);
