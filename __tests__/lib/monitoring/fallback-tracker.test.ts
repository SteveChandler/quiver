/**
 * Tests for fallback-tracker utility
 *
 * Verifies Sentry integration behavior based on severity level:
 * - dangerous/high: captureMessage via withScope
 * - low/medium: addBreadcrumb only
 * - All severities: structured console.warn
 */

import * as Sentry from '@sentry/nextjs';
import { trackFallback } from '@/lib/monitoring/fallback-tracker';

// Mock Sentry
const mockSetTag = jest.fn();
const mockSetLevel = jest.fn();
const mockSetContext = jest.fn();
const mockScope = {
  setTag: mockSetTag,
  setLevel: mockSetLevel,
  setContext: mockSetContext,
};

jest.mock('@sentry/nextjs', () => ({
  withScope: jest.fn((cb: (scope: typeof mockScope) => void) => cb(mockScope)),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

describe('trackFallback', () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('severity: dangerous', () => {
    it('calls Sentry.captureMessage with level error', () => {
      trackFallback({
        domain: 'scoring',
        field: 'wave_height',
        fallbackValue: 0,
        severity: 'dangerous',
      });

      expect(Sentry.withScope).toHaveBeenCalledTimes(1);
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Fallback triggered: scoring.wave_height \u2192 0',
        'error'
      );
    });

    it('sets correct tags on scope', () => {
      trackFallback({
        domain: 'scoring',
        field: 'wave_height',
        fallbackValue: 0,
        severity: 'dangerous',
      });

      expect(mockSetTag).toHaveBeenCalledWith('fallback_domain', 'scoring');
      expect(mockSetTag).toHaveBeenCalledWith('fallback_field', 'wave_height');
      expect(mockSetTag).toHaveBeenCalledWith('fallback_severity', 'dangerous');
      expect(mockSetLevel).toHaveBeenCalledWith('error');
    });

    it('does not call addBreadcrumb', () => {
      trackFallback({
        domain: 'scoring',
        field: 'wave_height',
        fallbackValue: 0,
        severity: 'dangerous',
      });

      expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
    });
  });

  describe('severity: high', () => {
    it('calls Sentry.captureMessage with level warning', () => {
      trackFallback({
        domain: 'forecast',
        field: 'confidence',
        fallbackValue: 50,
        severity: 'high',
      });

      expect(Sentry.withScope).toHaveBeenCalledTimes(1);
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Fallback triggered: forecast.confidence \u2192 50',
        'warning'
      );
    });

    it('sets correct tags on scope', () => {
      trackFallback({
        domain: 'forecast',
        field: 'confidence',
        fallbackValue: 50,
        severity: 'high',
      });

      expect(mockSetTag).toHaveBeenCalledWith('fallback_domain', 'forecast');
      expect(mockSetTag).toHaveBeenCalledWith('fallback_field', 'confidence');
      expect(mockSetTag).toHaveBeenCalledWith('fallback_severity', 'high');
      expect(mockSetLevel).toHaveBeenCalledWith('warning');
    });

    it('does not call addBreadcrumb', () => {
      trackFallback({
        domain: 'forecast',
        field: 'confidence',
        fallbackValue: 50,
        severity: 'high',
      });

      expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
    });
  });

  describe('severity: low', () => {
    it('calls Sentry.addBreadcrumb', () => {
      trackFallback({
        domain: 'session',
        field: 'tide',
        fallbackValue: 'mid',
        severity: 'low',
      });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'fallback',
        message: 'session.tide \u2192 mid',
        level: 'warning',
        data: undefined,
      });
    });

    it('does not call captureMessage or withScope', () => {
      trackFallback({
        domain: 'session',
        field: 'tide',
        fallbackValue: 'mid',
        severity: 'low',
      });

      expect(Sentry.withScope).not.toHaveBeenCalled();
      expect(Sentry.captureMessage).not.toHaveBeenCalled();
    });
  });

  describe('severity: medium', () => {
    it('calls Sentry.addBreadcrumb', () => {
      trackFallback({
        domain: 'forecast',
        field: 'wind_speed',
        fallbackValue: null,
        severity: 'medium',
        context: { beachId: 'abc-123' },
      });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'fallback',
        message: 'forecast.wind_speed \u2192 null',
        level: 'warning',
        data: { beachId: 'abc-123' },
      });
    });

    it('does not call captureMessage or withScope', () => {
      trackFallback({
        domain: 'forecast',
        field: 'wind_speed',
        fallbackValue: null,
        severity: 'medium',
      });

      expect(Sentry.withScope).not.toHaveBeenCalled();
      expect(Sentry.captureMessage).not.toHaveBeenCalled();
    });
  });

  describe('console.warn', () => {
    it('is called for every severity level', () => {
      const severities = ['low', 'medium', 'high', 'dangerous'] as const;

      for (const severity of severities) {
        consoleWarnSpy.mockClear();

        trackFallback({
          domain: 'test',
          field: 'value',
          fallbackValue: 0,
          severity,
        });

        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      }
    });

    it('includes the [FALLBACK:domain:field] prefix', () => {
      trackFallback({
        domain: 'scoring',
        field: 'wave_height',
        fallbackValue: 3,
        severity: 'low',
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[FALLBACK:scoring:wave_height]',
        expect.objectContaining({
          fallbackValue: 3,
          severity: 'low',
        })
      );
    });

    it('includes structured data with timestamp', () => {
      trackFallback({
        domain: 'forecast',
        field: 'confidence',
        fallbackValue: 50,
        severity: 'high',
        reason: 'API timeout',
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[FALLBACK:forecast:confidence]',
        expect.objectContaining({
          fallbackValue: 50,
          severity: 'high',
          reason: 'API timeout',
          timestamp: expect.any(String),
        })
      );
    });

    it('spreads context fields into the logged object', () => {
      trackFallback({
        domain: 'scoring',
        field: 'wave_height',
        fallbackValue: 0,
        severity: 'low',
        context: { beachId: 'abc-123', source: 'cdip' },
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[FALLBACK:scoring:wave_height]',
        expect.objectContaining({
          beachId: 'abc-123',
          source: 'cdip',
        })
      );
    });
  });

  describe('context handling', () => {
    it('passes context to scope.setContext when provided (high/dangerous)', () => {
      const context = { beachId: 'beach-1', forecastDate: '2026-02-11' };

      trackFallback({
        domain: 'forecast',
        field: 'wave_height',
        fallbackValue: 0,
        severity: 'dangerous',
        context,
      });

      expect(mockSetContext).toHaveBeenCalledWith('fallback', context);
    });

    it('does not call scope.setContext when context is omitted', () => {
      trackFallback({
        domain: 'forecast',
        field: 'wave_height',
        fallbackValue: 0,
        severity: 'dangerous',
      });

      expect(mockSetContext).not.toHaveBeenCalled();
    });

    it('passes context as breadcrumb data for low/medium severity', () => {
      const context = { beachId: 'beach-1' };

      trackFallback({
        domain: 'session',
        field: 'tide',
        fallbackValue: 'mid',
        severity: 'low',
        context,
      });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          data: context,
        })
      );
    });
  });

  describe('fallbackValue formatting', () => {
    it('handles string fallback values in the message', () => {
      trackFallback({
        domain: 'forecast',
        field: 'swell_direction',
        fallbackValue: 'W',
        severity: 'high',
      });

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Fallback triggered: forecast.swell_direction \u2192 W',
        'warning'
      );
    });

    it('handles null fallback values in the message', () => {
      trackFallback({
        domain: 'forecast',
        field: 'wind_speed',
        fallbackValue: null,
        severity: 'dangerous',
      });

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Fallback triggered: forecast.wind_speed \u2192 null',
        'error'
      );
    });

    it('handles numeric fallback values in the message', () => {
      trackFallback({
        domain: 'scoring',
        field: 'confidence',
        fallbackValue: 0,
        severity: 'high',
      });

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Fallback triggered: scoring.confidence \u2192 0',
        'warning'
      );
    });
  });
});
