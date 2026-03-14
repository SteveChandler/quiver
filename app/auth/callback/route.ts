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

  const response = NextResponse.redirect(new URL(redirectUrl, request.url));

  if (code) {
    // Create Supabase client with request/response cookie pattern
    // so session cookies are written to the redirect response
    const supabase = createServerClient(
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
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set({ name, value, ...options })
            );
          },
        },
      }
    );

    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

    if (sessionError) {
      console.error('[Auth Callback] Session exchange failed:', sessionError.message);
      const signInUrl = new URL('/auth/sign-in', request.url);
      signInUrl.searchParams.set('error', 'Sign in failed. Please try again.');
      return NextResponse.redirect(signInUrl);
    }
  }

  return response;
}
