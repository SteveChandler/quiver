import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  lookupCityBySlug,
  lookupCityByCityAndStateSlug,
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
