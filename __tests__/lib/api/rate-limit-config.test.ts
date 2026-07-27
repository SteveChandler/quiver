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
});
