import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const EMAIL_TOKEN_SECRET = Deno.env.get('EMAIL_TOKEN_SECRET')!;
const EMAIL_FROM_ADDRESS = Deno.env.get('EMAIL_FROM_ADDRESS')!;
const APP_URL = Deno.env.get('APP_URL') || 'https://quiver.surf';

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

serve(async (req) => {
  try {
    const { record } = await req.json();

    if (!record?.email || !record?.id) {
      return new Response('Missing user data', { status: 400 });
    }

    const userId = record.id;
    const userEmail = record.email;

    // Generate token
    const token = await signToken({ user_id: userId, purpose: 'prefs' }, EMAIL_TOKEN_SECRET);

    // Build email HTML
    const buttonStyle = `
      display: inline-block;
      padding: 12px 20px;
      margin: 4px;
      background: #3b82f6;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
    `;

    const timeButtons = [
      { label: 'Dawn patrol', value: 'dawn' },
      { label: 'After work', value: 'after_work' },
      { label: 'Weekends', value: 'weekends' },
    ];

    const levelButtons = [
      { label: 'Beginner', value: 'beginner' },
      { label: 'Intermediate', value: 'intermediate' },
      { label: 'Advanced', value: 'advanced' },
    ];

    const frequencyButtons = [
      { label: 'Daily (even if flat)', value: 'daily' },
      { label: 'Only when it\'s good', value: 'only_good' },
    ];

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h1 style="color: #1e40af; font-size: 24px; margin-bottom: 8px;">🌊 Welcome to Quiver</h1>

  <p style="font-size: 18px; color: #666; margin-bottom: 24px;">
    Quiver emails you one thing: the best yes/no surf call.
  </p>

  <div style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; color: #333; margin-bottom: 12px;">When do you usually surf?</h2>
    ${timeButtons.map(b => `<a href="${APP_URL}/prefs/set?time=${b.value}&token=${token}" style="${buttonStyle}">${b.label}</a>`).join('')}
  </div>

  <div style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; color: #333; margin-bottom: 12px;">What's your level?</h2>
    ${levelButtons.map(b => `<a href="${APP_URL}/prefs/set?level=${b.value}&token=${token}" style="${buttonStyle}">${b.label}</a>`).join('')}
  </div>

  <div style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; color: #333; margin-bottom: 12px;">How often should we email?</h2>
    ${frequencyButtons.map(b => `<a href="${APP_URL}/prefs/set?frequency=${b.value}&token=${token}" style="${buttonStyle}">${b.label}</a>`).join('')}
  </div>

  <div style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; color: #333; margin-bottom: 12px;">Home break?</h2>
    <a href="${APP_URL}/prefs/home-beach?token=${token}" style="${buttonStyle}">Set home beach →</a>
  </div>

  <p style="color: #999; font-size: 14px; margin-top: 32px;">
    Or just reply with your home break name.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

  <p style="color: #999; font-size: 12px;">
    Quiver · The smart surf forecast
  </p>
</body>
</html>
    `.trim();

    const subject = 'Welcome to Quiver — set your surf defaults (10 seconds)';

    // Send via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM_ADDRESS,
        to: userEmail,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      console.error('Failed to send welcome email:', await res.text());
      return new Response('Email send failed', { status: 500 });
    }

    // Log the send
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabase.from('email_send_log').insert({
      user_id: userId,
      email_type: 'welcome',
      local_date: new Date().toISOString().split('T')[0],
      subject,
    });

    console.log(`Welcome email sent to ${userEmail}`);
    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('Error in on-auth-user-created:', error);
    return new Response('Internal error', { status: 500 });
  }
});
