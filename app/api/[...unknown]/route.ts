import type { NextRequest } from "next/server";
import { createNotFoundError } from "@/lib/api-utils";
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";

// Every /api path with no route of its own lands here. Without this route, Next
// sends its own 404, which gets the blanket `/api/*` max-age=60 from next.config
// and stays in browser and iOS caches. Specific routes always match first.
const notFound = withErrorNoStore(async (_request: NextRequest) => createNotFoundError("API route"));

export const GET = notFound;
export const HEAD = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
export const OPTIONS = notFound;
