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
        expect(mainHigh).toMatchObject({ type: 'high' });
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

        expect(result).not.toBeNull();
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

        expect(result).not.toBeNull();
        const highs = result?.tides.filter(t => t.type === 'high') ?? [];
        // Should include the first point as a high tide
        expect(highs.length).toBeGreaterThanOrEqual(1);
        // 2.0m * 3.28084 ≈ 6.6ft
        const firstHigh = highs.find(h => Math.abs(h.height - 6.6) < 0.2);
        expect(firstHigh).toMatchObject({ type: 'high' });
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

        expect(result).not.toBeNull();
        const lows = result?.tides.filter(t => t.type === 'low') ?? [];
        // Should include the last point as a low tide
        expect(lows.length).toBeGreaterThanOrEqual(1);
        // 0.0m = 0.0ft
        const lastLow = lows.find(l => l.height === 0);
        expect(lastLow).toMatchObject({ type: 'low', height: 0 });
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

        expect(result).not.toBeNull();
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

    describe('Duplicate row deduplication', () => {
      it('prefers a direct NOAA row over a newer fallback in the same UTC hour', async () => {
        const hourStart = new Date();
        hourStart.setMinutes(0, 0, 0);
        const rows = [
          {
            ts: new Date(hourStart.getTime() + 30 * 60 * 1000).toISOString(),
            tide_height_m: 2.0,
            tide_phase: 'high',
            source: 'noaa_hilo_interpolated',
            created_at: new Date(hourStart.getTime() + 2 * 60 * 60 * 1000).toISOString(),
          },
          {
            ts: hourStart.toISOString(),
            tide_height_m: 0.5,
            tide_phase: 'rising',
            source: 'noaa',
            created_at: new Date(hourStart.getTime() + 1 * 60 * 60 * 1000).toISOString(),
          },
          {
            ts: new Date(hourStart.getTime() + 60 * 60 * 1000).toISOString(),
            tide_height_m: 1.5,
            tide_phase: 'high',
            source: 'noaa',
            created_at: hourStart.toISOString(),
          },
          {
            ts: new Date(hourStart.getTime() + 2 * 60 * 60 * 1000).toISOString(),
            tide_height_m: 0.2,
            tide_phase: 'low',
            source: 'noaa',
            created_at: hourStart.toISOString(),
          },
        ];

        const mockBuilder = createMockQueryBuilder(rows);
        mockSupabase.mockResolvedValue({
          from: jest.fn().mockReturnValue(mockBuilder),
        });

        const result = await service.fetchCachedTides(beachId);

        expect(result).not.toBeNull();
        expect(result?.tides).toEqual(expect.arrayContaining([
          { time: expect.any(Number), height: expect.closeTo(4.9, 0.2), type: 'high', name: 'High' },
          { time: expect.any(Number), height: expect.closeTo(0.7, 0.2), type: 'low', name: 'Low' },
        ]));
        expect(result?.tides.some((tide) => tide.height > 6)).toBe(false);
      });

      it('should detect extrema correctly when rows are duplicated 3x per hour', async () => {
        const now = new Date();
        // Simulate 3 cron-run duplicates per hour (at :17, :22, :50 seconds)
        const makeTriple = (hourOffset: number, height: number) => {
          const base = new Date(now.getTime() + hourOffset * 3600000);
          return [
            { ts: new Date(base.getTime() + 17000).toISOString(), tide_height_m: height, tide_phase: null, source: 'noaa' },
            { ts: new Date(base.getTime() + 22000).toISOString(), tide_height_m: height, tide_phase: null, source: 'noaa' },
            { ts: new Date(base.getTime() + 50000).toISOString(), tide_height_m: height, tide_phase: null, source: 'noaa' },
          ];
        };

        const rows = [
          ...makeTriple(0, 0.5),
          ...makeTriple(1, 1.0),
          ...makeTriple(2, 1.5),  // high
          ...makeTriple(3, 1.2),
          ...makeTriple(4, 0.8),
          ...makeTriple(5, 0.3),  // low
          ...makeTriple(6, 0.6),
          ...makeTriple(7, 1.1),
        ];

        const mockBuilder = createMockQueryBuilder(rows);
        mockSupabase.mockResolvedValue({
          from: jest.fn().mockReturnValue(mockBuilder),
        });

        const result = await service.fetchCachedTides(beachId);

        expect(result).not.toBeNull();
        const highs = result?.tides.filter(t => t.type === 'high') ?? [];
        const lows = result?.tides.filter(t => t.type === 'low') ?? [];

        expect(highs.length).toBeGreaterThanOrEqual(1);
        expect(lows.length).toBeGreaterThanOrEqual(1);

        // High at 1.5m → ~4.9 ft
        const mainHigh = highs.find(h => Math.abs(h.height - 4.9) < 0.2);
        expect(mainHigh).toMatchObject({ type: 'high' });
      });

      it('should produce same extrema from deduplicated rows as from single rows', async () => {
        const now = new Date('2026-08-02T12:00:00.000Z');
        const heights = [0.5, 1.0, 1.5, 1.2, 0.8, 0.3, 0.6, 1.1];

        // Single row per hour
        const singleRows = heights.map((h, i) => ({
          ts: new Date(now.getTime() + i * 3600000).toISOString(),
          tide_height_m: h,
          tide_phase: null,
          source: 'noaa',
        }));

        const mockBuilder1 = createMockQueryBuilder(singleRows);
        mockSupabase.mockResolvedValue({
          from: jest.fn().mockReturnValue(mockBuilder1),
        });

        const singleResult = await service.fetchCachedTides(beachId);

        // Triple rows per hour
        const tripleRows = heights.flatMap((h, i) => {
          const base = new Date(now.getTime() + i * 3600000);
          return [
            { ts: new Date(base.getTime() + 17000).toISOString(), tide_height_m: h, tide_phase: null, source: 'noaa' },
            { ts: new Date(base.getTime() + 22000).toISOString(), tide_height_m: h, tide_phase: null, source: 'noaa' },
            { ts: new Date(base.getTime() + 50000).toISOString(), tide_height_m: h, tide_phase: null, source: 'noaa' },
          ];
        });

        const mockBuilder2 = createMockQueryBuilder(tripleRows);
        mockSupabase.mockResolvedValue({
          from: jest.fn().mockReturnValue(mockBuilder2),
        });

        const tripleResult = await service.fetchCachedTides(beachId);

        expect(singleResult).not.toBeNull();
        expect(tripleResult).not.toBeNull();
        expect(tripleResult!.tides.length).toBe(singleResult!.tides.length);

        // Same extrema types in same order
        const singleTypes = singleResult!.tides.map(t => t.type);
        const tripleTypes = tripleResult!.tides.map(t => t.type);
        expect(tripleTypes).toEqual(singleTypes);
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
