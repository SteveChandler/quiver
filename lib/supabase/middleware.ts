import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.includes("supabase")) {
      response.cookies.set(cookie.name, cookie.value);
    }
  }
  return response;
}

// Switch to Node.js runtime
export const config = {
  runtime: "nodejs",
};
