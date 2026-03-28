/**
 * @jest-environment node
 *
 * Tests for calculateRelativeContext() — compares today's surf score against
 * the rest of the week to surface "best this week", trend direction, and incoming swells.
 */

import { calculateRelativeContext } from '@/lib/scoring/relative-context';
import type { DailyScore } from '@/lib/scoring/relative-context';

describe('calculateRelativeContext', () => {
  describe('isBestOfWeek', () => {
    it('returns isBestOfWeek: true when today is the highest score of the week', () => {
      const weekScores: DailyScore[] = [
        { date: '2026-03-25', score: 55 }, // today — highest
        { date: '2026-03-26', score: 40 },
        { date: '2026-03-27', score: 35 },
        { date: '2026-03-28', score: 30 },
        { date: '2026-03-29', score: 38 },
        { date: '2026-03-30', score: 42 },
        { date: '2026-03-31', score: 45 },
      ];

      const result = calculateRelativeContext(55, null, weekScores);

      expect(result.isBestOfWeek).toBe(true);
    });

    it('returns isBestOfWeek: true when today is within 5pts of the highest', () => {
      const weekScores: DailyScore[] = [
        { date: '2026-03-25', score: 53 }, // today — within 5pts of max (55)
        { date: '2026-03-26', score: 55 }, // highest
        { date: '2026-03-27', score: 40 },
        { date: '2026-03-28', score: 30 },
        { date: '2026-03-29', score: 35 },
        { date: '2026-03-30', score: 42 },
        { date: '2026-03-31', score: 48 },
      ];

      const result = calculateRelativeContext(53, null, weekScores);

      expect(result.isBestOfWeek).toBe(true);
    });

    it('returns isBestOfWeek: false when today is more than 5pts below highest', () => {
      const weekScores: DailyScore[] = [
        { date: '2026-03-25', score: 40 }, // today — 25pts below max
        { date: '2026-03-26', score: 65 }, // highest
        { date: '2026-03-27', score: 58 },
        { date: '2026-03-28', score: 50 },
        { date: '2026-03-29', score: 45 },
        { date: '2026-03-30', score: 30 },
        { date: '2026-03-31', score: 35 },
      ];

      const result = calculateRelativeContext(40, null, weekScores);

      expect(result.isBestOfWeek).toBe(false);
    });

    it('returns isBestOfWeek: true when today is exactly 5pts below highest', () => {
      const weekScores: DailyScore[] = [
        { date: '2026-03-25', score: 60 }, // today
        { date: '2026-03-26', score: 65 }, // highest — exactly 5pts above today
        { date: '2026-03-27', score: 40 },
      ];

      const result = calculateRelativeContext(60, null, weekScores);

      expect(result.isBestOfWeek).toBe(true);
    });

    it('returns isBestOfWeek: false when today is 6pts below highest', () => {
      const weekScores: DailyScore[] = [
        { date: '2026-03-25', score: 59 }, // today
        { date: '2026-03-26', score: 65 }, // highest — 6pts above today
        { date: '2026-03-27', score: 40 },
      ];

      const result = calculateRelativeContext(59, null, weekScores);

      expect(result.isBestOfWeek).toBe(false);
    });
  });

  describe('trend', () => {
    it('returns trend: improving when today is 8+ pts higher than yesterday', () => {
      const weekScores: DailyScore[] = [
        { date: '2026-03-25', score: 65 },
        { date: '2026-03-26', score: 60 },
      ];

      const result = calculateRelativeContext(65, 55, weekScores); // +10 from yesterday

      expect(result.trend).toBe('improving');
      expect(result.trendDelta).toBe(10);
    });

    it('returns trend: declining when today is 8+ pts lower than yesterday', () => {
      const weekScores: DailyScore[] = [
        { date: '2026-03-25', score: 40 },
        { date: '2026-03-26', score: 35 },
      ];

      const result = calculateRelativeContext(40, 55, weekScores); // -15 from yesterday

      expect(result.trend).toBe('declining');
      expect(result.trendDelta).toBe(-15);
    });

    it('returns trend: stable when within 7pts of yesterday', () => {
      const weekScores: DailyScore[] = [
        { date: '2026-03-25', score: 52 },
        { date: '2026-03-26', score: 50 },
      ];

      const result = calculateRelativeContext(52, 47, weekScores); // +5 — within 7pts

      expect(result.trend).toBe('stable');
    });

    it('returns trend: stable when yesterday is null', () => {
      const weekScores: DailyScore[] = [
        { date: '2026-03-25', score: 55 },
      ];

      const result = calculateRelativeContext(55, null, weekScores);

      expect(result.trend).toBe('stable');
      expect(result.trendDelta).toBe(0);
    });

    it('returns positive trendDelta when improving', () => {
      const weekScores: DailyScore[] = [{ date: '2026-03-25', score: 70 }];

      const result = calculateRelativeContext(70, 50, weekScores);

      expect(result.trendDelta).toBeGreaterThan(0);
      expect(result.trendDelta).toBe(20);
    });

    it('returns negative trendDelta when declining', () => {
      const weekScores: DailyScore[] = [{ date: '2026-03-25', score: 45 }];

      const result = calculateRelativeContext(45, 60, weekScores);

      expect(result.trendDelta).toBeLessThan(0);
      expect(result.trendDelta).toBe(-15);
    });

    it('trendDelta is 0 when yesterday is null', () => {
      const weekScores: DailyScore[] = [{ date: '2026-03-25', score: 55 }];

      const result = calculateRelativeContext(55, null, weekScores);

      expect(result.trendDelta).toBe(0);
    });

    it('returns trend: stable when exactly 7pts difference (boundary)', () => {
      const weekScores: DailyScore[] = [{ date: '2026-03-25', score: 57 }];

      const result = calculateRelativeContext(57, 50, weekScores); // +7 = stable boundary

      expect(result.trend).toBe('stable');
    });

    it('returns trend: improving when exactly 8pts above yesterday', () => {
      const weekScores: DailyScore[] = [{ date: '2026-03-25', score: 58 }];

      const result = calculateRelativeContext(58, 50, weekScores); // +8 = improving

      expect(result.trend).toBe('improving');
    });
  });

  describe('incomingSwell', () => {
    it('detects incoming swell when a future day has score 20+ pts above today', () => {
      const weekScores: DailyScore[] = [
        { date: '2026-03-25', score: 40 }, // today
        { date: '2026-03-26', score: 42 },
        { date: '2026-03-27', score: 45 },
        { date: '2026-03-28', score: 65 }, // big jump: +25 from today
        { date: '2026-03-29', score: 70 },
      ];

      const result = calculateRelativeContext(40, null, weekScores);

      expect(result.incomingSwell).not.toBeNull();
      expect(result.incomingSwell!.date).toBe('2026-03-28');
      expect(result.incomingSwell!.estimatedScore).toBe(65);
      expect(result.incomingSwell!.description).toBeTruthy();
    });

    it('incomingSwell description contains a day name', () => {
      const weekScores: DailyScore[] = [
        { date: '2026-03-25', score: 35 }, // today = Wednesday
        { date: '2026-03-26', score: 38 },
        { date: '2026-03-27', score: 40 },
        { date: '2026-03-28', score: 70 }, // Saturday jump
      ];

      const result = calculateRelativeContext(35, null, weekScores);

      expect(result.incomingSwell).not.toBeNull();
      // Should mention a day name (Saturday = index 6, or by date)
      expect(result.incomingSwell!.description).toMatch(/Saturday|Sat|2026-03-28/i);
    });

    it('returns null incomingSwell when all days have similar scores', () => {
      const weekScores: DailyScore[] = [
        { date: '2026-03-25', score: 40 }, // today
        { date: '2026-03-26', score: 42 },
        { date: '2026-03-27', score: 38 },
        { date: '2026-03-28', score: 41 },
        { date: '2026-03-29', score: 43 },
        { date: '2026-03-30', score: 39 },
        { date: '2026-03-31', score: 37 },
      ];

      const result = calculateRelativeContext(40, null, weekScores);

      expect(result.incomingSwell).toBeNull();
    });

    it('only detects incoming swell from days AFTER today (not today itself)', () => {
      // Today has a high score — should not trigger incomingSwell for today
      const weekScores: DailyScore[] = [
        { date: '2026-03-25', score: 70 }, // today — high but no "incoming"
        { date: '2026-03-26', score: 45 },
        { date: '2026-03-27', score: 40 },
      ];

      const result = calculateRelativeContext(70, null, weekScores);

      // Today is already the high score — no incoming swell from future
      expect(result.incomingSwell).toBeNull();
    });

    it('finds the FIRST day with a jump of 20+ pts as the incoming swell date', () => {
      const weekScores: DailyScore[] = [
        { date: '2026-03-25', score: 35 }, // today
        { date: '2026-03-26', score: 38 },
        { date: '2026-03-27', score: 60 }, // first jump (+25) — this is the swell
        { date: '2026-03-28', score: 65 }, // also high but not first
      ];

      const result = calculateRelativeContext(35, null, weekScores);

      expect(result.incomingSwell).not.toBeNull();
      expect(result.incomingSwell!.date).toBe('2026-03-27');
    });
  });

  describe('edge cases', () => {
    it('handles empty weekScores gracefully', () => {
      const result = calculateRelativeContext(50, null, []);

      expect(result.isBestOfWeek).toBe(false);
      expect(result.trend).toBe('stable');
      expect(result.trendDelta).toBe(0);
      expect(result.incomingSwell).toBeNull();
    });

    it('handles single-day weekScores', () => {
      const weekScores: DailyScore[] = [
        { date: '2026-03-25', score: 55 },
      ];

      const result = calculateRelativeContext(55, null, weekScores);

      expect(result).toBeDefined();
      expect(result.isBestOfWeek).toBe(true); // Only day = best day
    });
  });
});
