/** @jest-environment node */
import { generateMetadata } from '@/app/sessions/[id]/page';
import { buildSessionShareImageUrl } from '@/lib/share/session-share';
import type { SessionWithDetails } from '@/types/database';
import { getSessionMetadata } from '@/actions/session-actions';

jest.mock('@/components/session-detail-view', () => ({ SessionDetailView: () => null }));
jest.mock('@/components/seo/breadcrumb-schema', () => ({ BreadcrumbStructuredData: () => null }));
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn(async () => mockSupabase),
}));

const session = {
  id: 'public-session', is_public: true, beach_name: null,
  arrival_time: '2026-10-15T14:00:00Z', rating: 4, status: 'completed',
  image_url: null, beach: { name: 'Scripps' }, user: { full_name: 'Alex', display_name: 'Alex S' },
};
const mockSessionQuery = {
  select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
  single: jest.fn(async () => {
    const selection: string = mockSessionQuery.select.mock.calls.at(-1)?.[0] ?? '';
    // Model PostgREST's rejection of a missing relationship or column.
    if (selection.includes('profiles!sessions_user_id_fkey(')) {
      return { data: null, error: { message: 'Relationship not found' } };
    }
    if (/\busername\b/.test(selection)) {
      return { data: null, error: { message: 'profiles.username does not exist' } };
    }
    return { data: session, error: null };
  }),
};
const mockMediaQuery = {
  select: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(),
  order: jest.fn(async () => ({ data: [], error: null })),
};
const mockSupabase = {
  from: jest.fn((table: string) => table === 'sessions' ? mockSessionQuery : mockMediaQuery),
};

beforeEach(() => { jest.clearAllMocks(); });

test('loads a public session through the ordinary RLS client using valid schema fields', async () => {
  const result = await getSessionMetadata(session.id);
  expect(result.success).toBe(true);
  expect(result).toMatchObject({ data: { beach: { name: 'Scripps' }, user: { full_name: 'Alex' } } });
  const selection: string = mockSessionQuery.select.mock.calls[0][0];
  expect(selection).toContain('user:profiles');
  expect(selection).not.toMatch(/\busername\b|profiles!sessions_user_id_fkey\(/);
});

test('builds public share metadata with the surfer and beach', async () => {
  expect(() => buildSessionShareImageUrl(session as unknown as SessionWithDetails)).not.toThrow();
  const metadata = await generateMetadata({ params: Promise.resolve({ id: session.id }) });
  expect(metadata.openGraph?.title).toContain("Alex's surf session at Scripps");
  expect(metadata.description).toContain('Alex surfed at Scripps');
  expect(metadata.openGraph?.images).toEqual([expect.objectContaining({ url: expect.stringContaining('format=jpeg') })]);
});


test('keeps inaccessible sessions generic instead of bypassing RLS', async () => {
  mockSessionQuery.single.mockResolvedValueOnce({ data: null, error: { message: 'Session not found' } });
  const metadata = await generateMetadata({ params: Promise.resolve({ id: 'private-session' }) });
  expect(metadata.openGraph?.title).toBe('Surf Session');
  expect(metadata.description).not.toContain('Alex');
});
