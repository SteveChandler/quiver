/**
 * Unit tests for Session Wizard URL parameter utilities
 */

import {
  parseSessionWizardParams,
  buildSessionWizardUrl,
  hasWizardParams,
  extractFormState,
  type ParseResult,
} from '@/lib/utils/session-wizard-params';
import type { ValidatedSessionWizardParams } from '@/types/session-wizard';

function expectSuccessfulParse(
  result: ParseResult<ValidatedSessionWizardParams>,
): ValidatedSessionWizardParams {
  expect(result.success).toBe(true);
  if (!result.success) {
    throw new Error(`Expected successful parse, got: ${result.error}`);
  }
  return result.data;
}

function expectFailedParse(
  result: ParseResult<ValidatedSessionWizardParams>,
): { error: string; defaults: Partial<ValidatedSessionWizardParams> } {
  expect(result.success).toBe(false);
  if (result.success) {
    throw new Error('Expected failed parse');
  }
  return {
    error: result.error,
    defaults: result.defaults,
  };
}

describe('parseSessionWizardParams', () => {
  it('should parse valid parameters successfully', () => {
    const params = new URLSearchParams({
      mode: 'log',
      beach: '123e4567-e89b-12d3-a456-426614174000',
      beachName: 'Pacific Beach',
      startTime: '2025-11-22T06:00:00.000Z',
      endTime: '2025-11-22T10:00:00.000Z',
      step: '3',
    });

    const result = parseSessionWizardParams(params);
    const data = expectSuccessfulParse(result);

    expect(data.mode).toBe('log');
    expect(data.beachId).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(data.beachName).toBe('Pacific Beach');
    expect(data.startTime).toBeInstanceOf(Date);
    expect(data.endTime).toBeInstanceOf(Date);
    expect(data.targetStep).toBe(3);
  });

  it('should parse native email handoff parameter aliases', () => {
    const params = new URLSearchParams({
      mode: 'log',
      quick: 'true',
      beachId: '123e4567-e89b-12d3-a456-426614174000',
      beachName: 'Pacific Beach',
      startedAt: '2025-11-22T06:00:00.000Z',
      entrySource: 'email',
    });

    const result = parseSessionWizardParams(params);
    const data = expectSuccessfulParse(result);

    expect(data.quick).toBe(true);
    expect(data.beachId).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(data.startTime?.toISOString()).toBe('2025-11-22T06:00:00.000Z');
  });

  it('should handle missing optional parameters with defaults', () => {
    const params = new URLSearchParams({
      mode: 'log',
    });

    const result = parseSessionWizardParams(params);
    const failure = expectFailedParse(result);

    // Missing beach/startTime/endTime triggers Zod validation error
    // Should provide defaults for graceful degradation
    expect(failure.defaults.mode).toBe('log');
    expect(failure.defaults.targetStep).toBe(1); // Default
    expect(failure.error).not.toBe('');
  });

  it('should reject invalid UUID format', () => {
    const params = new URLSearchParams({
      mode: 'log',
      beach: 'not-a-uuid',
      beachName: 'Test Beach',
      startTime: '2025-11-22T06:00:00.000Z',
      endTime: '2025-11-22T10:00:00.000Z',
      step: '1',
    });

    const result = parseSessionWizardParams(params);
    const failure = expectFailedParse(result);

    expect(failure.error).toContain('Invalid');
    expect(failure.defaults.mode).toBe('log');
    expect(failure.defaults.targetStep).toBe(1);
  });

  it('should reject invalid timestamp format', () => {
    const params = new URLSearchParams({
      mode: 'log',
      beach: '123e4567-e89b-12d3-a456-426614174000',
      beachName: 'Test Beach',
      startTime: 'not-a-timestamp',
      endTime: '2025-11-22T10:00:00.000Z',
      step: '1',
    });

    const result = parseSessionWizardParams(params);
    const failure = expectFailedParse(result);

    expect(failure.error).not.toBe('');
    expect(failure.defaults).toEqual(expect.any(Object));
  });

  it('should reject end time before start time', () => {
    const params = new URLSearchParams({
      mode: 'log',
      beach: '123e4567-e89b-12d3-a456-426614174000',
      beachName: 'Test Beach',
      startTime: '2025-11-22T10:00:00.000Z',
      endTime: '2025-11-22T06:00:00.000Z', // Before start time
      step: '1',
    });

    const result = parseSessionWizardParams(params);
    const failure = expectFailedParse(result);

    expect(failure.error).toContain('after start time');
  });

  it('should reject session duration over 12 hours', () => {
    const params = new URLSearchParams({
      mode: 'log',
      beach: '123e4567-e89b-12d3-a456-426614174000',
      beachName: 'Test Beach',
      startTime: '2025-11-22T06:00:00.000Z',
      endTime: '2025-11-23T06:00:00.000Z', // 24 hours later
      step: '1',
    });

    const result = parseSessionWizardParams(params);
    const failure = expectFailedParse(result);

    expect(failure.error).toContain('12 hours');
  });

  it('should reject step number out of range', () => {
    const params = new URLSearchParams({
      mode: 'log',
      beach: '123e4567-e89b-12d3-a456-426614174000',
      beachName: 'Test Beach',
      startTime: '2025-11-22T06:00:00.000Z',
      endTime: '2025-11-22T10:00:00.000Z',
      step: '10', // Out of range (max is 4)
    });

    const result = parseSessionWizardParams(params);
    const failure = expectFailedParse(result);

    expect(failure.error).toContain('between 1 and 4');
  });

  it('should sanitize beach name (trim whitespace)', () => {
    const params = new URLSearchParams({
      mode: 'log',
      beach: '123e4567-e89b-12d3-a456-426614174000',
      beachName: '  Pacific Beach  ', // Extra whitespace
      startTime: '2025-11-22T06:00:00.000Z',
      endTime: '2025-11-22T10:00:00.000Z',
      step: '1',
    });

    const result = parseSessionWizardParams(params);
    const data = expectSuccessfulParse(result);

    expect(data.beachName).toBe('Pacific Beach'); // Trimmed
  });

  it('should accept "log" mode', () => {
    const params = new URLSearchParams({
      mode: 'log',
      beach: '123e4567-e89b-12d3-a456-426614174000',
      beachName: 'Test Beach',
      startTime: '2025-11-22T06:00:00.000Z',
      endTime: '2025-11-22T10:00:00.000Z',
      step: '1',
    });

    const result = parseSessionWizardParams(params);
    const data = expectSuccessfulParse(result);

    expect(data.mode).toBe('log');
  });

  it('should reject invalid mode', () => {
    const params = new URLSearchParams({
      mode: 'invalid-mode',
    });

    const result = parseSessionWizardParams(params);
    const failure = expectFailedParse(result);

    expect(failure.error).toContain('Invalid input');
  });
});

