import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

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
  const supabase = createClient();
  
  // The session exchange happens automatically when we create the client
  // with the auth code in the URL. We just need to redirect the user back.
  
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
  
  return NextResponse.redirect(new URL(redirectUrl, request.url));
}

