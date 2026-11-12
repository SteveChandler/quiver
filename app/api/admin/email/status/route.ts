import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/middleware/api-wrappers";
import { lifecycleRpc } from "@/lib/email/lifecycle";
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";

export const dynamic = "force-dynamic";
const handleGet = withAdminAuth(async () => NextResponse.json(await lifecycleRpc("email_automation_dashboard"), { headers: { "Cache-Control": "private, no-store" } }));

export const GET = withErrorNoStore(handleGet);
