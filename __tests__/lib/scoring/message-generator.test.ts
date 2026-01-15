/**
 * Tests for natural language message generation utilities
 */

import {
  generateWindowMessage,
  generateConditionSummary,
  formatTimeCompact,
  formatTimeRange,
} from '@/lib/scoring/message-generator';
import type { WindowBoundaryReason } from '@/lib/scoring/types';

describe('generateWindowMessage', () => {
  it('generates message for tide-bounded window', () => {
    const start: WindowBoundaryReason = {
      time: new Date('2026-01-14T06:15:00Z'),
      factor: 'tide',
      description: 'tide enters range',
    };
    const end: WindowBoundaryReason = {
      time: new Date('2026-01-14T08:45:00Z'),
      factor: 'wind',
      description: 'wind picks up',
    };

    const message = generateWindowMessage(start, end);

    expect(message).toMatch(/tide/i);
    expect(message).toMatch(/wind/i);
  });

  it('generates message for sunset-bounded window', () => {
    const start: WindowBoundaryReason = {
      time: new Date('2026-01-14T15:00:00Z'),
      factor: 'score',
      description: 'conditions improve',
    };
    const end: WindowBoundaryReason = {
      time: new Date('2026-01-14T17:30:00Z'),
      factor: 'sunset',
      description: 'sunset',
    };

    const message = generateWindowMessage(start, end);

    expect(message).toMatch(/sunset/i);
  });

  it('generates message when start factor is wind', () => {
    const start: WindowBoundaryReason = {
      time: new Date('2026-01-14T06:00:00Z'),
      factor: 'wind',
      description: 'winds calm down',
    };
    const end: WindowBoundaryReason = {
      time: new Date('2026-01-14T10:00:00Z'),
      factor: 'tide',
      description: 'tide gets too high',
    };

    const message = generateWindowMessage(start, end);

    expect(message).toMatch(/wind/i);
    expect(message).toMatch(/tide/i);
  });

  it('generates message for rising tide description', () => {
    const start: WindowBoundaryReason = {
      time: new Date('2026-01-14T06:00:00Z'),
      factor: 'tide',
      description: 'rising tide enters range',
    };
    const end: WindowBoundaryReason = {
      time: new Date('2026-01-14T09:00:00Z'),
      factor: 'score',
      description: 'conditions degrade',
    };

    const message = generateWindowMessage(start, end);

    expect(message).toMatch(/tide/i);
  });

  it('returns fallback message when no factors match', () => {
    const start: WindowBoundaryReason = {
      time: new Date('2026-01-14T06:00:00Z'),
      factor: 'score',
      description: 'generic start',
    };
    const end: WindowBoundaryReason = {
      time: new Date('2026-01-14T09:00:00Z'),
      factor: 'score',
      description: 'generic end',
    };

    const message = generateWindowMessage(start, end);

    expect(message.length).toBeGreaterThan(0);
  });
});

describe('generateConditionSummary', () => {
  it('generates summary for offshore conditions', () => {
    const summary = generateConditionSummary({
      windCondition: 'offshore',
      tideCondition: 'in_range',
      swellCondition: 'optimal',
    });

    expect(summary).toMatch(/offshore/i);
  });

  it('generates summary with warning', () => {
    const summary = generateConditionSummary({
      windCondition: 'light',
      tideCondition: 'high',
      swellCondition: 'optimal',
      warning: 'tide getting high',
    });

    expect(summary).toMatch(/tide/i);
  });

  it('generates summary for light winds', () => {
    const summary = generateConditionSummary({
      windCondition: 'light',
      tideCondition: 'rising',
      swellCondition: 'acceptable',
    });

    expect(summary).toMatch(/light/i);
    expect(summary).toMatch(/tide/i);
  });

  it('generates summary for cross-shore winds', () => {
    const summary = generateConditionSummary({
      windCondition: 'cross',
      tideCondition: 'falling',
      swellCondition: 'marginal',
    });

    expect(summary).toMatch(/cross/i);
  });

  it('generates summary when tide is in range', () => {
    const summary = generateConditionSummary({
      windCondition: 'offshore',
      tideCondition: 'in_range',
      swellCondition: 'optimal',
    });

    expect(summary).toMatch(/sweet spot/i);
  });

  it('returns fallback for onshore conditions', () => {
    const summary = generateConditionSummary({
      windCondition: 'onshore',
      tideCondition: 'low',
      swellCondition: 'marginal',
    });

    expect(summary.length).toBeGreaterThan(0);
  });
});

describe('formatTimeCompact', () => {
  it('formats morning time correctly', () => {
    const date = new Date('2026-01-14T06:15:00Z');
    const formatted = formatTimeCompact(date, 'UTC');

    expect(formatted).toBe('6:15am');
  });

  it('formats afternoon time correctly', () => {
    const date = new Date('2026-01-14T14:30:00Z');
    const formatted = formatTimeCompact(date, 'UTC');

    expect(formatted).toBe('2:30pm');
  });

  it('formats noon correctly', () => {
    const date = new Date('2026-01-14T12:00:00Z');
    const formatted = formatTimeCompact(date, 'UTC');

    expect(formatted).toBe('12:00pm');
  });

  it('formats midnight correctly', () => {
    const date = new Date('2026-01-14T00:00:00Z');
    const formatted = formatTimeCompact(date, 'UTC');

    expect(formatted).toBe('12:00am');
  });

  it('respects timezone', () => {
    const date = new Date('2026-01-14T06:15:00Z');
    const formatted = formatTimeCompact(date, 'America/Los_Angeles');

    // 6:15 UTC is 10:15pm PST the previous day (UTC-8)
    expect(formatted).toMatch(/\d{1,2}:\d{2}(am|pm)/);
  });
});

describe('formatTimeRange', () => {
  it('shares AM suffix when both times are AM', () => {
    const start = new Date('2026-01-14T06:15:00Z');
    const end = new Date('2026-01-14T08:45:00Z');
    const formatted = formatTimeRange(start, end, 'UTC');

    expect(formatted).toBe('6:15-8:45am');
  });

  it('shares PM suffix when both times are PM', () => {
    const start = new Date('2026-01-14T14:00:00Z');
    const end = new Date('2026-01-14T17:30:00Z');
    const formatted = formatTimeRange(start, end, 'UTC');

    expect(formatted).toBe('2:00-5:30pm');
  });

  it('shows both suffixes when crossing noon', () => {
    const start = new Date('2026-01-14T10:00:00Z');
    const end = new Date('2026-01-14T14:00:00Z');
    const formatted = formatTimeRange(start, end, 'UTC');

    expect(formatted).toBe('10:00am-2:00pm');
  });

  it('handles same time', () => {
    const date = new Date('2026-01-14T06:15:00Z');
    const formatted = formatTimeRange(date, date, 'UTC');

    expect(formatted).toBe('6:15-6:15am');
  });
});
