import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { withRateLimit } from "@/lib/middleware/api-wrappers/rate-limit-wrapper";
import { recordProviderEvent } from "@/lib/email/provider-events";

async function handler(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) return NextResponse.json({ error: "Missing webhook signature headers" }, { status: 400 });
  let payload: unknown;
  try {
    payload = new Webhook(secret).verify(await request.text(), { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": signature });
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  try {
    const processed = await recordProviderEvent(payload, id);
    return NextResponse.json({ received: true, processed });
  } catch {
    // A replay must heal partial summary/pause/suppression failures, not stop at insertion.
    return NextResponse.json({ received: true, processed: false, retryable: true }, { status: 503 });
  }
}

export const POST = withRateLimit(handler, "webhook-resend");
