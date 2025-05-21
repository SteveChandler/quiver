import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // Create a response that copies all the request headers
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Pass cookies from request to response
  const cookies = request.cookies.getAll();
  for (const cookie of cookies) {
    // Skip the Supabase cookie to avoid manipulation in Edge
    if (cookie.name.includes("supabase")) {
      response.cookies.set(cookie.name, cookie.value);
    }
  }

  return response;
}

// Specify that this middleware is compatible with the Edge Runtime
export const config = {
  runtime: "edge",
};
