import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_SECURITY_HEADERS, handleApiError } from "@/lib/api-utils";
import { searchBeachesMultiple } from "@/lib/utils/beach-search-utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get("query") || "";
    const query = rawQuery.trim();

    if (!query) {
      return NextResponse.json([], {
        status: 200,
        headers: DEFAULT_SECURITY_HEADERS,
      });
    }

    const results = await searchBeachesMultiple(query);
    return NextResponse.json(results, {
      status: 200,
      headers: DEFAULT_SECURITY_HEADERS,
    });
  } catch (error) {
    console.error("Error searching beaches:", error);
    return handleApiError(error, "Failed to search beaches");
  }
}
