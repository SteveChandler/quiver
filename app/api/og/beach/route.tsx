import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

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
            color: '#f97316',
            display: 'flex',
          }}
        >
          quiversurf.app
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug || slug.length > 200 || !/^[a-z0-9-]+$/.test(slug)) {
    return renderFallback();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return renderFallback();
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: beach } = await supabase
      .from('beaches')
      .select('name, city, state, average_rating, review_count, break_type')
      .eq('slug', slug)
      .limit(1)
      .single();

    if (!beach) {
      return renderFallback();
    }

    const name = beach.name || 'Beach';
    const location = [beach.city, beach.state].filter(Boolean).join(', ');
    const ratingNum = beach.average_rating ? Number(beach.average_rating) : null;
    const rating = ratingNum?.toFixed(1) ?? null;
    const reviewCount = beach.review_count ?? 0;
    const breakType = beach.break_type || null;
    const clampedStars = ratingNum ? Math.round(ratingNum) : 0;

    const Star = ({ filled }: { filled: boolean }) => (
      <svg width={28} height={28} viewBox="0 0 24 24" style={{ marginRight: 3, display: 'flex' }}>
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill={filled ? '#FFD700' : 'rgba(255,255,255,0.25)'}
        />
      </svg>
    );

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
                fontSize: 52,
                fontWeight: 800,
                color: '#ffffff',
                lineHeight: 1.1,
                display: 'flex',
                maxWidth: 900,
              }}
            >
              {name}
            </div>

            {location && (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 26,
                  color: 'rgba(255,255,255,0.65)',
                  display: 'flex',
                }}
              >
                {location}
              </div>
            )}

            {rating && (
              <div
                style={{
                  marginTop: 24,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} filled={i < clampedStars} />
                  ))}
                </div>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.9)',
                    display: 'flex',
                  }}
                >
                  {rating}
                </div>
                {reviewCount > 0 && (
                  <div
                    style={{
                      fontSize: 22,
                      color: 'rgba(255,255,255,0.5)',
                      display: 'flex',
                    }}
                  >
                    ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
                  </div>
                )}
              </div>
            )}

            {breakType && (
              <div
                style={{
                  marginTop: 20,
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
                    color: '#f97316',
                    fontWeight: 500,
                    display: 'flex',
                  }}
                >
                  {breakType}
                </div>
              </div>
            )}
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
