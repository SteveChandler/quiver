import type { NextRequest } from "next/server";
import {
  createValidationError,
  handleApiError,
  isValidUuid,
} from "@/lib/middleware/api-wrappers";
import { GET as canonicalGet } from "@/app/api/profile/[id]/route";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const userId = params?.id;
    if (!isValidUuid(userId)) return createValidationError("Invalid user ID");
    // Delegate to canonical route
    return canonicalGet(request, { params: { id: userId } });
  } catch (error) {
    return handleApiError(error);
  }
}

