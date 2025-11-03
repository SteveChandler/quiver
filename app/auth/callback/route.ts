import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * OAuth callback route handler
 * Handles the redirect from Supabase OAuth providers (Google, etc.)
 * and email magic link confirmations
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const redirect = url.searchParams.get('redirect') || '/';
  
  // Create Supabase client - the SSR helper automatically handles
  // exchanging the auth code/hash from the URL for a session
  const supabase = createSupabaseServerClient();
  
  // The session exchange happens automatically when we create the client
  // with the auth code in the URL. We just need to redirect the user back.
  
  console.log('[Auth Callback] Redirect param:', redirect);
  
  // Validate redirect URL to prevent open redirects
  let redirectUrl: string;
  try {
    // Only allow relative URLs or URLs on the same origin
    if (redirect.startsWith('/')) {
      redirectUrl = redirect;
    } else {
      const redirectUrlObj = new URL(redirect);
      const requestUrlObj = new URL(request.url);
      
      if (redirectUrlObj.origin === requestUrlObj.origin) {
        redirectUrl = redirect;
      } else {
        // Redirect to home if URL is external
        redirectUrl = '/';
      }
    }
  } catch {
    // If URL parsing fails, default to home
    redirectUrl = '/';
  }
  
  console.log('[Auth Callback] Final redirect URL:', redirectUrl);
  
  // Create response with redirect and set a cookie to store the intended path
  // This ensures the client can retrieve it even after the redirect
  const response = NextResponse.redirect(new URL(redirectUrl, request.url));
  
  // Store the redirect path in a cookie that the client can read
  // This helps the client-side code know where the user wanted to go
  response.cookies.set('auth_return_to', redirectUrl, {
    httpOnly: false, // Allow client-side access
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60, // 60 seconds - just long enough for the redirect
    path: '/',
  });
  
  return response;
}

