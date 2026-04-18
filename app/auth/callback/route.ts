import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const redirect = url.searchParams.get('redirect') || '/';

  // If the OAuth provider returned an error (e.g. user denied consent),
  // redirect to sign-in with the error info
  if (error) {
    const errorDescription = url.searchParams.get('error_description') || 'Authentication failed';
    const signInUrl = new URL('/auth/sign-in', request.url);
    signInUrl.searchParams.set('error', errorDescription);
    return NextResponse.redirect(signInUrl);
  }

  // Validate redirect URL to prevent open redirects
  // Block protocol-relative URLs (//evil.com) which inherit the current protocol
  let redirectUrl = '/';
  if (redirect.startsWith('/') && !redirect.startsWith('//')) {
    redirectUrl = redirect;
  } else {
    try {
      const redirectUrlObj = new URL(redirect);
      const requestUrlObj = new URL(request.url);
      if (redirectUrlObj.origin === requestUrlObj.origin) {
        redirectUrl = redirect;
      }
    } catch {
      // default to '/'
    }
  }

  // Cookie pair we reuse for both the initial redirect response and any
  // re-redirect we issue after probing the profile. Extracted so the probe
  // path can carry the same session cookies + marker cookie.
  const cookiePairs: Array<{ name: string; value: string; options?: any }> = [];

  const supabase = code
    ? createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value }) =>
                request.cookies.set(name, value)
              );
              cookiesToSet.forEach(({ name, value, options }) => {
                if (process.env.NODE_ENV === 'development') {
                  console.log(`[Auth Callback] Setting cookie: ${name}, SameSite=${options?.sameSite}, Secure=${options?.secure}`);
                }
                cookiePairs.push({ name, value, options });
              });
            },
          },
        }
      )
    : null;

  if (code && supabase) {
    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

    if (sessionError) {
      console.error('[Auth Callback] Session exchange failed:', sessionError.message);
      const signInUrl = new URL('/auth/sign-in', request.url);
      signInUrl.searchParams.set('error', 'Sign in failed. Please try again.');
      return NextResponse.redirect(signInUrl);
    }
  }

  // Detect "fresh signup without an activated profile" and steer them
  // through the required onboarding path. We only rewrite the redirect
  // when the caller left the redirect at the default ('/'): if they
  // provided an explicit redirect (e.g. coming back from a gated route),
  // honor it — the dialog can still be re-opened from the Oracle CTA
  // later, and hijacking an explicit deep-link would feel broken.
  //
  // We fetch the profile (home_beach_id + onboarding_completed_at) via
  // the authenticated session we just exchanged. The supabase-js client
  // handles RLS correctly for auth.users → public.profiles self-reads.
  //
  // Plan: abstract-exploring-phoenix (Commit B). This is NOT a revert
  // of vast-dancing-whale's auto-open removal — the dialog still does
  // not auto-open on plain / loads. The query param is the only new
  // explicit entry path; existing users without a home beach still
  // follow the Oracle CTA path.
  let finalRedirect = redirectUrl;
  if (supabase && redirectUrl === '/') {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('home_beach_id, onboarding_completed_at')
        .eq('id', user.id)
        .maybeSingle();

      const isUnactivated =
        !!profile &&
        !profile.home_beach_id &&
        !profile.onboarding_completed_at;

      if (isUnactivated) {
        finalRedirect = '/?onboarding=required';
      }
    }
  }

  const response = NextResponse.redirect(new URL(finalRedirect, request.url));

  // Replay session cookies onto the final response (the supabase client
  // wrote them into request.cookies + our cookiePairs array; the redirect
  // response we're returning needs them set so the client session survives).
  for (const { name, value, options } of cookiePairs) {
    response.cookies.set({ name, value, ...options });
  }

  // Set a marker cookie so the client knows to force-refresh auth state
  // This handles the iOS Safari case where onAuthStateChange doesn't fire
  response.cookies.set('auth_callback_completed', '1', {
    maxAge: 30,
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
