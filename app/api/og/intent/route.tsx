import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const INTENT_LABELS: Record<string, string> = {
  "beginner": "Beginner Spots",
  "least-crowded": "Least Crowded Spots",
  "tide": "Tide Conditions",
  "water-temp": "Water Temperature",
  "longboard": "Longboard Spots",
  "dawn-patrol": "Dawn Patrol",
  "sunset": "Sunset Sessions",
};

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
          Quiver
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 28,
            color: 'rgba(255,255,255,0.7)',
            display: 'flex',
          }}
        >
          Surf Forecasts & Conditions
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 22,
            color: '#F78E42',
            display: 'flex',
          }}
        >
          quiversurf.app
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
  response.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const intent = searchParams.get('intent');
  const city = searchParams.get('city');
  const countRaw = searchParams.get('count');

  // Validate required params: present, reasonable length, safe characters
  const SAFE_PARAM_RE = /^[a-zA-Z0-9 \-]+$/;
  if (
    !intent || intent.length > 200 || !SAFE_PARAM_RE.test(intent) ||
    !city || city.length > 200 || !/^[a-zA-Z0-9 ,.\-']+$/.test(city)
  ) {
    return renderFallback();
  }

  const intentLabel = INTENT_LABELS[intent] ?? (
    // Capitalize each word of unknown intent slugs
    intent.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );

  const count = countRaw && /^\d{1,6}$/.test(countRaw) ? parseInt(countRaw, 10) : null;

  try {
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
            {/* Small orange label */}
            <div
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: '#F78E42',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                display: 'flex',
                marginBottom: 20,
              }}
            >
              Surf Guide
            </div>

            {/* Main intent label */}
            <div
              style={{
                fontSize: 64,
                fontWeight: 800,
                color: '#ffffff',
                lineHeight: 1.1,
                display: 'flex',
                maxWidth: 900,
              }}
            >
              {intentLabel}
            </div>

            {/* City name */}
            <div
              style={{
                marginTop: 16,
                fontSize: 32,
                color: 'rgba(255,255,255,0.75)',
                display: 'flex',
              }}
            >
              {city}
            </div>

            {/* Spot count badge */}
            {count !== null && (
              <div
                style={{
                  marginTop: 24,
                  display: 'flex',
                }}
              >
                <div
                  style={{
                    padding: '8px 18px',
                    borderRadius: 8,
                    backgroundColor: 'rgba(249, 115, 22, 0.15)',
                    border: '1px solid rgba(249, 115, 22, 0.4)',
                    fontSize: 20,
                    color: '#F78E42',
                    fontWeight: 500,
                    display: 'flex',
                  }}
                >
                  {count} spots
                </div>
              </div>
            )}
          </div>

          {/* Bottom section */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Orange accent line */}
            <div
              style={{
                width: 80,
                height: 3,
                backgroundColor: '#F78E42',
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
