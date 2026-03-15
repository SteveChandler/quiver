import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const DEFAULT_BG = 'https://quiversurf.app/images/og-location-default.jpg';

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
          background: 'linear-gradient(180deg, #1E2558 0%, #252D6B 100%)',
          fontFamily: 'SpaceGrotesk, system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 800, color: '#FFFFFF', display: 'flex', fontFamily: 'SpaceGrotesk, system-ui, sans-serif' }}>
          Quiver
        </div>
        <div style={{ fontSize: 42, fontWeight: 500, color: 'rgba(255,255,255,0.8)', marginTop: 24, display: 'flex' }}>
          Surf Session
        </div>
      </div>
    ),
    { width: 1080, height: 1920 }
  );
}

export async function GET(request: NextRequest) {
  try {
  const spaceGroteskData = await fetch(
    new URL('/fonts/SpaceGrotesk/SpaceGrotesk-Bold.ttf',
      process.env.NODE_ENV === 'production'
        ? process.env.NEXT_PUBLIC_APP_URL || 'https://quiversurf.app'
        : `${new URL(request.url).protocol}//${new URL(request.url).host}`
    )
  ).then(res => res.arrayBuffer());

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
    beach.length > 28 ? beach.substring(0, 25) + '...' : beach;

  const displayTagline = truncate(tagline, 56);
  const displayDate = date ? truncate(date, 34) : '';

  const showWind = Boolean(windLabel || windSpeed);
  const windText = [windLabel, windSpeed].filter(Boolean).join(' • ');

  const response = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          fontFamily: 'SpaceGrotesk, system-ui, sans-serif',
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

        {/* Brand-tinted overlay for legibility */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              'linear-gradient(180deg, rgba(37,45,107,0.75) 0%, rgba(37,45,107,0.15) 40%, rgba(30,37,88,0.65) 100%)',
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
                marginTop: 10,
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
                fontFamily: 'SpaceGrotesk, system-ui, sans-serif',
              }}
            >
              {displayBeach}
            </div>

            {displayDate && (
              <div
                style={{
                  marginTop: 16,
                  fontSize: 44,
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
                marginTop: 20,
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

            {/* Sticker-style condition badges */}
            <div
              style={{
                marginTop: 38,
                display: 'flex',
                alignItems: 'center',
                gap: 20,
              }}
            >
              {/* Wave size badge */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '16px 28px',
                backgroundColor: 'rgba(247,142,66,0.9)',
                borderRadius: '14px 16px 13px 15px',
                transform: 'rotate(-1.5deg)',
                fontFamily: 'SpaceGrotesk, system-ui, sans-serif',
              }}>
                <WaveIcon />
                <span style={{ fontSize: 38, fontWeight: 700, color: '#FFFFFF', display: 'flex' }}>{size}</span>
              </div>

              {/* Wind badge */}
              {showWind && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '16px 28px',
                  backgroundColor: 'rgba(37,45,107,0.85)',
                  border: '2px solid rgba(247,142,66,0.6)',
                  borderRadius: '13px 15px 14px 16px',
                  transform: 'rotate(1deg)',
                  fontFamily: 'SpaceGrotesk, system-ui, sans-serif',
                }}>
                  <WindIcon />
                  <span style={{ fontSize: 38, fontWeight: 700, color: '#FFFFFF', display: 'flex' }}>{windText}</span>
                </div>
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
                  fontSize: 28,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.85)',
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '10px 12px 11px 13px',
                  padding: '10px 20px',
                  marginBottom: 18,
                  display: 'flex',
                }}
              >
                {truncate(board, 34)}
              </div>
            )}

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
                  fontFamily: 'SpaceGrotesk, system-ui, sans-serif',
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
      fonts: [
        {
          name: 'SpaceGrotesk',
          data: spaceGroteskData,
          weight: 700,
          style: 'normal',
        },
      ],
    }
  );
  response.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
  return response;
  } catch {
    return renderFallback();
  }
}
