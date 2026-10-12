import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Create a Supabase client specifically for Next.js API routes
 * This eliminates the repetitive cookie handling code across 15+ API routes
 *
 * Usage in API routes:
 * import { createAPIServerClient } from "@/lib/supabase/api-server-client";
 *
 * export async function POST(request: NextRequest) {
 *   const supabase = await createAPIServerClient();
 *   // ... rest of your API logic
 * }
 */
export async function createAPIServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}
