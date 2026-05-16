import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { remoteImageUrlOrFallback } from '@/lib/share/remote-image-url';

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
  const footer = searchParams.get('footer') || 'Logged on Quiver';
  const bg = remoteImageUrlOrFallback(searchParams.get('bg'), DEFAULT_BG);

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
        fill={filled ? '#FDB84B' : 'rgba(245,238,220,0.3)'}
      />
    </svg>
  );

  // Generate star display
  const starDisplay = Array.from({ length: 5 }, (_, i) => (
    <Star key={i} filled={i < clampedStars} sizePx={28} />
  ));

  const displayBeach = truncate(beach, 30);
  const displayTagline = truncate(tagline, 48);
  const displayDate = date ? truncate(date, 34) : '';
  const displayFooter = truncate(footer, 42);
  const displayRating = truncate(rating.toUpperCase(), 16);
  const displaySize = truncate(size, 24);
  const displayBoard = truncate(board, 34);

  const showWind = Boolean(windLabel || windSpeed);
  const windText = [windLabel, windSpeed].filter(Boolean).join(' • ');
  const displayWindText = truncate(windText, 30);

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
              'linear-gradient(180deg, rgba(13,16,32,0.5) 0%, rgba(37,45,107,0.06) 36%, rgba(13,16,32,0.9) 100%)',
            display: 'flex',
          }}
        />

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 720,
            background: 'linear-gradient(180deg, rgba(13,16,32,0) 0%, rgba(37,45,107,0.92) 100%)',
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
            justifyContent: 'space-between',
            padding: 72,
          }}
        >
          {/* Top */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 18,
                padding: '12px 18px',
                border: '2px solid rgba(245,238,220,0.42)',
                backgroundColor: 'rgba(37,45,107,0.76)',
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  width: 58,
                  height: 58,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#F78E42',
                  borderRadius: '12px 4px 14px 6px',
                }}
              >
                <span
                  style={{
                    color: '#252D6B',
                    fontSize: 36,
                    fontWeight: 800,
                    display: 'flex',
                  }}
                >
                  Q
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{
                    fontSize: 38,
                    fontWeight: 800,
                    color: '#F5EEDC',
                    letterSpacing: 0,
                    lineHeight: 1,
                    display: 'flex',
                  }}
                >
                  QUIVER
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 22,
                    fontWeight: 700,
                    color: '#FDB84B',
                    letterSpacing: 0,
                    display: 'flex',
                  }}
                >
                  SESSION LOG
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                padding: '14px 18px',
                borderRadius: 8,
                backgroundColor: 'rgba(13,16,32,0.68)',
                border: '2px solid rgba(247,142,66,0.65)',
                color: '#F5EEDC',
                fontSize: 26,
                fontWeight: 700,
                fontFamily: 'SpaceGrotesk, system-ui, sans-serif',
              }}
            >
              {displayDate || 'SURF SESSION'}
            </div>
          </div>

          {/* Bottom */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 24,
                gap: 18,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '14px 22px',
                  backgroundColor: '#F78E42',
                  borderRadius: '12px 4px 14px 6px',
                  transform: 'rotate(-1deg)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>{starDisplay}</div>
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 32,
                    fontWeight: 800,
                    color: '#252D6B',
                    display: 'flex',
                  }}
                >
                  {displayRating}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '13px 22px',
                  backgroundColor: 'rgba(0,212,170,0.92)',
                  borderRadius: '6px 14px 4px 12px',
                  transform: 'rotate(1deg)',
                }}
              >
                <WaveIcon />
                <span
                  style={{
                    fontSize: 32,
                    fontWeight: 800,
                    color: '#252D6B',
                    display: 'flex',
                  }}
                >
                  {displaySize}
                </span>
              </div>

              {showWind && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '13px 20px',
                    backgroundColor: 'rgba(37,45,107,0.86)',
                    border: '2px solid rgba(245,238,220,0.42)',
                    borderRadius: 8,
                  }}
                >
                  <WindIcon />
                  <span
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                      color: '#F5EEDC',
                      display: 'flex',
                    }}
                  >
                    {displayWindText}
                  </span>
                </div>
              )}
            </div>

            <div
              style={{
                fontSize: 118,
                fontWeight: 800,
                letterSpacing: 0,
                color: '#F5EEDC',
                textShadow: '0 8px 30px rgba(0,0,0,0.55)',
                lineHeight: 0.96,
                maxWidth: 940,
                display: 'flex',
                fontFamily: 'SpaceGrotesk, system-ui, sans-serif',
              }}
            >
              {displayBeach}
            </div>

            {displayTagline && (
              <div
                style={{
                  marginTop: 26,
                  maxWidth: 880,
                  fontSize: 38,
                  fontWeight: 700,
                  color: 'rgba(245,238,220,0.9)',
                  lineHeight: 1.2,
                  display: 'flex',
                }}
              >
                {displayTagline}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 42,
                paddingTop: 26,
                borderTop: '2px solid rgba(245,238,220,0.28)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {displayBoard && (
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 700,
                      color: '#FDB84B',
                      display: 'flex',
                    }}
                  >
                    {displayBoard}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: 'rgba(245,238,220,0.86)',
                    display: 'flex',
                  }}
                >
                  {displayFooter}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: '#00D4AA',
                    display: 'flex',
                  }}
                />
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 800,
                    color: '#F5EEDC',
                    display: 'flex',
                  }}
                >
                  quiversurf.app
                </div>
              </div>
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
