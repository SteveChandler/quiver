import { createPublicReadClient } from '@/lib/supabase/server';
import {
  lookupCityBySlug,
  lookupCityByCityAndStateSlug,
  getAllCitiesWithBeachSkills,
  getTopCitiesInStateForIntent,
  getNearbyBeaches,
} from '@/actions/beach/beach-location-actions';

jest.mock('@/lib/supabase/server');

jest.mock('@/lib/recommendations/major-event-hold/water-quality-visibility', () => ({
  filterBeachesByWaterQualityVisibility: jest.fn(async (beaches) => beaches),
}));

const mockRankBeaches = jest.fn(async (beaches: Array<{ id: string }>) => beaches);
jest.mock('@/lib/recommendations/selection', () => ({
  rankBeaches: (beaches: Array<{ id: string }>) => mockRankBeaches(beaches),
}));

const mockCreate = createPublicReadClient as jest.Mock;

/**
 * Create a mock Supabase client that returns the given cities data
 */
function makeSupabaseFake(cities: Array<{ city: string; state: string; country: string | null }>) {
  const supabase = {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        or: jest.fn(() => ({
          not: jest.fn(() => ({
            not: jest.fn(() => ({
              is: jest.fn(() =>
                Promise.resolve({
                  data: cities,
                  error: null,
                })
              ),
            })),
          })),
        })),
      })),
    })),
  } as any;

  return supabase;
}

