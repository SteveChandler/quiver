import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  lookupCityBySlug,
  lookupCityByCityAndStateSlug,
  getAllCitiesWithBeachSkills,
} from '@/actions/beach/beach-location-actions';

jest.mock('@/lib/supabase/server');

const mockCreate = createSupabaseServerClient as jest.Mock;

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
      mockCreate.mockResolvedValue(makeSupabaseFake(mockCities));

      const result = await lookupCityBySlug('san-diego');
      expect(result).toBeDefined();
      if (result) {
        expect(result.slug).toBe('san-diego');
        expect(result.stateSlug).toBe('ca');
        expect(result.cityName).toBe('San Diego');
        expect(result.stateName).toBe('CA');
      }
    });

    it('should return null for invalid slug', async () => {
      const mockCities = [
        { city: 'San Diego', state: 'CA', country: 'USA' },
      ];
      mockCreate.mockResolvedValue(makeSupabaseFake(mockCities));

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
      mockCreate.mockResolvedValue(supabase);

      const result = await lookupCityBySlug('san-diego');
      expect(result).toBeNull();
    });
  });

  describe('getAllCitiesWithBeachSkills', () => {
    function makeSkillSupabaseFake(
      beaches: Array<{ city: string; state: string; country: string | null; skill_level: string | null }>
    ) {
      const supabase = {
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
      const beaches = [
        { city: 'San Diego', state: 'CA', country: 'USA', skill_level: 'beginner' },
        { city: 'San Diego', state: 'CA', country: 'USA', skill_level: 'advanced' },
        { city: 'Malibu', state: 'CA', country: 'USA', skill_level: 'advanced' },
      ];
      mockCreate.mockResolvedValue(makeSkillSupabaseFake(beaches));

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
      const beaches = [
        { city: 'Waikiki', state: 'HI', country: 'USA', skill_level: 'longboard' },
      ];
      mockCreate.mockResolvedValue(makeSkillSupabaseFake(beaches));

      const result = await getAllCitiesWithBeachSkills(1);
      const waikiki = result.data?.find(c => c.city === 'Waikiki');
      expect(waikiki?.hasBeginnerBeaches).toBe(true);
    });

    it('should detect expert skill level as advanced', async () => {
      const beaches = [
        { city: 'Pipeline', state: 'HI', country: 'USA', skill_level: 'expert' },
      ];
      mockCreate.mockResolvedValue(makeSkillSupabaseFake(beaches));

      const result = await getAllCitiesWithBeachSkills(1);
      const pipeline = result.data?.find(c => c.city === 'Pipeline');
      expect(pipeline?.hasAdvancedBeaches).toBe(true);
    });

    it('should handle null skill_level gracefully', async () => {
      const beaches = [
        { city: 'Unknown', state: 'CA', country: 'USA', skill_level: null },
      ];
      mockCreate.mockResolvedValue(makeSkillSupabaseFake(beaches));

      const result = await getAllCitiesWithBeachSkills(1);
      const unknown = result.data?.find(c => c.city === 'Unknown');
      expect(unknown?.hasBeginnerBeaches).toBe(false);
      expect(unknown?.hasAdvancedBeaches).toBe(false);
    });

    it('should filter cities by minBeaches count', async () => {
      const beaches = [
        { city: 'Big City', state: 'CA', country: 'USA', skill_level: 'beginner' },
        { city: 'Big City', state: 'CA', country: 'USA', skill_level: 'advanced' },
        { city: 'Big City', state: 'CA', country: 'USA', skill_level: null },
        { city: 'Small Town', state: 'CA', country: 'USA', skill_level: 'beginner' },
      ];
      mockCreate.mockResolvedValue(makeSkillSupabaseFake(beaches));

      const result = await getAllCitiesWithBeachSkills(3);
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].city).toBe('Big City');
      expect(result.data?.[0].beachCount).toBe(3);
    });

    it('should handle database errors gracefully', async () => {
      const supabase = {
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
      mockCreate.mockResolvedValue(supabase);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = await getAllCitiesWithBeachSkills(1);
      expect(result.success).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('lookupCityByCityAndStateSlug', () => {
    it('should return city data for valid city+state', async () => {
      const mockCities = [
        { city: 'Oceanside', state: 'CA', country: 'USA' },
        { city: 'Oceanside', state: 'OR', country: 'USA' },
      ];
      mockCreate.mockResolvedValue(makeSupabaseFake(mockCities));

      const result = await lookupCityByCityAndStateSlug('oceanside', 'ca');
      expect(result).toBeDefined();
      if (result) {
        expect(result.slug).toBe('oceanside');
        expect(result.stateSlug).toBe('ca');
        expect(result.cityName).toBe('Oceanside');
        expect(result.stateName).toBe('CA');
      }
    });

    it('should distinguish between same city names in different states', async () => {
      const mockCities = [
        { city: 'Oceanside', state: 'CA', country: 'USA' },
        { city: 'Oceanside', state: 'OR', country: 'USA' },
      ];
      mockCreate.mockResolvedValue(makeSupabaseFake(mockCities));

      const resultCA = await lookupCityByCityAndStateSlug('oceanside', 'ca');
      expect(resultCA?.stateName).toBe('CA');

      mockCreate.mockResolvedValue(makeSupabaseFake(mockCities));
      const resultOR = await lookupCityByCityAndStateSlug('oceanside', 'or');
      expect(resultOR?.stateName).toBe('OR');
    });

    it('should return null for invalid combination', async () => {
      const mockCities = [
        { city: 'Oceanside', state: 'CA', country: 'USA' },
      ];
      mockCreate.mockResolvedValue(makeSupabaseFake(mockCities));

      const result = await lookupCityByCityAndStateSlug('nonexistent', 'ca');
      expect(result).toBeNull();
    });

    it('should return null for valid city but wrong state', async () => {
      const mockCities = [
        { city: 'Oceanside', state: 'CA', country: 'USA' },
      ];
      mockCreate.mockResolvedValue(makeSupabaseFake(mockCities));

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
      mockCreate.mockResolvedValue(supabase);

      const result = await lookupCityByCityAndStateSlug('oceanside', 'ca');
      expect(result).toBeNull();
    });
  });
});
