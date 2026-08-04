import { NextRequest, NextResponse } from "next/server";
import {
  createErrorResponse,
  createSuccessResponse,
  withAuth,
  withRateLimit,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import {
  fetchPointMarineForecast,
  PointMarineForecastUnavailableError,
} from "@/lib/services/point-marine-forecast";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

function parseFiniteQueryNumber(value: string | null): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDays(value: string | null): number | null {
  const parsed = parseFiniteQueryNumber(value);
  if (parsed == null || !Number.isInteger(parsed) || parsed < 1 || parsed > 10) return null;
  return parsed;
}

export async function pointMarineForecastHandler(
  request: NextRequest,
  _context: AuthenticatedContext,
): Promise<NextResponse> {
  const lat = parseFiniteQueryNumber(request.nextUrl.searchParams.get("lat"));
  const lon = parseFiniteQueryNumber(request.nextUrl.searchParams.get("lon"));
  const days = parseDays(request.nextUrl.searchParams.get("days")) ?? 10;

  if (lat == null || lat < -90 || lat > 90) {
    return createErrorResponse("lat must be a finite latitude", null, 400);
  }
  if (lon == null || lon < -180 || lon > 180) {
    return createErrorResponse("lon must be a finite longitude", null, 400);
  }
  if (request.nextUrl.searchParams.has("days") && parseDays(request.nextUrl.searchParams.get("days")) == null) {
    return createErrorResponse("days must be an integer from 1 to 10", null, 400);
  }

  try {
    const forecast = await fetchPointMarineForecast({ lat, lon, days, signal: request.signal });
    const response = createSuccessResponse(forecast);
    response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
    return response;
  } catch (error) {
    if (error instanceof PointMarineForecastUnavailableError) {
      return createErrorResponse("Point marine forecast unavailable", null, 502);
    }
    throw error;
  }
}

export const GET = withRateLimit(
  withAuth(pointMarineForecastHandler, {
    errorMessage: "Failed to load point marine forecast",
  }),
  "point-marine-forecast",
);
