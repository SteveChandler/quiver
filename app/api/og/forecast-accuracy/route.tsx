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
  response.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  return response;
}

export async function GET(_request: NextRequest) {
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

          {/* Top: Quiver wordmark */}
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

          {/* Center: main heading and subtitle */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: 36,
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: 1.2,
                display: 'flex',
                maxWidth: 900,
              }}
            >
              Surf Forecast Accuracy Report
            </div>
            <div
              style={{
                marginTop: 16,
                fontSize: 24,
                color: 'rgba(255,255,255,0.7)',
                display: 'flex',
              }}
            >
              ML-Corrected Predictions vs NOAA Baseline
            </div>
          </div>

          {/* Bottom section */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Accent line */}
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
                Forecast Accuracy
              </div>
              <div
                style={{
                  fontSize: 22,
                  color: '#F78E42',
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
