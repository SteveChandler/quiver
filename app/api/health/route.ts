import { NextResponse } from "next/server";

// Simple health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "quiver-surf-app",
  });
}
