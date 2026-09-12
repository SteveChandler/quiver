import { z } from "zod";
import { verifyEmailUnsubscribeToken } from "@/lib/alerts/email-token";
import { lifecycleRpc } from "@/lib/email/lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function userFromRequest(request: Request): string | null {
  const params = new URL(request.url).searchParams;
  const id = z.uuid().safeParse(params.get("user_id"));
  const token = params.get("token");
  return id.success && token && verifyEmailUnsubscribeToken(id.data, token) ? id.data : null;
}

export async function GET(request: Request): Promise<Response> {
  if (!userFromRequest(request)) return new Response("Invalid unsubscribe link", { status: 400 });
  // Link scanners cannot change a preference. The signed query survives form POST.
  return new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe from Quiver</title><body><main><h1>Stop Quiver lifecycle emails?</h1><form method="post"><button type="submit">Unsubscribe</button></form></main></body></html>', { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  const userId = userFromRequest(request);
  if (!userId) return new Response("Invalid unsubscribe link", { status: 400 });
  try {
    await lifecycleRpc("unsubscribe_email_lifecycle", { p_user_id: userId });
    return new Response("You have unsubscribed from Quiver lifecycle emails.", { headers: { "Cache-Control": "no-store" } });
  } catch {
    return new Response("Unable to unsubscribe. Please retry.", { status: 503 });
  }
}
