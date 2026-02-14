import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

function renderFallback() {
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
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: '#ffffff',
            display: 'flex',
          }}
        >
          Live Surf Cams
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 28,
            color: 'rgba(255,255,255,0.7)',
            display: 'flex',
          }}
        >
          Live cameras across California, Hawaii, Florida & more
        </div>
        <div
          style={{
            marginTop: 48,
            fontSize: 36,
            fontWeight: 700,
            color: '#ffffff',
            display: 'flex',
          }}
        >
          Quiver
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
  response.headers.set('Cache-Control', 'public, max-age=86400');
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get('region');
  const name = searchParams.get('name');

  try {
    // Use region-specific title if provided, otherwise use default
    const mainHeading = name || 'Live Surf Cams';
    const subtitle = name
      ? `Live cameras across ${name}`
      : 'Live cameras across California, Hawaii, Florida & more';

    const response = new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '60px 72px',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            position: 'relative',
          }}
        >
          {/* Wave decoration top-right */}
          <svg
            width="200"
            height="120"
            viewBox="0 0 200 120"
            style={{ position: 'absolute', top: 20, right: 30, opacity: 0.12, display: 'flex' }}
          >
            <path
              d="M0 60c20-20 40 0 60-20s40 0 60-20 40 0 60-20 40 0 60-20"
              stroke="white"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M0 90c20-20 40 0 60-20s40 0 60-20 40 0 60-20 40 0 60-20"
              stroke="white"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
            />
          </svg>

          {/* Top content */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: 62,
                fontWeight: 800,
                color: '#ffffff',
                lineHeight: 1.1,
                display: 'flex',
                maxWidth: 900,
              }}
            >
              {mainHeading}
            </div>

            <div
              style={{
                marginTop: 24,
                fontSize: 28,
                color: 'rgba(255,255,255,0.7)',
                display: 'flex',
                maxWidth: 900,
              }}
            >
              {subtitle}
            </div>

          </div>

          {/* Bottom section */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Accent line */}
            <div
              style={{
                width: 80,
                height: 3,
                backgroundColor: '#f97316',
                marginBottom: 28,
                display: 'flex',
              }}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
              }}
            >
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: '#ffffff',
                  display: 'flex',
                }}
              >
                Quiver
              </div>
              <div
                style={{
                  fontSize: 22,
                  color: 'rgba(255,255,255,0.55)',
                  display: 'flex',
                }}
              >
                quiversurf.app
              </div>
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
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
