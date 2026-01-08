import { NextRequest } from "next/server";
import { z } from "zod";
import {
  createSuccessResponse,
  createValidationError,
  handleApiError,
} from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  beachId: z.string().uuid("beachId must be a valid UUID"),
  forecastDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "forecastDate must be YYYY-MM-DD"),
});

/**
 * GET /api/beach-daily-intel?beachId=<uuid>&forecastDate=YYYY-MM-DD
 *
 * Returns the latest `beach_daily_intel` record (or null) for a beach and local-date.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const parsed = QuerySchema.safeParse({
      beachId: searchParams.get("beachId"),
      forecastDate: searchParams.get("forecastDate"),
    });

    if (!parsed.success) {
      return createValidationError("Invalid query parameters", parsed.error.issues);
    }

    const { beachId, forecastDate } = parsed.data;

    // Dev-only logging to debug timezone issues
    if (process.env.NODE_ENV === 'development') {
      console.log(`[beach-daily-intel API] Querying intel:`, {
        beachId,
        forecastDate,
        utcNow: new Date().toISOString(),
      });
    }

    const supabase = await createSupabaseServerClient();
    const { data: intel, error } = await supabase
      .from("beach_daily_intel")
      .select("*")
      .eq("beach_id", beachId)
      .eq("forecast_date", forecastDate)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Dev-only result logging
    if (process.env.NODE_ENV === 'development') {
      if (!intel) {
        console.log(`[beach-daily-intel API] No intel found for beach ${beachId} on ${forecastDate}`);
      } else {
        console.log(`[beach-daily-intel API] Found intel for beach ${beachId}:`, {
          forecast_date: intel.forecast_date,
          generated_at: intel.generated_at,
        });
      }
    }

    if (error) {
      throw error;
    }

    return createSuccessResponse({ intel: intel ?? null });
  } catch (error) {
    return handleApiError(error, "Failed to load beach daily intel");
  }
}




