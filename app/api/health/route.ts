import { NextRequest, NextResponse } from "next/server";
import {
  createSuccessResponse,
  methodNotAllowed,
  DEFAULT_SECURITY_HEADERS,
} from "@/lib/middleware/api-wrappers";
import { checkForecastHealth } from "@/lib/monitoring/forecast-health-check";

export async function GET(request: NextRequest) {
  const deep = request.nextUrl.searchParams.get("deep") === "true";

  if (!deep) {
    return createSuccessResponse({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "quiver-surf-app",
    });
  }

  try {
    const metrics = await checkForecastHealth();

    const body = {
      status: metrics.healthStatus,
      timestamp: new Date().toISOString(),
      service: "quiver-surf-app",
      checks: {
        database: metrics.enhancedAvailable,
        enhancedForecasts: {
          coverage: metrics.coveragePercentage,
          freshCount:
            metrics.beachesWithForecasts - metrics.beachesWithStaleData,
          staleCount: metrics.beachesWithStaleData,
          averageAgeHours: Math.round(metrics.averageForecastAge * 10) / 10,
        },
        sources: metrics.sources,
      },
      issues: metrics.issues,
    };

    if (metrics.healthStatus === "critical") {
      return NextResponse.json(
        { success: false, data: body, timestamp: new Date().toISOString() },
        { status: 503, headers: DEFAULT_SECURITY_HEADERS },
      );
    }

    return createSuccessResponse(body);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        data: {
          status: "critical",
          timestamp: new Date().toISOString(),
          service: "quiver-surf-app",
          checks: {
            database: false,
            enhancedForecasts: null,
            sources: null,
          },
          issues: ["Health check failed: " + message],
        },
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: DEFAULT_SECURITY_HEADERS },
    );
  }
}

export async function POST() {
  return methodNotAllowed(["GET"]);
}

export async function PUT() {
  return methodNotAllowed(["GET"]);
}

export async function DELETE() {
  return methodNotAllowed(["GET"]);
}

export async function PATCH() {
  return methodNotAllowed(["GET"]);
}
