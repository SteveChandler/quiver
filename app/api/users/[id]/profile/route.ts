import type { NextRequest } from "next/server";
import { createValidationError, handleApiError, isValidUuid } from "@/lib/api-utils";
import { GET as canonicalGet } from "@/app/api/profile/[id]/route";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = params?.id;
    if (!isValidUuid(userId)) return createValidationError("Invalid user ID");
    // Delegate to canonical route
    // @ts-ignore: forward to existing handler signature
    return canonicalGet(request, { params: { id: userId } });
  } catch (error) {
    return handleApiError(error);
  }
}


