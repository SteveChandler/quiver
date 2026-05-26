import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = "nodejs";

function renderFallback() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #7c1a00 0%, #c0390a 50%, #e85d1a 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 800, color: '#FFFFFF', display: 'flex' }}>
          Quiver
        </div>
        <div style={{ fontSize: 38, fontWeight: 500, color: 'rgba(255,255,255,0.8)', marginTop: 20, display: 'flex' }}>
          Streak Milestone
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const streakParam = searchParams.get('streak') || '0';
    const userName = searchParams.get('userName') || '';

    const streak = Math.max(0, parseInt(streakParam, 10));
    // Show up to 10 fire emojis
    const fireCount = Math.min(streak, 10);
    const fireEmojis = '🔥'.repeat(Math.max(1, fireCount));

    const truncate = (value: string, max: number) => {
      if (!value) return '';
      return value.length > max ? value.substring(0, Math.max(0, max - 1)) + '…' : value;
    };

    const displayName = truncate(userName, 28);

    const response = new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #7c1a00 0%, #c0390a 50%, #e85d1a 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: 72,
          }}
        >
          {/* Fire emojis */}
          <div
            style={{
              fontSize: 80,
              lineHeight: 1.2,
              display: 'flex',
              marginBottom: 28,
            }}
          >
            {fireEmojis}
          </div>

          {/* Streak count headline */}
          <div
            style={{
              fontSize: 112,
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '-0.03em',
              lineHeight: 1,
              display: 'flex',
              textShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}
          >
            {streak} Day Streak!
          </div>

          {/* User attribution */}
          <div
            style={{
              marginTop: 28,
              fontSize: 42,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.85)',
              display: 'flex',
              textShadow: '0 2px 12px rgba(0,0,0,0.35)',
            }}
          >
            {displayName ? `${displayName} on Quiver` : 'on Quiver'}
          </div>

          {/* Domain */}
          <div
            style={{
              marginTop: 20,
              fontSize: 30,
              fontWeight: 400,
              color: 'rgba(255,255,255,0.6)',
              letterSpacing: '0.02em',
              display: 'flex',
            }}
          >
            quiversurf.app
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );

    response.headers.set(
      'Cache-Control',
      'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
    );
    return response;
  } catch {
    return renderFallback();
  }
}
