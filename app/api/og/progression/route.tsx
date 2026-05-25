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
          background: 'linear-gradient(135deg, #0f2744 0%, #1a3a5c 50%, #0d1f2d 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 800, color: '#FFFFFF', display: 'flex' }}>
          Quiver
        </div>
        <div style={{ fontSize: 38, fontWeight: 500, color: 'rgba(255,255,255,0.8)', marginTop: 20, display: 'flex' }}>
          Progression Recap
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const sessions = searchParams.get('sessions') || '0';
    const hours = searchParams.get('hours') || '0';
    const avgRating = searchParams.get('avgRating') || '0';
    const topSkill = searchParams.get('topSkill') || '';
    const topSkillRating = searchParams.get('topSkillRating') || '';
    const streak = searchParams.get('streak') || '';
    const month = searchParams.get('month') || 'This Month';
    const forecastImpact = searchParams.get('forecastImpact') || '';

    const truncate = (value: string, max: number) => {
      if (!value) return '';
      return value.length > max ? value.substring(0, Math.max(0, max - 1)) + '…' : value;
    };

    const displayMonth = truncate(month, 24);
    const parsedSessions = parseInt(sessions, 10);
    const displaySessions = isNaN(parsedSessions) ? '0' : String(Math.max(0, parsedSessions));
    const parsedHours = parseFloat(hours);
    const displayHours = isNaN(parsedHours) ? '0.0' : Math.max(0, parsedHours).toFixed(1);
    const parsedAvgRating = parseFloat(avgRating);
    const displayAvgRating = isNaN(parsedAvgRating) ? '0.0' : Math.max(0, Math.min(5, parsedAvgRating)).toFixed(1);

    const response = new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(135deg, #0f2744 0%, #1a4a7a 50%, #0d2a4d 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: 72,
          }}
        >
          {/* Top: Quiver brand */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
            <div
              style={{
                fontSize: 42,
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: '-0.01em',
                display: 'flex',
              }}
            >
              Quiver
            </div>
            <div
              style={{
                marginLeft: 16,
                fontSize: 28,
                fontWeight: 400,
                color: 'rgba(255,255,255,0.6)',
                display: 'flex',
              }}
            >
              quiversurf.app
            </div>
          </div>

          {/* Month headline */}
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              display: 'flex',
              marginBottom: 48,
            }}
          >
            {displayMonth} Recap
          </div>

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              gap: 32,
              marginBottom: 36,
            }}
          >
            {/* Sessions */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 16,
                padding: '20px 32px',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <div
                style={{
                  fontSize: 56,
                  fontWeight: 800,
                  color: '#5bb8ff',
                  display: 'flex',
                  lineHeight: 1,
                }}
              >
                {displaySessions}
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.7)',
                  display: 'flex',
                  marginTop: 6,
                }}
              >
                sessions
              </div>
            </div>

            {/* Hours */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 16,
                padding: '20px 32px',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <div
                style={{
                  fontSize: 56,
                  fontWeight: 800,
                  color: '#5bb8ff',
                  display: 'flex',
                  lineHeight: 1,
                }}
              >
                {displayHours}
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.7)',
                  display: 'flex',
                  marginTop: 6,
                }}
              >
                hrs
              </div>
            </div>

            {/* Avg rating */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 16,
                padding: '20px 32px',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <div
                style={{
                  fontSize: 56,
                  fontWeight: 800,
                  color: '#ffd700',
                  display: 'flex',
                  lineHeight: 1,
                }}
              >
                {displayAvgRating}
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.7)',
                  display: 'flex',
                  marginTop: 6,
                }}
              >
                avg rating
              </div>
            </div>
          </div>

          {/* Details row */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {streak && (
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.9)',
                  display: 'flex',
                }}
              >
                Longest streak: {streak} days
              </div>
            )}
            {topSkill && (
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.9)',
                  display: 'flex',
                }}
              >
                Top skill: {truncate(topSkill, 30)}{topSkillRating ? ` (${parseFloat(topSkillRating).toFixed(1)})` : ''}
              </div>
            )}
            {forecastImpact && (
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 400,
                  color: 'rgba(91,184,255,0.9)',
                  display: 'flex',
                }}
              >
                Forecast impact: {truncate(forecastImpact, 40)}
              </div>
            )}
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
