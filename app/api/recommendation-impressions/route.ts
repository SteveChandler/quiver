import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/api-wrappers";
import {
  RecommendationImpressionsRequestSchema,
  toRecommendationImpressionEventRow,
  toRecommendationImpressionRow,
} from "@/lib/recommendations/impressions";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (
  request: NextRequest,
  { user, supabase }
) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = RecommendationImpressionsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid recommendation impression payload" },
      { status: 400 }
    );
  }

  const rows = parsed.data.impressions.map((impression) =>
    toRecommendationImpressionRow(user.id, impression)
  );
  const untypedSupabase = supabase as unknown as {
    from: (table: string) => {
      upsert?: (
        payload: Record<string, unknown>[],
        options: Record<string, unknown>
      ) => {
        select: (
          columns: string
        ) => Promise<{
          data: Array<{ impression_key: string }> | null;
          error: { message: string } | null;
        }>;
      };
      insert?: (
        payload: Record<string, unknown>[]
      ) => Promise<{ error: { message: string } | null }>;
    };
  };

  const impressionResult = await untypedSupabase
    .from("recommendation_impressions")
    .upsert!(rows, {
      onConflict: "impression_key",
      ignoreDuplicates: true,
    })
    .select("impression_key");

  if (impressionResult.error) {
    return NextResponse.json(
      { success: false, error: impressionResult.error.message },
      { status: 500 }
    );
  }

  const insertedKeys = new Set(
    (impressionResult.data ?? []).map((row) => row.impression_key)
  );
  const eventRows = parsed.data.impressions
    .map((impression) => toRecommendationImpressionEventRow(user.id, impression))
    .filter((row) => {
      const impressionKey = (row.metadata as { impression_key?: string })
        .impression_key;
      return impressionKey ? insertedKeys.has(impressionKey) : false;
    });

  if (eventRows.length === 0) {
    return NextResponse.json({ success: true });
  }

  const eventResult = await untypedSupabase
    .from("user_events")
    .insert!(eventRows);

  if (eventResult.error) {
    return NextResponse.json(
      { success: false, error: eventResult.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
});
