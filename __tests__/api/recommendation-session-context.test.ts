/** @jest-environment node */

import { NextRequest } from 'next/server';

if (typeof (globalThis as any).Response?.json !== 'function') {
  (globalThis as any).Response.json = (data: any, init?: ResponseInit) =>
    new Response(JSON.stringify(data), {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers || {}),
      },
    });
}

const mockUser = { id: 'user-1' };
const upsertSpy = jest.fn();
let mockSessionOwner: string | null = 'user-1';
let upsertError: { message: string } | null = null;

function buildSupabase() {
  return {
    from(table: string) {
      if (table === 'sessions') {
        return {
          select() {
            return {
              eq(_col: string, _val: string) {
                return {
                  eq(_col2: string, val2: string) {
                    return {
                      maybeSingle: async () => ({
                        data: mockSessionOwner === val2
                          ? { id: 'session-1', user_id: val2 }
                          : null,
                        error: null,
                      }),
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === 'recommendation_session_contexts') {
        return {
          upsert(payload: Record<string, unknown>, options: Record<string, unknown>) {
            upsertSpy(payload, options);
            return Promise.resolve({ data: null, error: upsertError });
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

jest.mock('@/lib/middleware/api-wrappers', () => ({
  withAuth: (handler: any) => (request: NextRequest) =>
    handler(request, { user: mockUser, supabase: buildSupabase() }),
}));

import { POST } from '@/app/api/recommendations/session-context/route';

const payload = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  recommendationId: 'rec-1',
  sourceSurface: 'home_also_worth_it',
  beachId: '22222222-2222-4222-8222-222222222222',
  beachName: 'HB Pier',
  windowStart: '2026-05-31T15:00:00.000Z',
  windowEnd: '2026-05-31T17:00:00.000Z',
  forecastAt: '2026-05-31T15:00:00.000Z',
  conditionScore: 82,
  personalMatchScore: 7.8,
  overallScore: 88,
  reasonType: 'session_history',
  recommendationState: 'future_fallback',
  rankingPosition: 2,
  fallbackHorizonHours: 72,
};

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/recommendations/session-context', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('/api/recommendations/session-context', () => {
  beforeEach(() => {
    upsertSpy.mockClear();
    mockSessionOwner = 'user-1';
    upsertError = null;
  });

  it('persists recommendation attribution for the owning user session', async () => {
    const response = await POST(request(payload));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        session_id: payload.sessionId,
        recommendation_id: 'rec-1',
        source_surface: 'home_also_worth_it',
        recommendation_state: 'future_fallback',
        fallback_horizon_hours: 72,
      }),
      { onConflict: 'user_id,session_id,recommendation_id' },
    );
  });

  it('rejects context for sessions the user does not own', async () => {
    mockSessionOwner = 'another-user';
    const response = await POST(request(payload));

    expect(response.status).toBe(404);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('rejects malformed attribution payloads', async () => {
    const response = await POST(request({ ...payload, recommendationId: '' }));

    expect(response.status).toBe(400);
    expect(upsertSpy).not.toHaveBeenCalled();
  });
});
