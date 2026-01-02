import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const size = searchParams.get('size') || '3-5ft';
  const desc = searchParams.get('desc') || 'Check the forecast';

  // Get base URL for image - use request origin in development
  const url = new URL(request.url);
  const baseUrl = process.env.NODE_ENV === 'production'
    ? (process.env.NEXT_PUBLIC_APP_URL || 'https://quiversurf.app')
    : `${url.protocol}//${url.host}`;

  // Truncate description if too long
  const displayDesc = desc.length > 60 ? desc.substring(0, 57) + '...' : desc;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Background wave image */}
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og ImageResponse requires raw img tags */}
        <img
          src={`${baseUrl}/surfer-wave-sample.png`}
          alt=""
          width={1080}
          height={1920}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />

        {/* Gradient overlay for text readability */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.4) 100%)',
            display: 'flex',
          }}
        />

        {/* Main content container */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 80,
            gap: 32,
            position: 'relative',
          }}
        >
          {/* Wave size - hero text */}
          <div
            style={{
              fontSize: 180,
              fontWeight: 800,
              color: '#FFFFFF',
              textShadow: '0 4px 24px rgba(0,0,0,0.5)',
              letterSpacing: '-0.02em',
              display: 'flex',
            }}
          >
            {size}
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: 48,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.95)',
              textShadow: '0 2px 12px rgba(0,0,0,0.5)',
              textAlign: 'center',
              maxWidth: 900,
              lineHeight: 1.3,
              display: 'flex',
            }}
          >
            {displayDesc}
          </div>
        </div>

        {/* Bottom branding */}
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              backgroundColor: 'rgba(255,255,255,0.25)',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: '#FFFFFF',
                display: 'flex',
              }}
            >
              Q
            </span>
          </div>
          <span
            style={{
              fontSize: 32,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.95)',
              textShadow: '0 2px 8px rgba(0,0,0,0.4)',
              display: 'flex',
            }}
          >
            quiversurf.app
          </span>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
    }
  );
}
