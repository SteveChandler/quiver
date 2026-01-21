/**
 * Shared HTML response helper for email action routes.
 *
 * Used by routes like /api/prefs/set and /window/save to render
 * styled HTML pages for 1-tap email actions.
 */

import { NextResponse } from 'next/server';
import { escapeHtml } from '@/lib/utils/html';

export interface EmailActionPageOptions {
  title: string;
  message: string;
  isError?: boolean;
  buttonText?: string;
  buttonUrl?: string;
}

/**
 * Renders a styled HTML page for email action responses (preferences, window saves, etc.)
 * Includes XSS protection for all user-facing content.
 *
 * @param options - Page configuration options
 * @returns NextResponse with HTML content
 *
 * @example
 * ```typescript
 * // Success case
 * return renderEmailActionPage({
 *   title: 'Saved',
 *   message: 'Your preference has been saved.',
 * });
 *
 * // Error case
 * return renderEmailActionPage({
 *   title: 'Invalid Link',
 *   message: 'The link has expired.',
 *   isError: true,
 * });
 *
 * // Custom button
 * return renderEmailActionPage({
 *   title: 'Success',
 *   message: 'All done!',
 *   buttonText: 'View Dashboard',
 *   buttonUrl: '/dashboard',
 * });
 * ```
 */
export function renderEmailActionPage(options: EmailActionPageOptions): NextResponse {
  const {
    title,
    message,
    isError = false,
    buttonText = 'Open Quiver',
    buttonUrl = '/',
  } = options;

  const bgColor = isError ? '#fef2f2' : '#f0fdf4';
  const textColor = isError ? '#dc2626' : '#16a34a';
  // Use HTML entities for icons (compatible with all email clients)
  const icon = isError ? '&#33;' : '&#10003;';

  const html = `<!DOCTYPE html>
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
    .icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    h1 {
      color: ${textColor};
      margin: 0 0 0.5rem;
      font-size: 1.5rem;
    }
    p {
      color: #666;
      margin: 0 0 1.5rem;
    }
    .btn {
      display: inline-block;
      background: #3b82f6;
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 500;
    }
    .btn:hover {
      background: #2563eb;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <a href="${escapeHtml(buttonUrl)}" class="btn">${escapeHtml(buttonText)}</a>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: isError ? 400 : 200,
    headers: { 'Content-Type': 'text/html' },
  });
}
