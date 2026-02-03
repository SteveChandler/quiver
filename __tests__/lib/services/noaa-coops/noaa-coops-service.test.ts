/**
 * Tests for NOAA CO-OPS Service
 *
 * Focuses on fetchCachedTides functionality including:
 * - Happy path conversion from cached rows to TideData
 * - Empty cache handling
 * - Boundary extrema detection
 * - Plateau handling (no false positives)
 * - Fallback path behavior
 */

import { NOAACOOPSService } from '@/lib/services/noaa-coops/noaa-coops-service';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import * as Sentry from '@sentry/nextjs';

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  addBreadcrumb: jest.fn(),
}));

// Mock forecast logger
jest.mock('@/lib/monitoring/forecast-logger', () => ({
  isForecastVerboseLoggingEnabled: jest.fn(() => false),
}));

const mockSupabase = createSupabaseServiceRoleClient as jest.Mock;
const mockSentryBreadcrumb = Sentry.addBreadcrumb as jest.Mock;

describe('NOAACOOPSService', () => {
  let service: NOAACOOPSService;

  beforeEach(() => {
    service = new NOAACOOPSService();
    jest.clearAllMocks();
  });

  describe('fetchCachedTides', () => {
    const beachId = 'test-beach-uuid-123';

    // Helper to create mock Supabase query builder
    const createMockQueryBuilder = (data: unknown[] | null, error: Error | null = null) => {
      const builder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data, error }),
      };
      return builder;
    };

    describe('T1: Happy path - correct TideData array from cached rows', () => {
      it('should convert cached rows to TideData with detected extrema', async () => {
        // Simulate hourly data with a clear high-low-high pattern
        const now = new Date();
        const rows = [
          { ts: new Date(now.getTime() + 0 * 3600000).toISOString(), tide_height_m: 0.5, tide_phase: 'rising', source: 'noaa' },
          { ts: new Date(now.getTime() + 1 * 3600000).toISOString(), tide_height_m: 1.0, tide_phase: 'rising', source: 'noaa' },
          { ts: new Date(now.getTime() + 2 * 3600000).toISOString(), tide_height_m: 1.5, tide_phase: 'high', source: 'noaa' },
          { ts: new Date(now.getTime() + 3 * 3600000).toISOString(), tide_height_m: 1.2, tide_phase: 'falling', source: 'noaa' },
          { ts: new Date(now.getTime() + 4 * 3600000).toISOString(), tide_height_m: 0.8, tide_phase: 'falling', source: 'noaa' },
          { ts: new Date(now.getTime() + 5 * 3600000).toISOString(), tide_height_m: 0.3, tide_phase: 'low', source: 'noaa' },
          { ts: new Date(now.getTime() + 6 * 3600000).toISOString(), tide_height_m: 0.6, tide_phase: 'rising', source: 'noaa' },
          { ts: new Date(now.getTime() + 7 * 3600000).toISOString(), tide_height_m: 1.1, tide_phase: 'rising', source: 'noaa' },
        ];

        const mockBuilder = createMockQueryBuilder(rows);
        mockSupabase.mockResolvedValue({
          from: jest.fn().mockReturnValue(mockBuilder),
        });

        const result = await service.fetchCachedTides(beachId);

        expect(result).not.toBeNull();
        expect(result?.station_id).toBe(`cached_${beachId}`);
        expect(result?.station_name).toBe('Cached Tide Data');
        expect(result?.tides.length).toBeGreaterThan(0);

        // Should detect the high at index 2 (1.5m) and low at index 5 (0.3m)
        const highs = result?.tides.filter(t => t.type === 'high') ?? [];
        const lows = result?.tides.filter(t => t.type === 'low') ?? [];

        expect(highs.length).toBeGreaterThanOrEqual(1);
        expect(lows.length).toBeGreaterThanOrEqual(1);

        // Heights should be converted to feet (1.5m * 3.28084 ≈ 4.9ft)
        const mainHigh = highs.find(h => Math.abs(h.height - 4.9) < 0.2);
        expect(mainHigh).toBeDefined();
      });

      it('should sort tides by time', async () => {
        const now = new Date();
        const rows = [
          { ts: new Date(now.getTime() + 0 * 3600000).toISOString(), tide_height_m: 0.5, tide_phase: 'rising', source: 'noaa' },
          { ts: new Date(now.getTime() + 1 * 3600000).toISOString(), tide_height_m: 1.5, tide_phase: 'high', source: 'noaa' },
          { ts: new Date(now.getTime() + 2 * 3600000).toISOString(), tide_height_m: 0.3, tide_phase: 'low', source: 'noaa' },
          { ts: new Date(now.getTime() + 3 * 3600000).toISOString(), tide_height_m: 1.2, tide_phase: 'rising', source: 'noaa' },
        ];

        const mockBuilder = createMockQueryBuilder(rows);
        mockSupabase.mockResolvedValue({
          from: jest.fn().mockReturnValue(mockBuilder),
        });

        const result = await service.fetchCachedTides(beachId);

        expect(result?.tides).toBeDefined();
        // Verify tides are sorted by time
        for (let i = 1; i < (result?.tides.length ?? 0); i++) {
          expect(result!.tides[i].time).toBeGreaterThanOrEqual(result!.tides[i - 1].time);
        }
      });
    });

    describe('T2: Boundary extrema detection', () => {
      it('should detect high tide at first data point when it is higher than second', async () => {
        const now = new Date();
        // First point is highest (edge case - window starts at high tide)
        const rows = [
          { ts: new Date(now.getTime() + 0 * 3600000).toISOString(), tide_height_m: 2.0, tide_phase: 'high', source: 'noaa' },
          { ts: new Date(now.getTime() + 1 * 3600000).toISOString(), tide_height_m: 1.5, tide_phase: 'falling', source: 'noaa' },
          { ts: new Date(now.getTime() + 2 * 3600000).toISOString(), tide_height_m: 1.0, tide_phase: 'falling', source: 'noaa' },
          { ts: new Date(now.getTime() + 3 * 3600000).toISOString(), tide_height_m: 0.5, tide_phase: 'low', source: 'noaa' },
        ];

        const mockBuilder = createMockQueryBuilder(rows);
        mockSupabase.mockResolvedValue({
          from: jest.fn().mockReturnValue(mockBuilder),
        });

        const result = await service.fetchCachedTides(beachId);

        expect(result?.tides).toBeDefined();
        const highs = result?.tides.filter(t => t.type === 'high') ?? [];
        // Should include the first point as a high tide
        expect(highs.length).toBeGreaterThanOrEqual(1);
        // 2.0m * 3.28084 ≈ 6.6ft
        const firstHigh = highs.find(h => Math.abs(h.height - 6.6) < 0.2);
        expect(firstHigh).toBeDefined();
      });

      it('should detect low tide at last data point when it is lower than second-to-last', async () => {
        const now = new Date();
        // Last point is lowest (edge case - window ends at low tide)
        const rows = [
          { ts: new Date(now.getTime() + 0 * 3600000).toISOString(), tide_height_m: 1.5, tide_phase: 'falling', source: 'noaa' },
          { ts: new Date(now.getTime() + 1 * 3600000).toISOString(), tide_height_m: 1.0, tide_phase: 'falling', source: 'noaa' },
          { ts: new Date(now.getTime() + 2 * 3600000).toISOString(), tide_height_m: 0.5, tide_phase: 'falling', source: 'noaa' },
          { ts: new Date(now.getTime() + 3 * 3600000).toISOString(), tide_height_m: 0.0, tide_phase: 'low', source: 'noaa' },
        ];

        const mockBuilder = createMockQueryBuilder(rows);
        mockSupabase.mockResolvedValue({
          from: jest.fn().mockReturnValue(mockBuilder),
        });

        const result = await service.fetchCachedTides(beachId);

        expect(result?.tides).toBeDefined();
        const lows = result?.tides.filter(t => t.type === 'low') ?? [];
        // Should include the last point as a low tide
        expect(lows.length).toBeGreaterThanOrEqual(1);
        // 0.0m = 0.0ft
        const lastLow = lows.find(l => l.height === 0);
        expect(lastLow).toBeDefined();
      });

      it('should detect extrema at both boundaries when data starts high and ends low', async () => {
        const now = new Date();
        const rows = [
          { ts: new Date(now.getTime() + 0 * 3600000).toISOString(), tide_height_m: 2.0, tide_phase: 'high', source: 'noaa' },
          { ts: new Date(now.getTime() + 1 * 3600000).toISOString(), tide_height_m: 1.0, tide_phase: 'falling', source: 'noaa' },
          { ts: new Date(now.getTime() + 2 * 3600000).toISOString(), tide_height_m: 0.0, tide_phase: 'low', source: 'noaa' },
        ];

        const mockBuilder = createMockQueryBuilder(rows);
        mockSupabase.mockResolvedValue({
          from: jest.fn().mockReturnValue(mockBuilder),
        });

        const result = await service.fetchCachedTides(beachId);

        expect(result?.tides).toBeDefined();
        const highs = result?.tides.filter(t => t.type === 'high') ?? [];
        const lows = result?.tides.filter(t => t.type === 'low') ?? [];

        // Should have at least one high (first point) and one low (last point)
        expect(highs.length).toBeGreaterThanOrEqual(1);
        expect(lows.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('T3: Fallback path behavior', () => {
      it('should return null and add Sentry breadcrumb when cache is empty', async () => {
        const mockBuilder = createMockQueryBuilder([]);
        mockSupabase.mockResolvedValue({
          from: jest.fn().mockReturnValue(mockBuilder),
        });

        const result = await service.fetchCachedTides(beachId);

        expect(result).toBeNull();
        expect(mockSentryBreadcrumb).toHaveBeenCalledWith({
          category: 'tide-cache',
          message: expect.stringContaining('Cache fallback'),
          level: 'warning',
          data: expect.objectContaining({ beachId }),
        });
      });

      it('should return null and add Sentry breadcrumb when rows is null', async () => {
        const mockBuilder = createMockQueryBuilder(null);
        mockSupabase.mockResolvedValue({
          from: jest.fn().mockReturnValue(mockBuilder),
        });

        const result = await service.fetchCachedTides(beachId);

        expect(result).toBeNull();
        expect(mockSentryBreadcrumb).toHaveBeenCalledWith({
          category: 'tide-cache',
          message: expect.stringContaining('Cache fallback'),
          level: 'warning',
          data: expect.objectContaining({ beachId, rowCount: 0 }),
        });
      });

      it('should return null when database query fails', async () => {
        const mockBuilder = createMockQueryBuilder(null, new Error('Database connection failed'));
        mockSupabase.mockResolvedValue({
          from: jest.fn().mockReturnValue(mockBuilder),
        });

        const result = await service.fetchCachedTides(beachId);

        expect(result).toBeNull();
      });
    });

    describe('Plateau handling (no false positives)', () => {
      it('should not detect extrema for consecutive equal heights', async () => {
        const now = new Date();
        // All points at same height - no extrema should be detected
        const rows = [
          { ts: new Date(now.getTime() + 0 * 3600000).toISOString(), tide_height_m: 1.5, tide_phase: 'slack', source: 'noaa' },
          { ts: new Date(now.getTime() + 1 * 3600000).toISOString(), tide_height_m: 1.5, tide_phase: 'slack', source: 'noaa' },
          { ts: new Date(now.getTime() + 2 * 3600000).toISOString(), tide_height_m: 1.5, tide_phase: 'slack', source: 'noaa' },
        ];

        const mockBuilder = createMockQueryBuilder(rows);
        mockSupabase.mockResolvedValue({
          from: jest.fn().mockReturnValue(mockBuilder),
        });

        const result = await service.fetchCachedTides(beachId);

        // With all equal heights, the interior loop finds no extrema,
        // and the boundary checks also find no extrema (equal != greater/less than)
        // This may result in null being returned due to no extremes found
        // The behavior is correct - a plateau is not a tide extreme
        expect(result).toBeNull();
        expect(mockSentryBreadcrumb).toHaveBeenCalled();
      });

      it('should detect extrema correctly when plateau is preceded/followed by different heights', async () => {
        const now = new Date();
        // Pattern: rising -> plateau -> falling
        const rows = [
          { ts: new Date(now.getTime() + 0 * 3600000).toISOString(), tide_height_m: 1.0, tide_phase: 'rising', source: 'noaa' },
          { ts: new Date(now.getTime() + 1 * 3600000).toISOString(), tide_height_m: 1.5, tide_phase: 'high', source: 'noaa' },
          { ts: new Date(now.getTime() + 2 * 3600000).toISOString(), tide_height_m: 1.5, tide_phase: 'high', source: 'noaa' },
          { ts: new Date(now.getTime() + 3 * 3600000).toISOString(), tide_height_m: 1.0, tide_phase: 'falling', source: 'noaa' },
        ];

        const mockBuilder = createMockQueryBuilder(rows);
        mockSupabase.mockResolvedValue({
          from: jest.fn().mockReturnValue(mockBuilder),
        });

        const result = await service.fetchCachedTides(beachId);

        expect(result).not.toBeNull();
        // Should detect the low at start (boundary) and low at end (boundary)
        // but not false highs in the plateau
        expect(result?.tides.length).toBeGreaterThan(0);
      });
    });
  });
});
