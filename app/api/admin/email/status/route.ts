import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/middleware/api-wrappers";
import { lifecycleRpc } from "@/lib/email/lifecycle";
export const dynamic = "force-dynamic";
export const GET = withAdminAuth(async () => NextResponse.json(await lifecycleRpc("email_automation_dashboard"), { headers: { "Cache-Control": "private, no-store" } }));
