import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getWeekScoutStoryPublisherToken } from "@/lib/flags/week-scout-story";
import { NO_STORE_CACHE_CONTROL } from "./cache-wrappers";

type Handler = (request: NextRequest) => Promise<NextResponse>;

export function withStoryPublisher(handler: Handler): (request: NextRequest) => Promise<NextResponse> {
  return async (request) => {
    const expected = getWeekScoutStoryPublisherToken();
    if (!expected) return NextResponse.json({ error: "not_found" }, { status: 404,
      headers: { "Cache-Control": NO_STORE_CACHE_CONTROL } });
    const supplied = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1]?.trim() ?? "";
    const a = Buffer.from(supplied);
    const b = Buffer.from(expected);
    const matched = a.length === b.length ? timingSafeEqual(a, b) : (timingSafeEqual(b, b), false);
    if (!matched) return NextResponse.json({ error: "unauthorized" }, { status: 401,
      headers: { "Cache-Control": NO_STORE_CACHE_CONTROL } });
    try {
      const response = await handler(request);
      response.headers.set("Cache-Control", NO_STORE_CACHE_CONTROL);
      return response;
    } catch {
      return NextResponse.json({ error: "internal_error" }, { status: 500,
        headers: { "Cache-Control": NO_STORE_CACHE_CONTROL } });
    }
  };
}
