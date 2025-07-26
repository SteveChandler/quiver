import { NextResponse } from "next/server";
import { createSuccessResponse } from "@/lib/api-utils";

// Simple health check endpoint
export async function GET() {
  return createSuccessResponse({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "quiver-surf-app",
  });
}
