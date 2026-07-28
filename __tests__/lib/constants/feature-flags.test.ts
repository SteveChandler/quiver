describe('feature flags', () => {
  const originalHeroWindowScore = process.env.HERO_WINDOW_SCORE;

  afterEach(() => {
    jest.resetModules();
    if (originalHeroWindowScore === undefined) {
      delete process.env.HERO_WINDOW_SCORE;
      return;
    }
    process.env.HERO_WINDOW_SCORE = originalHeroWindowScore;
  });

  it('enables the setup-aware Home hero ranker by default', () => {
    delete process.env.HERO_WINDOW_SCORE;

    jest.isolateModules(() => {
      const { FEATURE_HERO_WINDOW_SCORE } = require('@/lib/constants/feature-flags');

      expect(FEATURE_HERO_WINDOW_SCORE).toBe(true);
    });
  });

  it('allows an explicit false value to disable the Home hero ranker', () => {
    process.env.HERO_WINDOW_SCORE = 'false';

    jest.isolateModules(() => {
      const { FEATURE_HERO_WINDOW_SCORE } = require('@/lib/constants/feature-flags');

      expect(FEATURE_HERO_WINDOW_SCORE).toBe(false);
    });
  });
});
