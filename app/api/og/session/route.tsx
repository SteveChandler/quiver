import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const DEFAULT_BG = 'https://quiversurf.app/images/og-location-default.jpg';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const beach = searchParams.get('beach') || 'Unknown Beach';
  const rating = searchParams.get('rating') || 'Good';
  const stars = parseInt(searchParams.get('stars') || '4', 10);
  const size = searchParams.get('size') || 'Waist-Chest';
  const board = searchParams.get('board') || '';
  const date = searchParams.get('date') || '';
  const windLabel = searchParams.get('windLabel') || '';
  const windSpeed = searchParams.get('windSpeed') || '';
  const tagline = searchParams.get('tagline') || '';
  const footer = searchParams.get('footer') || '';
  const bg = searchParams.get('bg') || DEFAULT_BG;

  // Get base URL for local assets (logo) - use request origin in development
  const url = new URL(request.url);
  const baseUrl =
    process.env.NODE_ENV === 'production'
      ? process.env.NEXT_PUBLIC_APP_URL || 'https://quiversurf.app'
      : `${url.protocol}//${url.host}`;
  const logoSrc = `${baseUrl}/examples/surfboardLogo-notext.png`;

  const truncate = (value: string, max: number) => {
    if (!value) return '';
    return value.length > max
      ? value.substring(0, Math.max(0, max - 1)) + '…'
      : value;
  };

  // Clamp stars between 0 and 5
  const clampedStars = Math.max(0, Math.min(5, stars));

  // Simple SVG icons (more reliable than emoji in ImageResponse)
  const WaveIcon = () => (
    <svg
      width="34"
      height="34"
      viewBox="0 0 24 24"
      fill="none"
      style={{ marginRight: 10, display: 'flex' }}
    >
      <path
        d="M2 16c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"
        stroke="rgba(255,255,255,0.95)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 20c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const WindIcon = () => (
    <svg
      width="34"
      height="34"
      viewBox="0 0 24 24"
      fill="none"
      style={{ marginRight: 10, display: 'flex' }}
    >
      <path
        d="M3 8h12a3 3 0 1 0-3-3"
        stroke="rgba(255,255,255,0.95)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 12h16a3 3 0 1 1-3 3"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 16h9a2 2 0 1 0-2-2"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  // Star SVG component for reliable rendering
  const Star = ({ filled, sizePx = 30 }: { filled: boolean; sizePx?: number }) => (
    <svg
      width={sizePx}
      height={sizePx}
      viewBox="0 0 24 24"
      style={{ marginRight: 4, display: 'flex' }}
    >
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill={filled ? '#FFD700' : 'rgba(255,255,255,0.28)'}
      />
    </svg>
  );

  // Generate star display
  const starDisplay = Array.from({ length: 5 }, (_, i) => (
    <Star key={i} filled={i < clampedStars} sizePx={28} />
  ));

  // Truncate beach name if too long
  const displayBeach =
    beach.length > 22 ? beach.substring(0, 19) + '...' : beach;

  const displayTagline = truncate(tagline, 56);
  const displayFooter = truncate(
    footer || `Similar to your best ${displayBeach} sessions`,
    52
  );
  const displayDate = date ? truncate(date, 34) : '';

  const showWind = Boolean(windLabel || windSpeed);
  const windText = [windLabel, windSpeed].filter(Boolean).join(' • ');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
        }}
      >
        {/* Background Image - must use img for Satori/ImageResponse */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bg}
          alt=""
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />

        {/* Global overlay for legibility */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.18) 40%, rgba(0,0,0,0.55) 100%)',
            display: 'flex',
          }}
        />

        {/* Content */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 84,
          }}
        >
          {/* Top */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              style={{
                fontSize: 54,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.95)',
                textShadow: '0 2px 14px rgba(0,0,0,0.55)',
                marginTop: 10,
                display: 'flex',
              }}
            >
              Great Surf Session!
            </div>

            <div
              style={{
                marginTop: 34,
                fontSize: 132,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: '#FFFFFF',
                textShadow: '0 6px 28px rgba(0,0,0,0.6)',
                lineHeight: 1.05,
                maxWidth: 980,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'flex',
              }}
            >
              {displayBeach}
            </div>

            <div
              style={{
                marginTop: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>{starDisplay}</div>
              <div
                style={{
                  fontSize: 44,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.92)',
                  textShadow: '0 2px 12px rgba(0,0,0,0.5)',
                  display: 'flex',
                }}
              >
                {rating}
              </div>
            </div>

            {displayDate && (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 50,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.9)',
                  textShadow: '0 2px 10px rgba(0,0,0,0.45)',
                  display: 'flex',
                }}
              >
                {displayDate}
              </div>
            )}

            <div
              style={{
                marginTop: 38,
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                padding: '14px 24px',
                borderRadius: 16,
                backgroundColor: 'rgba(0,0,0,0.28)',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <WaveIcon />
              </div>
              <div
                style={{
                  fontSize: 38,
                  fontWeight: 600,
                  color: '#FFFFFF',
                  textShadow: '0 2px 10px rgba(0,0,0,0.45)',
                  display: 'flex',
                }}
              >
                {size}
              </div>

              {showWind && (
                <>
                  <div
                    style={{
                      fontSize: 38,
                      color: 'rgba(255,255,255,0.78)',
                      display: 'flex',
                      marginLeft: 2,
                      marginRight: 2,
                    }}
                  >
                    •
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <WindIcon />
                  </div>
                  <div
                    style={{
                      fontSize: 38,
                      fontWeight: 600,
                      color: '#FFFFFF',
                      textShadow: '0 2px 10px rgba(0,0,0,0.45)',
                      display: 'flex',
                    }}
                  >
                    {windText}
                  </div>
                </>
              )}
            </div>

            {displayTagline && (
              <div
                style={{
                  marginTop: 56,
                  fontSize: 48,
                  fontWeight: 500,
                  fontStyle: 'italic',
                  color: 'rgba(255,255,255,0.92)',
                  textShadow: '0 2px 14px rgba(0,0,0,0.55)',
                  textAlign: 'center',
                  maxWidth: 980,
                  display: 'flex',
                }}
              >
                {displayTagline}
              </div>
            )}
          </div>

          {/* Bottom */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {board && (
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.85)',
                  textShadow: '0 2px 10px rgba(0,0,0,0.45)',
                  marginBottom: 18,
                  display: 'flex',
                }}
              >
                {truncate(board, 34)}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                marginBottom: 30,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Star filled={true} sizePx={42} />
                <Star filled={true} sizePx={42} />
                <Star filled={true} sizePx={42} />
              </div>
              <div
                style={{
                  fontSize: 40,
                  fontWeight: 500,
                  fontStyle: 'italic',
                  color: 'rgba(255,255,255,0.92)',
                  textShadow: '0 2px 14px rgba(0,0,0,0.55)',
                  display: 'flex',
                }}
              >
                {displayFooter}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc}
                alt=""
                style={{
                  width: 68,
                  height: 68,
                  objectFit: 'contain',
                  opacity: 0.98,
                }}
              />
              <div
                style={{
                  fontSize: 74,
                  fontWeight: 800,
                  color: '#FFFFFF',
                  textShadow: '0 4px 18px rgba(0,0,0,0.55)',
                  letterSpacing: '-0.01em',
                  display: 'flex',
                }}
              >
                Quiver
              </div>
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 34,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.9)',
                textShadow: '0 2px 10px rgba(0,0,0,0.45)',
                letterSpacing: '0.02em',
                display: 'flex',
              }}
            >
              quiversurf.app
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
    }
  );
}
