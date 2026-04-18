/**
 * @jest-environment node
 */

import type { EmailTokenPayload } from '@/lib/utils/email-token';

// Mock next/cache
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

// Mock email token utils
jest.mock('@/lib/utils/email-token', () => ({
  verifyEmailToken: jest.fn(),
  getEmailTokenSecret: jest.fn(),
}));

// Mock Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn(),
}));

/**
 * Helper to create a chainable Supabase query mock
 */
function createThenableQuery<T>(result: {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number | null;
}) {
  const self: any = {};

  self.select = jest.fn((_sel?: any, _opts?: any) => self);
  self.eq = jest.fn((_field?: any, _value?: any) => self);
  self.ilike = jest.fn((_field?: any, _value?: any) => self);
  self.in = jest.fn((_field?: any, _values?: any) => self);
  self.gte = jest.fn((_field?: any, _value?: any) => self);
  self.lte = jest.fn((_field?: any, _value?: any) => self);
  self.order = jest.fn((_field?: any, _opts?: any) => self);
  self.limit = jest.fn((_n?: any) => self);
  self.single = jest.fn(() => Promise.resolve(result));
  self.upsert = jest.fn((_data?: any, _opts?: any) => Promise.resolve(result));
  self.update = jest.fn((_data?: any) => self);

  self.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(result).then(onFulfilled, onRejected);

  return self;
}