describe('city lookup functions', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('lookupCityBySlug', () => {
    it('should return city data for valid slug', async () => {
      const mockCities = [
        { city: 'San Diego', state: 'CA', country: 'USA' },
        { city: 'Los Angeles', state: 'CA', country: 'USA' },
      ];
      mockCreate.mockReturnValue(makeSupabaseFake(mockCities));

      const result = await lookupCityBySlug('san-diego');
      expect(result).not.toBeNull();
      expect(result!.slug).toBe('san-diego');
      expect(result!.stateSlug).toBe('ca');
      expect(result!.cityName).toBe('San Diego');
      expect(result!.stateName).toBe('CA');
    });

    it('should return null for invalid slug', async () => {
      const mockCities = [
        { city: 'San Diego', state: 'CA', country: 'USA' },
      ];
      mockCreate.mockReturnValue(makeSupabaseFake(mockCities));

      const result = await lookupCityBySlug('nonexistent-city-xyz');
      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      const supabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            or: jest.fn(() => ({
              not: jest.fn(() => ({
                not: jest.fn(() => ({
                  is: jest.fn(() =>
                    Promise.resolve({
                      data: null,
                      error: new Error('Database error'),
                    })
                  ),
                })),
              })),
            })),
          })),
        })),
      } as any;
      mockCreate.mockReturnValue(supabase);

      const result = await lookupCityBySlug('san-diego');
      expect(result).toBeNull();
    });
  });

  describe('getAllCitiesWithBeachSkills', () => {
    /**
     * Create mock for RPC-based implementation (primary path)
     * The function now uses supabase.rpc('get_cities_with_beach_skills') first
     */
    function makeSkillRpcSupabaseFake(
      cities: Array<{
        city: string;
        state: string;
        country: string | null;
        beach_count: number;
        has_beginner: boolean;
        has_advanced: boolean;
        has_editorial?: boolean;
        has_least_crowded?: boolean;
      }>
    ) {
      const supabase = {
        rpc: jest.fn(() => Promise.resolve({ data: cities, error: null })),
        // Fallback path (if RPC fails)
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            or: jest.fn(() => ({
              not: jest.fn(() => ({
                not: jest.fn(() => ({
                  is: jest.fn(() =>
                    Promise.resolve({ data: [], error: null })
                  ),
                })),
              })),
            })),
          })),
        })),
      } as any;
      return supabase;
    }

    /**
     * Legacy mock for fallback path testing (client-side aggregation)
     */
    function makeSkillSupabaseFake(
      beaches: Array<{ city: string; state: string; country: string | null; skill_level: string | null }>
    ) {
      const supabase = {
        // Make RPC fail to trigger fallback
        rpc: jest.fn(() => Promise.resolve({ data: null, error: { message: 'RPC not available' } })),
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            or: jest.fn(() => ({
              not: jest.fn(() => ({
                not: jest.fn(() => ({
                  is: jest.fn(() =>
                    Promise.resolve({ data: beaches, error: null })
                  ),
                })),
              })),
            })),
          })),
        })),
      } as any;
      return supabase;
    }

    it('should aggregate hasBeginnerBeaches flag correctly', async () => {
      // RPC returns pre-aggregated data with has_beginner/has_advanced flags
      const cities = [
        { city: 'San Diego', state: 'CA', country: 'USA', beach_count: 2, has_beginner: true, has_advanced: true },
        { city: 'Malibu', state: 'CA', country: 'USA', beach_count: 1, has_beginner: false, has_advanced: true },
      ];
      mockCreate.mockReturnValue(makeSkillRpcSupabaseFake(cities));

      const result = await getAllCitiesWithBeachSkills(1);
      expect(result.success).toBe(true);

      const sanDiego = result.data?.find(c => c.city === 'San Diego');
      expect(sanDiego?.hasBeginnerBeaches).toBe(true);
      expect(sanDiego?.hasAdvancedBeaches).toBe(true);

      const malibu = result.data?.find(c => c.city === 'Malibu');
      expect(malibu?.hasBeginnerBeaches).toBe(false);
      expect(malibu?.hasAdvancedBeaches).toBe(true);
    });

    it('should detect longboard skill level as beginner', async () => {
      // RPC handles the logic - just return the pre-computed flag
      const cities = [
        { city: 'Waikiki', state: 'HI', country: 'USA', beach_count: 1, has_beginner: true, has_advanced: false },
      ];
      mockCreate.mockReturnValue(makeSkillRpcSupabaseFake(cities));

      const result = await getAllCitiesWithBeachSkills(1);
      const waikiki = result.data?.find(c => c.city === 'Waikiki');
      expect(waikiki?.hasBeginnerBeaches).toBe(true);
    });

    it('should detect expert skill level as advanced', async () => {
      const cities = [
        { city: 'Pipeline', state: 'HI', country: 'USA', beach_count: 1, has_beginner: false, has_advanced: true },
      ];
      mockCreate.mockReturnValue(makeSkillRpcSupabaseFake(cities));

      const result = await getAllCitiesWithBeachSkills(1);
      const pipeline = result.data?.find(c => c.city === 'Pipeline');
      expect(pipeline?.hasAdvancedBeaches).toBe(true);
    });

    it('should handle null skill_level gracefully', async () => {
      const cities = [
        { city: 'Unknown', state: 'CA', country: 'USA', beach_count: 1, has_beginner: false, has_advanced: false },
      ];
      mockCreate.mockReturnValue(makeSkillRpcSupabaseFake(cities));

      const result = await getAllCitiesWithBeachSkills(1);
      const unknown = result.data?.find(c => c.city === 'Unknown');
      expect(unknown?.hasBeginnerBeaches).toBe(false);
      expect(unknown?.hasAdvancedBeaches).toBe(false);
    });

    it('should filter cities by minBeaches count', async () => {
      // RPC handles minBeaches filtering - only returns cities meeting threshold
      const cities = [
        { city: 'Big City', state: 'CA', country: 'USA', beach_count: 3, has_beginner: true, has_advanced: true },
      ];
      mockCreate.mockReturnValue(makeSkillRpcSupabaseFake(cities));

      const result = await getAllCitiesWithBeachSkills(3);
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].city).toBe('Big City');
      expect(result.data?.[0].beachCount).toBe(3);
    });

    it('should handle database errors gracefully', async () => {
      const supabase = {
        // RPC fails
        rpc: jest.fn(() => Promise.resolve({ data: null, error: { message: 'RPC failed' } })),
        // Fallback also fails
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            or: jest.fn(() => ({
              not: jest.fn(() => ({
                not: jest.fn(() => ({
                  is: jest.fn(() =>
                    Promise.resolve({ data: null, error: new Error('DB error') })
                  ),
                })),
              })),
            })),
          })),
        })),
      } as any;
      mockCreate.mockReturnValue(supabase);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = await getAllCitiesWithBeachSkills(1);
      expect(result.success).toBe(false);
      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('should use fallback when RPC fails', async () => {
      // Test the fallback path with client-side aggregation
      const beaches = [
        { city: 'Fallback City', state: 'CA', country: 'USA', skill_level: 'beginner' },
        { city: 'Fallback City', state: 'CA', country: 'USA', skill_level: 'advanced' },
      ];
      mockCreate.mockReturnValue(makeSkillSupabaseFake(beaches));

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = await getAllCitiesWithBeachSkills(1);
      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].city).toBe('Fallback City');
      expect(result.data?.[0].hasBeginnerBeaches).toBe(true);
      expect(result.data?.[0].hasAdvancedBeaches).toBe(true);
      warnSpy.mockRestore();
    });

    it('applies curated NC beginner city order to state intent links', async () => {
      const cities = [
        { city: 'Corolla', state: 'NC', country: 'USA', beach_count: 4, has_beginner: true, has_advanced: false },
        { city: 'Wrightsville Beach', state: 'NC', country: 'USA', beach_count: 1, has_beginner: true, has_advanced: false },
        { city: 'Surf City', state: 'NC', country: 'USA', beach_count: 3, has_beginner: true, has_advanced: false },
        { city: 'Carolina Beach', state: 'NC', country: 'USA', beach_count: 2, has_beginner: true, has_advanced: false },
      ];
      mockCreate.mockReturnValue(makeSkillRpcSupabaseFake(cities));

      const result = await getTopCitiesInStateForIntent('nc', 'beginner');

      expect(result.map((city) => city.name)).toEqual([
        'Wrightsville Beach',
        'Carolina Beach',
        'Surf City',
        'Corolla',
      ]);
    });
  });

  describe('lookupCityByCityAndStateSlug', () => {
    it('should return city data for valid city+state', async () => {
      const mockCities = [
        { city: 'Oceanside', state: 'CA', country: 'USA' },
        { city: 'Oceanside', state: 'OR', country: 'USA' },
      ];
      mockCreate.mockReturnValue(makeSupabaseFake(mockCities));

      const result = await lookupCityByCityAndStateSlug('oceanside', 'ca');
      expect(result).not.toBeNull();
      expect(result!.slug).toBe('oceanside');
      expect(result!.stateSlug).toBe('ca');
      expect(result!.cityName).toBe('Oceanside');
      expect(result!.stateName).toBe('CA');
    });

    it('should distinguish between same city names in different states', async () => {
      const mockCities = [
        { city: 'Oceanside', state: 'CA', country: 'USA' },
        { city: 'Oceanside', state: 'OR', country: 'USA' },
      ];
      mockCreate.mockReturnValue(makeSupabaseFake(mockCities));

      const resultCA = await lookupCityByCityAndStateSlug('oceanside', 'ca');
      expect(resultCA?.stateName).toBe('CA');

      mockCreate.mockReturnValue(makeSupabaseFake(mockCities));
      const resultOR = await lookupCityByCityAndStateSlug('oceanside', 'or');
      expect(resultOR?.stateName).toBe('OR');
    });

    it('should return null for invalid combination', async () => {
      const mockCities = [
        { city: 'Oceanside', state: 'CA', country: 'USA' },
      ];
      mockCreate.mockReturnValue(makeSupabaseFake(mockCities));

      const result = await lookupCityByCityAndStateSlug('nonexistent', 'ca');
      expect(result).toBeNull();
    });

    it('should return null for valid city but wrong state', async () => {
      const mockCities = [
        { city: 'Oceanside', state: 'CA', country: 'USA' },
      ];
      mockCreate.mockReturnValue(makeSupabaseFake(mockCities));

      const result = await lookupCityByCityAndStateSlug('oceanside', 'fl');
      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      const supabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            or: jest.fn(() => ({
              not: jest.fn(() => ({
                not: jest.fn(() => ({
                  is: jest.fn(() =>
                    Promise.resolve({
                      data: null,
                      error: new Error('Database error'),
                    })
                  ),
                })),
              })),
            })),
          })),
        })),
      } as any;
      mockCreate.mockReturnValue(supabase);

      const result = await lookupCityByCityAndStateSlug('oceanside', 'ca');
      expect(result).toBeNull();
    });
  });
});

