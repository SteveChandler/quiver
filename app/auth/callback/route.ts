import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import {
  verifyEmailToken,
  getEmailTokenSecret,
} from '@/lib/utils/email-token';

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
  // through the required onboarding path on ANY redirect target — the
  // dialog is globally mounted and listens for ?onboarding=required, so
  // a user signing up from a gated beach page lands on that page with
  // the onboarding dialog open instead of bypassing activation entirely.
  //
  // We fetch the profile (home_beach_id + onboarding_completed_at) via
  // the authenticated session we just exchanged. The supabase-js client
  // handles RLS correctly for auth.users → public.profiles self-reads.
  let finalRedirect = redirectUrl;
  let clearInviteCookie = false;
  let inviteConsumed = false;
  // Anonymous alert-capture finalization. If the user signed in via a magic
  // link triggered by /api/alerts/anon-capture, materialize any pending
  // captures into alert_rules. The RPC sets home_beach_id, so the
  // onboarding-gate logic below correctly skips the onboarding redirect for
  // capture flows.
  let captureCount = 0;
  let firstCaptureReturnPath: string | null = null;
  let firstCaptureBeachId: string | null = null;
  let firstCapturePresetType: string | null = null;
  let captureBeachIds: string[] = [];
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const sessionEmail = user.email;
      const sessionUserId = user.id;
      if (sessionEmail && sessionUserId) {
        const { data: captures, error: rpcError } = await supabase.rpc(
          'finalize_anon_alert_capture',
          {
            p_user_id: sessionUserId,
            p_email: sessionEmail.toLowerCase(),
          },
        );
        if (!rpcError && Array.isArray(captures) && captures.length > 0) {
          captureCount = captures.length;
          firstCaptureReturnPath = captures[0].return_path ?? null;
          firstCaptureBeachId = captures[0].beach_id ?? null;
          firstCapturePresetType = captures[0].preset_type ?? null;
          captureBeachIds = captures
            .map((c: { beach_id: string }) => c.beach_id)
            .filter(Boolean);
        }
      }

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
        finalRedirect = appendOnboardingRequired(redirectUrl, request.url);
      }

      // Fire capture events AFTER the onboarding-gate check (which doesn't
      // depend on them). Non-blocking failures are tolerated — the redirect
      // still proceeds. Batched into one insert so we make a single DB
      // roundtrip instead of two for every alert-capture sign-in (~50–100ms
      // on the auth-callback critical path).
      if (captureCount > 0) {
        await supabase.from('user_events').insert([
          {
            event_type: 'anon_alert_signup_success',
            user_id: user.id,
            session_id: crypto.randomUUID(),
            metadata: {
              capture_count: captureCount,
              beach_ids: captureBeachIds,
            },
          },
          {
            event_type: 'anon_alert_magic_link_clicked',
            user_id: user.id,
            session_id: crypto.randomUUID(),
            metadata: {
              beach_id: firstCaptureBeachId,
              preset_type: firstCapturePresetType,
            },
          },
        ]);

        // Compute the capture-aware redirect target. An explicit `?redirect=`
        // query param always wins (already validated above into `redirectUrl`).
        // Otherwise fall back to the first capture's return_path. Append
        // ?welcome=alert_capture&count=N for the destination toast.
        const explicitRedirect = url.searchParams.get('redirect');
        let captureTarget = explicitRedirect
          ? redirectUrl
          : firstCaptureReturnPath ?? redirectUrl;
        captureTarget = appendCaptureWelcome(
          captureTarget,
          request.url,
          captureCount,
        );
        finalRedirect = captureTarget;
      }

      // Consume invite token (if set by /invite/[token] or /auth/sign-up).
      // Verifies the JWT, inserts the user_follows row (inviter is the
      // target), and appends ?invited=1 to the redirect so the landing
      // surface can acknowledge the relationship.
      const inviteCookie = request.cookies.get('invite_token')?.value;
      if (inviteCookie) {
        clearInviteCookie = true;
        try {
          const payload = await verifyEmailToken(
            inviteCookie,
            getEmailTokenSecret(),
          );
          if (
            payload &&
            payload.purpose === 'invite' &&
            payload.user_id !== user.id
          ) {
            const { error: insertError } = await supabase
              .from('user_follows')
              .insert({
                follower_id: user.id,
                following_id: payload.user_id,
              });
            // 23505 = unique_violation — row already exists. Treat as a
            // successful consume so double-redirects stay idempotent.
            if (!insertError || insertError.code === '23505') {
              inviteConsumed = true;
            } else {
              console.error(
                '[Auth Callback] invite user_follows insert failed:',
                insertError,
              );
            }
          }
        } catch (err) {
          console.error('[Auth Callback] invite token verify failed:', err);
        }
      }
    }
  }

  if (inviteConsumed) {
    finalRedirect = appendInvitedFlag(finalRedirect, request.url);
  }

  const response = NextResponse.redirect(new URL(finalRedirect, request.url));

  // Replay session cookies onto the final response (the supabase client
  // wrote them into request.cookies + our cookiePairs array; the redirect
  // response we're returning needs them set so the client session survives).
  for (const { name, value, options } of cookiePairs) {
    response.cookies.set({ name, value, ...options });
  }

  if (clearInviteCookie) {
    response.cookies.delete('invite_token');
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

// Append `invited=1` to a redirect target without clobbering existing
// query params. Used when an invite_token cookie was successfully consumed
// so the landing UI can acknowledge the new follow.
function appendInvitedFlag(target: string, requestUrl: string): string {
  try {
    const parsed = new URL(target, requestUrl);
    parsed.searchParams.set('invited', '1');
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/?invited=1';
  }
}

// Append `welcome=alert_capture&count=N` to a redirect target without
// clobbering existing query params or the hash fragment. Used after the
// finalize_anon_alert_capture RPC materializes pending captures.
function appendCaptureWelcome(
  target: string,
  requestUrl: string,
  count: number,
): string {
  try {
    const parsed = new URL(target, requestUrl);
    parsed.searchParams.set('welcome', 'alert_capture');
    parsed.searchParams.set('count', String(count));
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return `/?welcome=alert_capture&count=${count}`;
  }
}

// Append `onboarding=required` to a redirect target without clobbering
// existing query params or the hash fragment. Falls back to '/' if the
// target can't be parsed against the request origin.
function appendOnboardingRequired(target: string, requestUrl: string): string {
  try {
    const parsed = new URL(target, requestUrl);
    if (parsed.searchParams.get('onboarding') === 'required') {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    parsed.searchParams.set('onboarding', 'required');
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/?onboarding=required';
  }
}