describe('home-beach actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('saveHomeBeach', () => {
    it('should return error when EMAIL_TOKEN_SECRET is not configured', async () => {
      const { getEmailTokenSecret } = await import('@/lib/utils/email-token');
      (getEmailTokenSecret as jest.Mock).mockImplementation(() => {
        throw new Error('EMAIL_TOKEN_SECRET environment variable is not set');
      });

      const { saveHomeBeach } = await import('@/app/prefs/home-beach/actions');
      const result = await saveHomeBeach('some-token', 'beach-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email system not configured');
    });

    it('should return error when token is invalid', async () => {
      const { getEmailTokenSecret, verifyEmailToken } = await import(
        '@/lib/utils/email-token'
      );
      (getEmailTokenSecret as jest.Mock).mockReturnValue('test-secret');
      (verifyEmailToken as jest.Mock).mockResolvedValue(null);

      const { saveHomeBeach } = await import('@/app/prefs/home-beach/actions');
      const result = await saveHomeBeach('invalid-token', 'beach-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired link');
    });

    it('should return error when token purpose is not prefs', async () => {
      const { getEmailTokenSecret, verifyEmailToken } = await import(
        '@/lib/utils/email-token'
      );
      (getEmailTokenSecret as jest.Mock).mockReturnValue('test-secret');
      (verifyEmailToken as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        purpose: 'save_window', // Wrong purpose
      } as EmailTokenPayload);

      const { saveHomeBeach } = await import('@/app/prefs/home-beach/actions');
      const result = await saveHomeBeach('wrong-purpose-token', 'beach-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired link');
    });

    it('should save home beach successfully with valid parameters', async () => {
      const { getEmailTokenSecret, verifyEmailToken } = await import(
        '@/lib/utils/email-token'
      );
      const { createSupabaseServerClient } = await import(
        '@/lib/supabase/server'
      );
      const { revalidatePath } = await import('next/cache');

      (getEmailTokenSecret as jest.Mock).mockReturnValue('test-secret');
      (verifyEmailToken as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        purpose: 'prefs',
      } as EmailTokenPayload);

      const mockQuery = createThenableQuery({ data: null, error: null });
      const mockSupabase = {
        from: jest.fn(() => mockQuery),
      };
      (createSupabaseServerClient as jest.Mock).mockReturnValue(mockSupabase);

      const { saveHomeBeach } = await import('@/app/prefs/home-beach/actions');
      const result = await saveHomeBeach('valid-token', 'beach-123');

      expect(result.success).toBe(true);
      expect(typeof result.error).toBe('undefined');
      // saveHomeBeach now writes to `profiles.home_beach_id` instead
      // of the dead `user_email_prefs` column. Plan:
      // abstract-exploring-phoenix cleanup.
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockQuery.update).toHaveBeenCalledWith({
        home_beach_id: 'beach-123',
      });
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'user-123');
      expect(revalidatePath).toHaveBeenCalledWith('/prefs/home-beach');
    });

    it('should return error when database upsert fails', async () => {
      const { getEmailTokenSecret, verifyEmailToken } = await import(
        '@/lib/utils/email-token'
      );
      const { createSupabaseServerClient } = await import(
        '@/lib/supabase/server'
      );

      (getEmailTokenSecret as jest.Mock).mockReturnValue('test-secret');
      (verifyEmailToken as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        purpose: 'prefs',
      } as EmailTokenPayload);

      const mockQuery = createThenableQuery({
        data: null,
        error: { message: 'Database error', code: '42000' },
      });
      const mockSupabase = {
        from: jest.fn(() => mockQuery),
      };
      (createSupabaseServerClient as jest.Mock).mockReturnValue(mockSupabase);

      // Suppress console.error for this test
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const { saveHomeBeach } = await import('@/app/prefs/home-beach/actions');
      const result = await saveHomeBeach('valid-token', 'beach-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to save. Please try again.');

      consoleErrorSpy.mockRestore();
    });

    it('should handle empty token', async () => {
      const { getEmailTokenSecret, verifyEmailToken } = await import(
        '@/lib/utils/email-token'
      );
      (getEmailTokenSecret as jest.Mock).mockReturnValue('test-secret');
      (verifyEmailToken as jest.Mock).mockResolvedValue(null);

      const { saveHomeBeach } = await import('@/app/prefs/home-beach/actions');
      const result = await saveHomeBeach('', 'beach-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing authentication token');
    });
  });

  describe('searchBeaches', () => {
    it('should return empty array for empty query', async () => {
      const { createSupabaseServerClient } = await import(
        '@/lib/supabase/server'
      );

      const mockQuery = createThenableQuery({ data: [], error: null });
      const mockSupabase = {
        from: jest.fn(() => mockQuery),
      };
      (createSupabaseServerClient as jest.Mock).mockReturnValue(mockSupabase);

      const { searchBeaches } = await import('@/app/prefs/home-beach/actions');
      const result = await searchBeaches('');

      expect(result).toEqual([]);
    });

    it('should search beaches by name with ilike pattern', async () => {
      const { createSupabaseServerClient } = await import(
        '@/lib/supabase/server'
      );

      const mockBeaches = [
        { id: 'b1', name: 'La Jolla Shores', city: 'La Jolla', state: 'CA', country: 'USA' },
        { id: 'b2', name: 'La Jolla Cove', city: 'La Jolla', state: 'CA', country: 'USA' },
      ];

      const mockQuery = createThenableQuery({ data: mockBeaches, error: null });
      const mockSupabase = {
        from: jest.fn(() => mockQuery),
      };
      (createSupabaseServerClient as jest.Mock).mockReturnValue(mockSupabase);

      const { searchBeaches } = await import('@/app/prefs/home-beach/actions');
      const result = await searchBeaches('La Jolla');

      expect(result).toEqual(mockBeaches);
      expect(mockSupabase.from).toHaveBeenCalledWith('beaches');
      expect(mockQuery.select).toHaveBeenCalledWith(
        'id, name, city, state, country'
      );
      expect(mockQuery.ilike).toHaveBeenCalledWith('name', '%La Jolla%');
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
    });

    it('should respect custom limit parameter', async () => {
      const { createSupabaseServerClient } = await import(
        '@/lib/supabase/server'
      );

      const mockQuery = createThenableQuery({ data: [], error: null });
      const mockSupabase = {
        from: jest.fn(() => mockQuery),
      };
      (createSupabaseServerClient as jest.Mock).mockReturnValue(mockSupabase);

      const { searchBeaches } = await import('@/app/prefs/home-beach/actions');
      await searchBeaches('beach', 5);

      expect(mockQuery.limit).toHaveBeenCalledWith(5);
    });

    it('should return empty array on database error', async () => {
      const { createSupabaseServerClient } = await import(
        '@/lib/supabase/server'
      );

      const mockQuery = createThenableQuery({
        data: null,
        error: { message: 'Database connection failed' },
      });
      const mockSupabase = {
        from: jest.fn(() => mockQuery),
      };
      (createSupabaseServerClient as jest.Mock).mockReturnValue(mockSupabase);

      // Suppress console.error for this test
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const { searchBeaches } = await import('@/app/prefs/home-beach/actions');
      const result = await searchBeaches('test');

      expect(result).toEqual([]);

      consoleErrorSpy.mockRestore();
    });

    it('should return empty array when data is null', async () => {
      const { createSupabaseServerClient } = await import(
        '@/lib/supabase/server'
      );

      const mockQuery = createThenableQuery({ data: null, error: null });
      const mockSupabase = {
        from: jest.fn(() => mockQuery),
      };
      (createSupabaseServerClient as jest.Mock).mockReturnValue(mockSupabase);

      const { searchBeaches } = await import('@/app/prefs/home-beach/actions');
      const result = await searchBeaches('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('getNearbyBeaches', () => {
    it('should call PostGIS RPC with correct parameters', async () => {
      const { createSupabaseServerClient } = await import(
        '@/lib/supabase/server'
      );

      const mockBeaches = [
        { id: 'b1', name: 'Nearby Beach 1', location: 'San Diego, CA' },
        { id: 'b2', name: 'Nearby Beach 2', location: 'La Jolla, CA' },
      ];

      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({ data: mockBeaches, error: null }),
        from: jest.fn(() =>
          createThenableQuery({ data: [], error: null })
        ),
      };
      (createSupabaseServerClient as jest.Mock).mockReturnValue(mockSupabase);

      const { getNearbyBeaches } = await import(
        '@/app/prefs/home-beach/actions'
      );
      const result = await getNearbyBeaches(32.7157, -117.1611);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_nearby_beaches', {
        input_lat: 32.7157,
        input_lng: -117.1611,
        limit_count: 5,
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('b1');
      expect(result[0].name).toBe('Nearby Beach 1');
    });

    it('should respect custom limit parameter', async () => {
      const { createSupabaseServerClient } = await import(
        '@/lib/supabase/server'
      );

      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
        from: jest.fn(() =>
          createThenableQuery({ data: [], error: null })
        ),
      };
      (createSupabaseServerClient as jest.Mock).mockReturnValue(mockSupabase);

      const { getNearbyBeaches } = await import(
        '@/app/prefs/home-beach/actions'
      );
      await getNearbyBeaches(32.7157, -117.1611, 10);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_nearby_beaches', {
        input_lat: 32.7157,
        input_lng: -117.1611,
        limit_count: 10,
      });
    });

    it('should fall back to popular San Diego beaches on RPC error', async () => {
      const { createSupabaseServerClient } = await import(
        '@/lib/supabase/server'
      );

      const fallbackBeaches = [
        { id: 'fb1', name: 'La Jolla Shores', city: 'La Jolla', state: 'CA', country: 'USA' },
        { id: 'fb2', name: 'Scripps', city: 'La Jolla', state: 'CA', country: 'USA' },
      ];

      const mockQuery = createThenableQuery({
        data: fallbackBeaches,
        error: null,
      });
      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'RPC function not found' },
        }),
        from: jest.fn(() => mockQuery),
      };
      (createSupabaseServerClient as jest.Mock).mockReturnValue(mockSupabase);

      // Suppress console.error for this test
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const { getNearbyBeaches } = await import(
        '@/app/prefs/home-beach/actions'
      );
      const result = await getNearbyBeaches(32.7157, -117.1611);

      expect(result).toEqual(fallbackBeaches);
      expect(mockSupabase.from).toHaveBeenCalledWith('beaches');
      expect(mockQuery.in).toHaveBeenCalledWith('name', [
        'La Jolla Shores',
        'Scripps',
        'Blacks Beach',
        'Pacific Beach',
        'Ocean Beach',
      ]);

      consoleErrorSpy.mockRestore();
    });

    it('should map RPC result to Beach interface correctly', async () => {
      const { createSupabaseServerClient } = await import(
        '@/lib/supabase/server'
      );

      const rpcResult = [
        { id: 'b1', name: 'Beach One', location: 'San Diego, CA' },
        { id: 'b2', name: 'Beach Two', location: 'La Jolla, CA' },
      ];

      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({ data: rpcResult, error: null }),
        from: jest.fn(() =>
          createThenableQuery({ data: [], error: null })
        ),
      };
      (createSupabaseServerClient as jest.Mock).mockReturnValue(mockSupabase);

      const { getNearbyBeaches } = await import(
        '@/app/prefs/home-beach/actions'
      );
      const result = await getNearbyBeaches(32.7157, -117.1611);

      expect(result).toEqual([
        { id: 'b1', name: 'Beach One', city: null, state: null, country: null },
        { id: 'b2', name: 'Beach Two', city: null, state: null, country: null },
      ]);
    });

    it('should handle null data from RPC', async () => {
      const { createSupabaseServerClient } = await import(
        '@/lib/supabase/server'
      );

      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
        from: jest.fn(() =>
          createThenableQuery({ data: [], error: null })
        ),
      };
      (createSupabaseServerClient as jest.Mock).mockReturnValue(mockSupabase);

      const { getNearbyBeaches } = await import(
        '@/app/prefs/home-beach/actions'
      );
      const result = await getNearbyBeaches(32.7157, -117.1611);

      expect(result).toEqual([]);
    });
  });

  describe('getPopularBeaches', () => {
    it('should return popular San Diego beaches', async () => {
      const { createSupabaseServerClient } = await import(
        '@/lib/supabase/server'
      );

      const popularBeaches = [
        { id: 'p1', name: 'La Jolla Shores', city: 'La Jolla', state: 'CA', country: 'USA' },
        { id: 'p2', name: 'Scripps', city: 'La Jolla', state: 'CA', country: 'USA' },
        { id: 'p3', name: 'Blacks Beach', city: 'La Jolla', state: 'CA', country: 'USA' },
      ];

      const mockQuery = createThenableQuery({
        data: popularBeaches,
        error: null,
      });
      const mockSupabase = {
        from: jest.fn(() => mockQuery),
      };
      (createSupabaseServerClient as jest.Mock).mockReturnValue(mockSupabase);

      const { getPopularBeaches } = await import(
        '@/app/prefs/home-beach/actions'
      );
      const result = await getPopularBeaches();

      expect(result).toEqual(popularBeaches);
      expect(mockSupabase.from).toHaveBeenCalledWith('beaches');
      expect(mockQuery.select).toHaveBeenCalledWith(
        'id, name, city, state, country'
      );
      expect(mockQuery.in).toHaveBeenCalledWith('name', [
        'La Jolla Shores',
        'Scripps',
        'Blacks Beach',
        'Pacific Beach',
        'Ocean Beach',
      ]);
      expect(mockQuery.limit).toHaveBeenCalledWith(5);
    });

    it('should respect custom limit parameter', async () => {
      const { createSupabaseServerClient } = await import(
        '@/lib/supabase/server'
      );

      const mockQuery = createThenableQuery({ data: [], error: null });
      const mockSupabase = {
        from: jest.fn(() => mockQuery),
      };
      (createSupabaseServerClient as jest.Mock).mockReturnValue(mockSupabase);

      const { getPopularBeaches } = await import(
        '@/app/prefs/home-beach/actions'
      );
      await getPopularBeaches(3);

      expect(mockQuery.limit).toHaveBeenCalledWith(3);
    });

    it('should return empty array on database error', async () => {
      const { createSupabaseServerClient } = await import(
        '@/lib/supabase/server'
      );

      const mockQuery = createThenableQuery({
        data: null,
        error: { message: 'Connection timeout' },
      });
      const mockSupabase = {
        from: jest.fn(() => mockQuery),
      };
      (createSupabaseServerClient as jest.Mock).mockReturnValue(mockSupabase);

      // Suppress console.error for this test
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const { getPopularBeaches } = await import(
        '@/app/prefs/home-beach/actions'
      );
      const result = await getPopularBeaches();

      expect(result).toEqual([]);

      consoleErrorSpy.mockRestore();
    });

    it('should return empty array when data is null', async () => {
      const { createSupabaseServerClient } = await import(
        '@/lib/supabase/server'
      );

      const mockQuery = createThenableQuery({ data: null, error: null });
      const mockSupabase = {
        from: jest.fn(() => mockQuery),
      };
      (createSupabaseServerClient as jest.Mock).mockReturnValue(mockSupabase);

      const { getPopularBeaches } = await import(
        '@/app/prefs/home-beach/actions'
      );
      const result = await getPopularBeaches();

      expect(result).toEqual([]);
    });
  });
});