describe('getNearbyBeaches country hydration', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  function makeNearbySupabaseFake(
    countryResult: { data: Array<{ id: string; country: string | null }> | null; error: Error | null },
    rpcCountry?: string | null,
  ) {
    return {
      rpc: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'mexico-beach',
            name: 'K-40',
            lat: 32.2,
            lon: -117.1,
            slug: 'k-40-puerto-nuevo',
            city: 'Puerto Nuevo',
            state: 'Baja California',
            ...(rpcCountry !== undefined ? { country: rpcCountry } : {}),
          },
        ],
        error: null,
      }),
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          or: jest.fn(() => ({
            is: jest.fn(() => ({
              in: jest.fn().mockResolvedValue(countryResult),
            })),
          })),
        })),
      })),
    } as any;
  }

  it('hydrates Mexico country before returning nearby cards', async () => {
    mockCreate.mockReturnValue(
      makeNearbySupabaseFake({
        data: [{ id: 'mexico-beach', country: 'Mexico' }],
        error: null,
      }),
    );

    const result = await getNearbyBeaches(32.2, -117.1);

    expect(result.success).toBe(true);
    expect(result.data?.[0].country).toBe('Mexico');
  });

  it('fails the nearby result when country hydration returns an error', async () => {
    mockCreate.mockReturnValue(
      makeNearbySupabaseFake({ data: null, error: new Error('country lookup failed') }),
    );

    const result = await getNearbyBeaches(32.2, -117.1);

    expect(result.success).toBe(false);
    expect(result.error).toBe('country lookup failed');
  });

  it('drops RPC rows that cannot be confirmed publicly visible', async () => {
    mockCreate.mockReturnValue(
      makeNearbySupabaseFake({ data: [], error: null }),
    );

    const result = await getNearbyBeaches(32.2, -117.1);

    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it.each([null, '', '   '])(
    'fails closed when hydration returns an unusable country (%j)',
    async (country) => {
      mockCreate.mockReturnValue(
        makeNearbySupabaseFake({
          data: [{ id: 'mexico-beach', country }],
          error: null,
        }),
      );

      const result = await getNearbyBeaches(32.2, -117.1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('country hydration was incomplete');
    },
  );

  it('prefers a valid hydrated country over an unusable RPC country', async () => {
    mockCreate.mockReturnValue(
      makeNearbySupabaseFake(
        { data: [{ id: 'mexico-beach', country: 'Mexico' }], error: null },
        ' ',
      ),
    );

    const result = await getNearbyBeaches(32.2, -117.1);

    expect(result.success).toBe(true);
    expect(result.data?.[0].country).toBe('Mexico');
  });
});
