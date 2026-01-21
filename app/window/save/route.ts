/**
 * GET /window/save
 *
 * 1-tap window saving from email links.
 * Query params: token, beach_id, start, end
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailToken, getEmailTokenSecret } from '@/lib/utils/email-token';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { escapeHtml } from '@/lib/utils/html';

function renderPage(title: string, message: string, isError: boolean = false) {
  const bgColor = isError ? '#fef2f2' : '#f0fdf4';
  const textColor = isError ? '#dc2626' : '#16a34a';
  const icon = isError ? '❌' : '✓';

  return new NextResponse(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - Quiver</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: ${bgColor};
    }
    .card {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      text-align: center;
      max-width: 400px;
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { color: ${textColor}; margin: 0 0 0.5rem; font-size: 1.5rem; }
    p { color: #666; margin: 0 0 1.5rem; }
    .btn {
      display: inline-block;
      background: #3b82f6;
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <a href="/" class="btn">Open Quiver</a>
  </div>
</body>
</html>`,
    {
      status: isError ? 400 : 200,
      headers: { 'Content-Type': 'text/html' },
    }
  );
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');
  const beachId = searchParams.get('beach_id');
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  // Validate required params
  if (!token || !beachId || !start || !end) {
    return renderPage(
      'Missing Info',
      'Missing required parameters. Please use the link from your email.',
      true
    );
  }

  // Verify token
  let secret: string;
  try {
    secret = getEmailTokenSecret();
  } catch {
    return renderPage('Configuration Error', 'Email system not configured.', true);
  }

  const payload = await verifyEmailToken(token, secret);
  if (!payload || payload.purpose !== 'save_window') {
    return renderPage('Invalid Link', 'Invalid or expired link.', true);
  }

  // Parse dates
  const startTs = new Date(start);
  const endTs = new Date(end);

  if (isNaN(startTs.getTime()) || isNaN(endTs.getTime())) {
    return renderPage('Invalid Dates', 'Invalid date format in link.', true);
  }

  // Save to database
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('saved_windows').insert({
    user_id: payload.user_id,
    beach_id: beachId,
    start_ts: startTs.toISOString(),
    end_ts: endTs.toISOString(),
    source: 'email',
  });

  if (error) {
    // Duplicate is OK - just show success
    if (error.code === '23505') {
      return renderPage('Saved', 'This window is already saved.');
    }
    console.error('Failed to save window:', error);
    return renderPage('Save Failed', 'Failed to save window. Please try again.', true);
  }

  return renderPage('Saved', "We'll remind you before this window starts.");
}
