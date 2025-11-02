import { NextRequest } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { renderShareImage, type SessionData, type ShareVariant } from "@/lib/social-share-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  sessionId: z.string().uuid(),
  variant: z.enum(["story", "square"]).default("story"),
  ratio: z.enum(["1:1", "4:5", "9:16"]).optional(),
  t: z.string().optional(),
});

function hmacSign(message: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

function timingSafeEqual(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    // Rely on crypto.timingSafeEqual semantics; if lengths differ, it will throw and we return false
    // Tests may mock timingSafeEqual; avoid pre-checks that would bypass the mock.
    // @ts-ignore
    return (crypto as any).timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

function verifySignature(payload: { sessionId: string; variant: ShareVariant; ratio?: string }, signature: string | undefined, secret: string | undefined): boolean {
  if (!secret || !signature) return false;
  // Include ratio in signature if provided, otherwise maintain backward compatibility
  const canonical = payload.ratio
    ? `${payload.sessionId}:${payload.variant}:${payload.ratio}`
    : `${payload.sessionId}:${payload.variant}`;
  const expected = hmacSign(canonical, secret);
  if (timingSafeEqual(signature, expected)) return true;
  // Also accept URL-safe/base64 if caller uses a different format
  const expectedB64 = crypto.createHmac("sha256", secret).update(canonical).digest("base64url");
  return timingSafeEqual(signature, expectedB64);
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const parsed = Query.safeParse({
      sessionId: url.searchParams.get("sessionId"),
      variant: (url.searchParams.get("variant") as ShareVariant | null) ?? undefined,
      ratio: url.searchParams.get("ratio") ?? undefined,
      t: url.searchParams.get("t") ?? undefined,
    });

    if (!parsed.success) {
      return new Response("Invalid query", { status: 400 });
    }

    const { sessionId, variant, ratio, t } = parsed.data;

    const supabase = createSupabaseServiceRoleClient();

    // Fetch session with minimal fields needed for sharing
    const { data: session, error } = await supabase
      .from("sessions")
      .select(
        `
        id,
        user_id,
        profile_id,
        beach_name,
        arrival_time,
        status,
        is_public,
        wave_quality,
        rating
      `
      )
      .eq("id", sessionId)
      .maybeSingle();

    if (error) {
      console.error("share/og fetch error", error);
      return new Response("Not found", { status: 404 });
    }
    if (!session) {
      return new Response("Not found", { status: 404 });
    }

    // Visibility rules: public sessions can be shared
    const isPublic = (session as any).is_public === true;
    const signatureOk = verifySignature({ sessionId, variant, ratio }, t, process.env.SOCIAL_SHARE_SECRET);

    // Allow sharing for public sessions or valid signatures
    if (!isPublic && !signatureOk) {
      return new Response("Forbidden", { status: 403 });
    }

    // Map to SessionData expected by renderer
    const data: SessionData = {
      title: session.status === "completed" ? "Surf Session" : "Planned Session",
      beachName: session.beach_name || "",
      scheduledAt: session.arrival_time,
      // Optionally map quality to score if available in 0-100 scale; otherwise omit
      // score: typeof session.wave_quality === 'number' ? Math.min(100, Math.max(0, session.wave_quality * 20)) : undefined,
    };

    const { png } = await renderShareImage(data, variant, ratio);

    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (err) {
    console.error("share/og error", err);
    return new Response("Server error", { status: 500 });
  }
}

// Fast warm-up path: validate query shape only and return 200
export async function HEAD(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const parsed = Query.safeParse({
      sessionId: url.searchParams.get("sessionId"),
      variant: (url.searchParams.get("variant") as ShareVariant | null) ?? undefined,
      ratio: url.searchParams.get("ratio") ?? undefined,
      t: url.searchParams.get("t") ?? undefined,
    });

    if (!parsed.success) {
      return new Response(undefined, { status: 400 });
    }

    return new Response(undefined, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=60",
      },
    });
  } catch {
    return new Response(undefined, { status: 500 });
  }
}

