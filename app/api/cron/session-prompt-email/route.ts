import { NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/middleware/api-wrappers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ status: "retired", replacement: "/api/cron/email-lifecycle", sent: 0 });
}
