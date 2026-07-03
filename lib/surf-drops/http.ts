import type { NextResponse } from "next/server";
import {
  createErrorResponse,
  createValidationError,
} from "@/lib/middleware/api-wrappers";
import { SurfDropServiceError } from "@/lib/surf-drops/service";

export function surfDropErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof SurfDropServiceError) {
    return createErrorResponse(error.message, error.details, error.status);
  }

  if (error instanceof Error) {
    return createValidationError(error.message);
  }

  return null;
}

export function withNoStore(response: NextResponse): NextResponse {
  response.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate",
  );
  return response;
}
