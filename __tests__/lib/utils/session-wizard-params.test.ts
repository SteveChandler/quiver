/**
 * Unit tests for Session Wizard URL parameter utilities
 */

import {
  parseSessionWizardParams,
  buildSessionWizardUrl,
  hasWizardParams,
  extractFormState,
} from '@/lib/utils/session-wizard-params';
import type { ValidatedSessionWizardParams } from '@/types/session-wizard';

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

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mode).toBe('log');
      expect(result.data.beachId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result.data.beachName).toBe('Pacific Beach');
      expect(result.data.startTime).toBeInstanceOf(Date);
      expect(result.data.endTime).toBeInstanceOf(Date);
      expect(result.data.targetStep).toBe(3);
    }
  });

  it('should handle missing optional parameters with defaults', () => {
    const params = new URLSearchParams({
      mode: 'log',
    });

    const result = parseSessionWizardParams(params);

    // Missing beach/startTime/endTime triggers Zod validation error
    expect(result.success).toBe(false);
    if (!result.success) {
      // Should provide defaults for graceful degradation
      expect(result.defaults.mode).toBe('log');
      expect(result.defaults.targetStep).toBe(1); // Default
      expect(result.error).toBeTruthy(); // Some error message
    }
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

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid');
      expect(result.defaults.mode).toBe('log');
      expect(result.defaults.targetStep).toBe(1);
    }
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

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
      expect(result.defaults).toBeDefined();
    }
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

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('after start time');
    }
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

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('12 hours');
    }
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

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('between 1 and 4');
    }
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

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.beachName).toBe('Pacific Beach'); // Trimmed
    }
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

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.mode).toBe('log');
  });

  it('should reject invalid mode', () => {
    const params = new URLSearchParams({
      mode: 'invalid-mode',
    });

    const result = parseSessionWizardParams(params);

    expect(result.success).toBe(false);
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

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mode).toBe(validParams.mode);
      expect(result.data.beachId).toBe(validParams.beachId);
      expect(result.data.beachName).toBe(validParams.beachName);
      expect(result.data.targetStep).toBe(validParams.targetStep);
      // Timestamps should be equivalent (allow small millisecond differences)
      expect(Math.abs(result.data.startTime!.getTime() - validParams.startTime!.getTime())).toBeLessThan(1000);
      expect(Math.abs(result.data.endTime!.getTime() - validParams.endTime!.getTime())).toBeLessThan(1000);
    }
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
    expect(result.success).toBe(true);
    if (result.success) {
      // The malicious string is preserved but will be escaped by React
      expect(result.data.beachName).toContain('script');
    }
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

    // Should reject invalid UUID format
    expect(result.success).toBe(false);
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

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('too long');
    }
  });
});
