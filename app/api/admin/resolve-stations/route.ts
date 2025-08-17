import { NextRequest } from "next/server";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { CDIPService } from "@/lib/services/cdip-service";
import { getNearestNDBCStation } from "@/lib/services/ndbc-service";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const beachId = url.searchParams.get("beachId");
    if (!beachId) return createSuccessResponse({ error: "Missing beachId" });

    const supabase = createAPIServerClient();
    const { data: beach, error } = await supabase
      .from("beaches")
      .select("id,name,latitude,longitude,cdip_station,ndbc_station")
      .eq("id", beachId)
      .maybeSingle();
    if (error || !beach) throw error || new Error("Beach not found");

    const cdipService = new CDIPService();
    const cdipResolved =
      beach.cdip_station ||
      (await cdipService.getNearestStation(
        beach.latitude,
        beach.longitude,
        50
      ));

    const ndbcResolved =
      beach.ndbc_station ||
      (await getNearestNDBCStation(beach.latitude, beach.longitude))?.id ||
      null;

    return createSuccessResponse({
      beachId,
      beachName: beach.name,
      cdipStation: cdipResolved,
      ndbcStation: ndbcResolved,
      usedOverrides: {
        cdip: Boolean(beach.cdip_station),
        ndbc: Boolean(beach.ndbc_station),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
