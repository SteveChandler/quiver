import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withAdminAuth } from "@/lib/middleware/api-wrappers";
import {
  createSupabaseSwellWatchSafetyStore,
  executeSwellWatchControlCommand,
} from "@/lib/alerts/swell-watch/safety-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const commandSchema = z.object({
  operation: z.enum(["hold", "reset_shadow", "arm"]),
  expectedEpoch: z.number().int().min(0),
  reasonCode: z.string().regex(/^[a-z0-9_:-]{3,96}$/),
}).strict();
const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9:_-]{8,160}$/);

function noStore(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

function withNoStore(handler: ReturnType<typeof withAdminAuth>): ReturnType<typeof withAdminAuth> {
  return async (request, context) => {
    const response = await handler(request, context);
    response.headers.set("Cache-Control", "no-store");
    return response;
  };
}

export const GET = withNoStore(withAdminAuth(async (_request: NextRequest, { supabase }) => {
  try {
    const control = await createSupabaseSwellWatchSafetyStore(supabase).getControl();
    if (!control) return noStore({ success: false, error: { code: "control_unavailable" } }, { status: 503 });
    return noStore({ success: true, data: { control } });
  } catch {
    return noStore({ success: false, error: { code: "control_unavailable" } }, { status: 503 });
  }
}, { errorMessage: "Swell Watch control request failed" }));

export const POST = withNoStore(withAdminAuth(async (request: NextRequest, { user, supabase }) => {
  const idempotencyKey = idempotencyKeySchema.safeParse(request.headers.get("Idempotency-Key"));
  const command = commandSchema.safeParse(await request.json().catch(() => undefined));
  if (!idempotencyKey.success || !command.success) {
    return noStore({ success: false, error: { code: "invalid_request" } }, { status: 400 });
  }
  try {
    const control = await executeSwellWatchControlCommand({
      ...command.data,
      idempotencyKey: idempotencyKey.data,
      operatorUserId: user.id,
    }, createSupabaseSwellWatchSafetyStore(supabase));
    return noStore({ success: true, data: { control } });
  } catch {
    return noStore({ success: false, error: { code: "transition_rejected" } }, { status: 409 });
  }
}, { errorMessage: "Swell Watch control request failed" }));