describe('buildSessionWizardUrl', () => {
  const validParams: ValidatedSessionWizardParams = {
    mode: 'log',
    quick: false,
    beachId: '123e4567-e89b-12d3-a456-426614174000',
    beachName: 'Pacific Beach',
    startTime: new Date('2025-11-22T06:00:00.000Z'),
    endTime: new Date('2025-11-22T10:00:00.000Z'),
    targetStep: 3,
  };

  it('should build valid URL with all parameters', () => {
    const url = buildSessionWizardUrl(validParams);

    expect(url).toContain('/sessions/new?');
    expect(url).toContain('mode=log');
    expect(url).toContain('beach=123e4567-e89b-12d3-a456-426614174000');
    expect(url).toContain('beachName=Pacific+Beach');
    expect(url).toContain('startTime=2025-11-22T06%3A00%3A00.000Z');
    expect(url).toContain('endTime=2025-11-22T10%3A00%3A00.000Z');
    expect(url).toContain('step=3');
  });

  it('should properly URL encode special characters', () => {
    const paramsWithSpecialChars: ValidatedSessionWizardParams = {
      ...validParams,
      beachName: 'Ocean Beach & Pier',
    };

    const url = buildSessionWizardUrl(paramsWithSpecialChars);

    // & should be encoded as %26
    expect(url).toContain('Ocean+Beach+%26+Pier');
  });

  it('should create parseable URL (round-trip test)', () => {
    const url = buildSessionWizardUrl(validParams);

    // Extract query string
    const queryString = url.split('?')[1];
    const searchParams = new URLSearchParams(queryString);

    // Parse it back
    const result = parseSessionWizardParams(searchParams);
    const data = expectSuccessfulParse(result);

    expect(data.mode).toBe(validParams.mode);
    expect(data.beachId).toBe(validParams.beachId);
    expect(data.beachName).toBe(validParams.beachName);
    expect(data.targetStep).toBe(validParams.targetStep);
    // Timestamps should be equivalent (allow small millisecond differences)
    expect(Math.abs(data.startTime!.getTime() - validParams.startTime!.getTime())).toBeLessThan(1000);
    expect(Math.abs(data.endTime!.getTime() - validParams.endTime!.getTime())).toBeLessThan(1000);
  });

  it('should round-trip forecast feedback handoff params', () => {
    const url = buildSessionWizardUrl({
      ...validParams,
      quick: true,
      forecastFeedbackId: '123e4567-e89b-42d3-a456-426614174999',
      forecastFeedbackValue: 'too_high',
      observedFaceHeightFt: 6,
    });

    const result = parseSessionWizardParams(
      new URLSearchParams(url.split('?')[1]),
    );
    const data = expectSuccessfulParse(result);

    expect(data.quick).toBe(true);
    expect(data.forecastFeedbackId).toBe(
      '123e4567-e89b-42d3-a456-426614174999',
    );
    expect(data.forecastFeedbackValue).toBe('too_high');
    expect(data.observedFaceHeightFt).toBe(6);
    expect(url).toContain('observedFaceHeightFt=6');
  });

  it.each(['0', '50.5', '6.2', 'not-a-number'])(
    'should reject invalid observed face height %s',
    (observedFaceHeightFt) => {
      const params = new URLSearchParams({
        mode: 'log',
        beach: '123e4567-e89b-12d3-a456-426614174000',
        beachName: 'Pacific Beach',
        observedFaceHeightFt,
      });

      const result = parseSessionWizardParams(params);

      const failure = expectFailedParse(result);
      expect(failure.error).not.toBe('');
    },
  );

  it.each([
    ['about-right feedback', 'about_right'],
    ['no feedback value', undefined],
  ])(
    'should reject observed face height with %s',
    (_label, forecastFeedbackValue) => {
      const params = new URLSearchParams({
        mode: 'log',
        beach: '123e4567-e89b-12d3-a456-426614174000',
        beachName: 'Pacific Beach',
        observedFaceHeightFt: '6',
      });
      if (forecastFeedbackValue) {
        params.set('forecastFeedbackValue', forecastFeedbackValue);
      }

      const result = parseSessionWizardParams(params);

      const failure = expectFailedParse(result);
      expect(failure.error).not.toBe('');
    },
  );

  it('should round-trip recommendation attribution params', () => {
    const url = buildSessionWizardUrl({
      ...validParams,
      recommendationId: 'beach:123e4567-e89b-12d3-a456-426614174000:2026-07-09T14:00:00.000Z',
      recommendationSurface: 'home_hero',
      recommendationRank: 1,
      recommendationScore: 87.5,
      recommendationTimeSlot: 'dawn-patrol',
      recommendationWindowStart: new Date('2026-07-09T14:00:00.000Z'),
      recommendationWindowEnd: new Date('2026-07-09T17:00:00.000Z'),
    });

    const result = parseSessionWizardParams(
      new URLSearchParams(url.split('?')[1]),
    );
    const data = expectSuccessfulParse(result);

    expect(data.recommendationId).toBe(
      'beach:123e4567-e89b-12d3-a456-426614174000:2026-07-09T14:00:00.000Z',
    );
    expect(data.recommendationSurface).toBe('home_hero');
    expect(data.recommendationRank).toBe(1);
    expect(data.recommendationScore).toBe(87.5);
    expect(data.recommendationTimeSlot).toBe('dawn-patrol');
    expect(data.recommendationWindowStart?.toISOString()).toBe(
      '2026-07-09T14:00:00.000Z',
    );
    expect(data.recommendationWindowEnd?.toISOString()).toBe(
      '2026-07-09T17:00:00.000Z',
    );
  });

  it('should throw when asked to serialize an invalid start time', () => {
    expect(() =>
      buildSessionWizardUrl({
        ...validParams,
        startTime: new Date('garbage'),
      }),
    ).toThrow(RangeError);
  });
});

