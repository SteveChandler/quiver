import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import {
  fetchOpenMeteoMarine,
  fetchOpenMeteoTides,
  fetchOpenMeteoSun,
  mapMarineResponse,
  mapTideResponse,
  mapSunResponse,
} from "@/lib/services/open-meteo-service";

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const supabase = createAPIServerClient();

    const { data: beaches, error: beachError } = await supabase
      .from("beaches")
      .select("id, name, latitude, longitude")
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (beachError) throw beachError;

    let totals = { marine: 0, tides: 0, sun: 0, beaches: beaches?.length || 0 };

    for (const b of beaches || []) {
      const [marineJson, tideJson, sunJson] = await Promise.allSettled([
        fetchOpenMeteoMarine(b.latitude, b.longitude),
        fetchOpenMeteoTides(b.latitude, b.longitude),
        fetchOpenMeteoSun(b.latitude, b.longitude),
      ]);

      if (marineJson.status === "fulfilled") {
        const rows = mapMarineResponse(marineJson.value).map((r) => ({
          ...r,
          beach_id: b.id,
        }));
        if (rows.length) {
          const { error } = await supabase
            .from("marine_forecasts")
            .upsert(rows, { onConflict: "beach_id,ts,source" });
          if (!error) totals.marine += rows.length;
        }
      }

      if (tideJson.status === "fulfilled") {
        const rows = mapTideResponse(tideJson.value).map((r) => ({
          ...r,
          beach_id: b.id,
        }));
        if (rows.length) {
          const { error } = await supabase
            .from("tide_forecasts")
            .upsert(rows, { onConflict: "beach_id,ts,source" });
          if (!error) totals.tides += rows.length;
        }
      }

      if (sunJson.status === "fulfilled") {
        const rows = mapSunResponse(sunJson.value).map((r) => ({
          ...r,
          beach_id: b.id,
        }));
        if (rows.length) {
          const { error } = await supabase
            .from("sun_times")
            .upsert(rows, { onConflict: "beach_id,date,source" });
          if (!error) totals.sun += rows.length;
        }
      }
    }

    return createSuccessResponse({ totals });
  } catch (error) {
    return handleApiError(error);
  }
}
