import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const beachId = url.searchParams.get("beachId");
    const startIso = url.searchParams.get("start");
    const endIso = url.searchParams.get("end");

    if (!beachId || !startIso || !endIso) {
      return handleApiError(
        new Error("Missing beachId/start/end"),
        "Missing parameters"
      );
    }

    const supabase = createAPIServerClient();

    const [marine, tides, sun] = await Promise.all([
      supabase
        .from("marine_forecasts")
        .select(
          "ts,wave_height_m,wave_period_s,wave_direction_deg,wind_speed_ms,wind_direction_deg,source,is_observed"
        )
        .eq("beach_id", beachId)
        .gte("ts", startIso)
        .lte("ts", endIso)
        .order("ts", { ascending: true }),
      supabase
        .from("tide_forecasts")
        .select("ts,tide_height_m,tide_phase,source")
        .eq("beach_id", beachId)
        .gte("ts", startIso)
        .lte("ts", endIso)
        .order("ts", { ascending: true }),
      supabase
        .from("sun_times")
        .select("date,sunrise_utc,sunset_utc,source")
        .eq("beach_id", beachId)
        .gte("date", startIso.split("T")[0])
        .lte("date", endIso.split("T")[0])
        .order("date", { ascending: true }),
    ]);

    const data = {
      marine: marine.data || [],
      tides: tides.data || [],
      sun: sun.data || [],
    };

    return createSuccessResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}
