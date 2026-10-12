describe('recommendation rate-limit configuration', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const mutableEnv = process.env as Record<string, string | undefined>;
  const setNodeEnv = (value: string | undefined): void => {
    if (value === undefined) {
      delete mutableEnv.NODE_ENV;
      return;
    }
    mutableEnv.NODE_ENV = value;
  };

  afterEach(() => {
    jest.resetModules();
    setNodeEnv(originalNodeEnv);
  });

  it('allows the documented production per-minute discovery budget', () => {
    jest.resetModules();
    setNodeEnv('production');

    const { RATE_LIMITS } = require('@/lib/api/rate-limit-config');
    const { EnhancedRateLimiter } = require('@/lib/utils/enhanced-rate-limiter');
    const discovery = RATE_LIMITS['surf-discovery'];

    expect(discovery.requestsPerMinute).toBe(15);
    expect(discovery.burstLimit).toBe(discovery.requestsPerMinute);
    expect(discovery.burstLimit).toBeGreaterThanOrEqual(8);

    const limiter = new EnhancedRateLimiter('surf-discovery-test', discovery);
    for (let request = 0; request < discovery.requestsPerMinute; request += 1) {
      expect(limiter.canMakeRequest('authenticated-probe')).toBe(true);
      limiter.recordRequest('authenticated-probe', '/api/surf/discover');
    }
    expect(limiter.canMakeRequest('authenticated-probe')).toBe(false);
    limiter.destroy();
  });

  it('configures a distinct production surf-call bucket', () => {
    jest.resetModules();
    setNodeEnv('production');

    const { RATE_LIMITS } = require('@/lib/api/rate-limit-config');

    expect(RATE_LIMITS['surf-call']).toEqual({
      requestsPerMinute: 60,
      requestsPerHour: 600,
      burstLimit: 30,
    });
    expect(RATE_LIMITS['surf-call']).not.toBe(RATE_LIMITS['surf-discovery']);
  });

  it('lets forecast-bulk reach its per-minute budget in 10-second bursts', () => {
    jest.resetModules();
    setNodeEnv('production');
    jest.useFakeTimers({ now: new Date('2026-10-11T12:00:00Z') });

    const { RATE_LIMITS } = require('@/lib/api/rate-limit-config');
    const { EnhancedRateLimiter } = require('@/lib/utils/enhanced-rate-limiter');
    const bulk = RATE_LIMITS['forecast-bulk'];
    const limiter = new EnhancedRateLimiter('forecast-bulk-test', bulk);
    const request = (): boolean => {
      if (!limiter.canMakeRequest('map-client')) return false;
      limiter.recordRequest('map-client', '/api/forecasts/bulk');
      return true;
    };

    try {
      for (let call = 0; call < 20; call += 1) expect(request()).toBe(true);
      expect(request()).toBe(false);

      // Two more full bursts fit in the same minute.
      jest.advanceTimersByTime(10_001);
      for (let call = 0; call < 20; call += 1) expect(request()).toBe(true);
      jest.advanceTimersByTime(10_001);
      for (let call = 0; call < 20; call += 1) expect(request()).toBe(true);

      // The 61st inside the minute is still refused.
      jest.advanceTimersByTime(10_001);
      expect(request()).toBe(false);
    } finally {
      limiter.destroy();
      jest.useRealTimers();
    }
  });
});
