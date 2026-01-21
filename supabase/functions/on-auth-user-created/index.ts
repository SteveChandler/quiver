import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Environment variables - validated at runtime in the handler
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const EMAIL_TOKEN_SECRET = Deno.env.get('EMAIL_TOKEN_SECRET');
const MAIL_FROM = Deno.env.get('MAIL_FROM');
const APP_URL = Deno.env.get('APP_URL') || 'https://quiver.surf';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

function validateEnvVars(): { valid: true } | { valid: false; missing: string[] } {
  const required = {
    RESEND_API_KEY,
    EMAIL_TOKEN_SECRET,
    MAIL_FROM,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  };

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    return { valid: false, missing };
  }

  return { valid: true };
}

// Simple JWT signing for Deno (Web Crypto API)
async function signToken(payload: Record<string, unknown>, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days
  const body = btoa(JSON.stringify({ ...payload, exp }));

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${header}.${body}`)
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${header}.${body}.${sig}`;
}

// ============================================================================
// WELCOME EMAIL TEMPLATE
// ============================================================================
// SYNC WITH: lib/email/templates/welcome-email-html.ts (CANONICAL SOURCE)
//
// This template is duplicated here because Deno Edge Functions cannot import
// from the Node.js lib directory. If you modify this template, you MUST also
// update the canonical source file.
//
// The canonical source exports:
// - generateWelcomeEmailHtml(params: { baseUrl: string; token: string }): string
// - generateWelcomeEmailText(params: { baseUrl: string; token: string }): string
// - WELCOME_EMAIL_SUBJECT: string
// ============================================================================

interface WelcomeEmailParams {
  baseUrl: string;
  token: string;
}

// Inline style constants
const COLORS = {
  primary: '#3b82f6',
  text: '#333333',
  textSecondary: '#666666',
  textTertiary: '#999999',
  heading: '#1e40af',
  border: '#eeeeee',
} as const;

const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const BUTTON_STYLE = `
  display: inline-block;
  padding: 12px 20px;
  margin: 4px;
  background: ${COLORS.primary};
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 500;
`.trim();

const TIME_BUTTONS = [
  { label: 'Dawn patrol', value: 'dawn' },
  { label: 'After work', value: 'after_work' },
  { label: 'Weekends', value: 'weekends' },
] as const;

const LEVEL_BUTTONS = [
  { label: 'Beginner', value: 'beginner' },
  { label: 'Intermediate', value: 'intermediate' },
  { label: 'Advanced', value: 'advanced' },
] as const;

const FREQUENCY_BUTTONS = [
  { label: 'Daily (even if flat)', value: 'daily' },
  { label: "Only when it's good", value: 'only_good' },
] as const;

function generateWelcomeEmailHtml(params: WelcomeEmailParams): string {
  const { baseUrl, token } = params;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: ${FONT_FAMILY}; max-width: 600px; margin: 0 auto; padding: 20px; color: ${COLORS.text};">
  <h1 style="color: ${COLORS.heading}; font-size: 24px; margin-bottom: 8px;">🌊 Welcome to Quiver</h1>

  <p style="font-size: 18px; color: ${COLORS.textSecondary}; margin-bottom: 24px;">
    Quiver emails you one thing: the best yes/no surf call.
  </p>

  <div style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; color: ${COLORS.text}; margin-bottom: 12px;">When do you usually surf?</h2>
    ${TIME_BUTTONS.map(b => `<a href="${baseUrl}/prefs/set?time=${b.value}&token=${token}" style="${BUTTON_STYLE}">${b.label}</a>`).join('')}
  </div>

  <div style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; color: ${COLORS.text}; margin-bottom: 12px;">What's your level?</h2>
    ${LEVEL_BUTTONS.map(b => `<a href="${baseUrl}/prefs/set?level=${b.value}&token=${token}" style="${BUTTON_STYLE}">${b.label}</a>`).join('')}
  </div>

  <div style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; color: ${COLORS.text}; margin-bottom: 12px;">How often should we email?</h2>
    ${FREQUENCY_BUTTONS.map(b => `<a href="${baseUrl}/prefs/set?frequency=${b.value}&token=${token}" style="${BUTTON_STYLE}">${b.label}</a>`).join('')}
  </div>

  <div style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; color: ${COLORS.text}; margin-bottom: 12px;">Home break?</h2>
    <a href="${baseUrl}/prefs/home-beach?token=${token}" style="${BUTTON_STYLE}">Set home beach →</a>
  </div>

  <p style="color: ${COLORS.textTertiary}; font-size: 14px; margin-top: 32px;">
    Or just reply with your home break name.
  </p>

  <hr style="border: none; border-top: 1px solid ${COLORS.border}; margin: 32px 0;">

  <p style="color: ${COLORS.textTertiary}; font-size: 12px;">
    Quiver · The smart surf forecast
  </p>
</body>
</html>
  `.trim();
}

const WELCOME_EMAIL_SUBJECT = 'Welcome to Quiver — set your surf defaults (10 seconds)';

// ============================================================================
// END WELCOME EMAIL TEMPLATE
// ============================================================================

serve(async (req) => {
  try {
    // Validate environment variables at runtime
    const envCheck = validateEnvVars();
    if (!envCheck.valid) {
      console.error('Missing required environment variables:', envCheck.missing);
      return new Response(
        `Configuration error: Missing environment variables: ${envCheck.missing.join(', ')}`,
        { status: 500 }
      );
    }

    const { record } = await req.json();

    if (!record?.email || !record?.id) {
      return new Response('Missing user data', { status: 400 });
    }

    const userId = record.id;
    const userEmail = record.email;

    // Generate token (env vars validated above, safe to assert)
    const token = await signToken({ user_id: userId, purpose: 'prefs' }, EMAIL_TOKEN_SECRET!);

    // Build email HTML using the shared template structure
    const html = generateWelcomeEmailHtml({ baseUrl: APP_URL, token });

    // Send via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: userEmail,
        subject: WELCOME_EMAIL_SUBJECT,
        html,
      }),
    });

    if (!res.ok) {
      console.error('Failed to send welcome email:', await res.text());
      return new Response('Email send failed', { status: 500 });
    }

    // Log the send (env vars validated above, safe to assert)
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { error: logError } = await supabase.from('email_send_log').insert({
      user_id: userId,
      email_type: 'welcome',
      local_date: new Date().toISOString().split('T')[0],
      subject: WELCOME_EMAIL_SUBJECT,
    });

    // Log error but don't fail - email was already sent successfully
    if (logError) {
      console.error('Failed to log email send (email was sent successfully):', logError);
    }

    console.log(`Welcome email sent to ${userEmail}`);
    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('Error in on-auth-user-created:', error);
    return new Response('Internal error', { status: 500 });
  }
});
