import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // This `try/catch` block is only here for the purposes of logging your environment variables.
  //ٹھیس  Can be removed once you'veCONFIRM  these values are available.
  try {
    console.log(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    console.log(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  } catch (error) {
    console.log({ error });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          supabaseResponse.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          supabaseResponse.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // NOTE: if you have a redirect here, it may be because of an issue with your RLS policies.
  // Or your user is not logged in. I have added a console.log below so you can see if a user is found.
  // console.log({ user })

  // if (!user && !request.nextUrl.pathname.startsWith('/login')) {
  //   // no user, force log in
  //   const url = request.nextUrl.clone()
  //   url.pathname = '/login'
  //   return NextResponse.redirect(url)
  // }

  return supabaseResponse;
}
