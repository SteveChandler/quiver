import {
  classifyUsageCoverage,
  UsageGate,
  UsageSurface,
} from '@/scripts/qa/usage-coverage-drift';

describe('usage coverage drift', () => {
  const gates: UsageGate[] = [
    {
      id: 'home',
      label: 'Home',
      expectedRankMax: 2,
      coverage: 'covered',
      source: 'shared',
    },
    {
      id: 'community',
      label: 'Community',
      expectedRankMax: 3,
      coverage: 'covered-smoke-only',
      source: 'native',
    },
  ];

  it('keeps covered surfaces green when current usage rank is inside the manifest threshold', () => {
    const surfaces: UsageSurface[] = [
      { id: 'Home', label: 'Home', weight: 100 },
      { id: 'BeachDetail', label: 'BeachDetail', weight: 90 },
      { id: 'Community', label: 'Community', weight: 80 },
    ];

    expect(classifyUsageCoverage(surfaces, gates)).toEqual([
      {
        ...gates[0],
        observedRank: 1,
        observedWeight: 100,
        status: 'covered',
      },
      {
        ...gates[1],
        observedRank: 3,
        observedWeight: 80,
        status: 'covered-smoke-only',
      },
    ]);
  });

  it('marks a manifest weight stale when observed usage falls below its expected rank', () => {
    const surfaces: UsageSurface[] = [
      { id: 'BeachDetail', label: 'BeachDetail', weight: 100 },
      { id: 'Explore', label: 'Explore', weight: 90 },
      { id: 'SessionForm', label: 'SessionForm', weight: 80 },
      { id: 'Home', label: 'Home', weight: 70 },
    ];

    const [home] = classifyUsageCoverage(surfaces, gates);

    expect(home).toMatchObject({
      id: 'home',
      observedRank: 4,
      observedWeight: 70,
      status: 'stale-weight',
    });
  });

  it('marks a gate missing when no observed surface maps to it', () => {
    const surfaces: UsageSurface[] = [
      { id: 'Home', label: 'Home', weight: 100 },
      { id: 'BeachDetail', label: 'BeachDetail', weight: 90 },
    ];

    const [, community] = classifyUsageCoverage(surfaces, gates);

    expect(community).toMatchObject({
      id: 'community',
      observedRank: null,
      observedWeight: 0,
      status: 'missing',
    });
  });
});
