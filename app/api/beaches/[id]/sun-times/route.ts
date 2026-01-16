import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLocalDateString, DEFAULT_TIMEZONE } from "@/lib/utils/timezone-utils";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: beachId } = await params;
  const { searchParams } = new URL(request.url);

  // Get date from query params or default to today
  const date = searchParams.get("date") || getLocalDateString(new Date(), DEFAULT_TIMEZONE);

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("sun_times")
      .select("sunrise_utc, sunset_utc")
      .eq("beach_id", beachId)
      .eq("date", date)
      .single();

    if (error) {
      // Return null values if no data found (not an error condition)
      return NextResponse.json({ sunrise_utc: null, sunset_utc: null });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[sun-times] Error fetching sun times:", err);
    return NextResponse.json(
      { sunrise_utc: null, sunset_utc: null },
      { status: 500 }
    );
  }
}