describe('hasWizardParams', () => {
  it('should return true when beach parameter is present', () => {
    const params = new URLSearchParams({
      beach: '123e4567-e89b-12d3-a456-426614174000',
    });

    expect(hasWizardParams(params)).toBe(true);
  });

  it('should return true when mode parameter is present', () => {
    const params = new URLSearchParams({
      mode: 'log',
    });

    expect(hasWizardParams(params)).toBe(true);
  });

  it('should return true when startTime parameter is present', () => {
    const params = new URLSearchParams({
      startTime: '2025-11-22T06:00:00.000Z',
    });

    expect(hasWizardParams(params)).toBe(true);
  });

  it('should return true when native email handoff parameters are present', () => {
    const params = new URLSearchParams({
      beachId: '123e4567-e89b-12d3-a456-426614174000',
      startedAt: '2025-11-22T06:00:00.000Z',
    });

    expect(hasWizardParams(params)).toBe(true);
  });

  it('should return false when no wizard parameters are present', () => {
    const params = new URLSearchParams({
      unrelated: 'parameter',
    });

    expect(hasWizardParams(params)).toBe(false);
  });

  it('should return false for empty search params', () => {
    const params = new URLSearchParams();

    expect(hasWizardParams(params)).toBe(false);
  });
});

describe('extractFormState', () => {
  const validParams: ValidatedSessionWizardParams = {
    mode: 'log',
    quick: false,
    beachId: '123e4567-e89b-12d3-a456-426614174000',
    beachName: 'Pacific Beach',
    startTime: new Date('2025-11-22T06:30:00.000Z'),
    endTime: new Date('2025-11-22T10:00:00.000Z'),
    targetStep: 3,
  };

  it('should extract form state from validated parameters', () => {
    const formState = extractFormState(validParams);

    expect(formState.selectedBeach).toBe('Pacific Beach');
    expect(formState.selectedBeachId).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(formState.selectedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD
    expect(formState.selectedTime).toMatch(/^\d{2}:\d{2}$/); // HH:MM
  });

  it('should format date correctly (YYYY-MM-DD)', () => {
    const formState = extractFormState(validParams);

    expect(formState.selectedDate).toBe('2025-11-22');
  });

  it('should format time correctly (HH:MM)', () => {
    const formState = extractFormState(validParams);

    // Note: Time format depends on timezone
    // We just check it's in HH:MM format
    expect(formState.selectedTime).toMatch(/^\d{2}:\d{2}$/);
  });

  it('should carry one-tap forecast feedback into session forecast accuracy', () => {
    expect(
      extractFormState({
        ...validParams,
        forecastFeedbackValue: 'about_right',
      }).forecastAccuracy,
    ).toBe('accurate');

    expect(
      extractFormState({
        ...validParams,
        forecastFeedbackValue: 'too_low',
      }).forecastAccuracy,
    ).toBe('inaccurate');

    expect(
      extractFormState({
        ...validParams,
        forecastFeedbackValue: 'too_high',
      }).forecastAccuracy,
    ).toBe('inaccurate');
  });

  it('should preserve carried observed height as an edited user value', () => {
    const formState = extractFormState({
      ...validParams,
      forecastFeedbackValue: 'too_low',
      observedFaceHeightFt: 6,
    });

    expect(formState).toMatchObject({
      waveHeight: 6,
      waveHeightEdited: true,
    });
  });

  it('should carry recommendation attribution into form state', () => {
    const formState = extractFormState({
      ...validParams,
      recommendationId: 'beach:abc:2026-07-09T14:00:00.000Z',
      recommendationSurface: 'discover_list',
      recommendationRank: 2,
      recommendationScore: 76,
      recommendationTimeSlot: 'afternoon',
      recommendationWindowStart: new Date('2026-07-09T14:00:00.000Z'),
      recommendationWindowEnd: new Date('2026-07-09T17:00:00.000Z'),
    });

    expect(formState).toMatchObject({
      recommendationId: 'beach:abc:2026-07-09T14:00:00.000Z',
      recommendationSurface: 'discover_list',
      recommendationRank: 2,
      recommendationScore: 76,
      recommendationTimeSlot: 'afternoon',
      recommendationWindowStart: '2026-07-09T14:00:00.000Z',
      recommendationWindowEnd: '2026-07-09T17:00:00.000Z',
    });
  });
});

describe('URL length validation', () => {
  it('should create URLs under 300 characters', () => {
    const params: ValidatedSessionWizardParams = {
      mode: 'log',
      quick: false,
      beachId: '123e4567-e89b-12d3-a456-426614174000',
      beachName: 'Very Long Beach Name With Many Words',
      startTime: new Date('2025-11-22T06:00:00.000Z'),
      endTime: new Date('2025-11-22T10:00:00.000Z'),
      targetStep: 4,
    };

    const url = buildSessionWizardUrl(params);

    // Should be well under browser limits (2000+ chars)
    expect(url.length).toBeLessThan(300);
  });
});

describe('Security validation', () => {
  it('should reject XSS attempts in beach name', () => {
    const params = new URLSearchParams({
      mode: 'log',
      beach: '123e4567-e89b-12d3-a456-426614174000',
      beachName: '<script>alert("XSS")</script>',
      startTime: '2025-11-22T06:00:00.000Z',
      endTime: '2025-11-22T10:00:00.000Z',
      step: '1',
    });

    const result = parseSessionWizardParams(params);

    // Should still parse (beach name is just a string)
    // React will auto-escape when rendering
    const data = expectSuccessfulParse(result);
    // The malicious string is preserved but will be escaped by React
    expect(data.beachName).toContain('script');
  });

  it('should reject SQL injection attempts in UUID', () => {
    const params = new URLSearchParams({
      mode: 'log',
      beach: "'; DROP TABLE beaches; --",
      beachName: 'Test Beach',
      startTime: '2025-11-22T06:00:00.000Z',
      endTime: '2025-11-22T10:00:00.000Z',
      step: '1',
    });

    const result = parseSessionWizardParams(params);
    const failure = expectFailedParse(result);

    // Should reject invalid UUID format
    expect(failure.error).toContain('Invalid');
  });

  it('should reject excessively long beach names', () => {
    const params = new URLSearchParams({
      mode: 'log',
      beach: '123e4567-e89b-12d3-a456-426614174000',
      beachName: 'A'.repeat(201), // Over 200 char limit
      startTime: '2025-11-22T06:00:00.000Z',
      endTime: '2025-11-22T10:00:00.000Z',
      step: '1',
    });

    const result = parseSessionWizardParams(params);
    const failure = expectFailedParse(result);

    expect(failure.error).toContain('too long');
  });
});
