import { NextRequest } from "next/server";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const supabase = createAPIServerClient();
    const url = new URL(request.url);
    const beachId = url.searchParams.get("beachId");
    const hours = Number(url.searchParams.get("hours") || 48);
    const limit = Number(url.searchParams.get("limit") || 6);

    if (!beachId) {
      return createSuccessResponse({ windows: [] });
    }

    const startIso = new Date().toISOString();
    const endIso = new Date(Date.now() + hours * 3600 * 1000).toISOString();

    // Try MV first
    const mv = await supabase
      .from("mv_best_times")
      .select("start_ts,end_ts,grade,score")
      .eq("beach_id", beachId)
      .gte("start_ts", startIso)
      .lte("end_ts", endIso)
      .order("score", { ascending: false })
      .order("start_ts", { ascending: true })
      .limit(limit);

    let rows = mv.data || [];

    if (!rows.length) {
      // Fallback to RPC
      const rpc = await supabase.rpc("get_best_times", {
        p_beach: beachId,
        p_start: startIso,
        p_end: endIso,
        p_limit: limit,
      });
      if (rpc.error) throw rpc.error;
      rows = (rpc.data || []).map((r: any) => ({
        start_ts: r.start_ts,
        end_ts: r.end_ts,
        grade: (r.label || "").split(" ")[0] || "",
        score: r.score,
      }));
    }

    const response = createSuccessResponse({ windows: rows });
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=600, stale-while-revalidate=300"
    );
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
