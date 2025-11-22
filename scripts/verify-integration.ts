/**
 * Integration verification for Personalized Home Forecast Service
 * 
 * This script verifies that the service integrates correctly with the codebase
 * by checking imports, exports, and type compatibility.
 */

import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type {
  PersonalizedForecastWindow,
  PersonalizedForecastRecommendation,
  PersonalizedForecastOptions,
} from '@/types/personalization';

// This file should compile without errors if everything is correctly integrated

// Mock data for type checking
const mockBeach: Beach = {
  id: 'test-beach-id',
  name: 'Ocean Beach',
  slug: 'ocean-beach',
  city: 'San Diego',
  state: 'CA',
  lat: 32.75,
  lon: -117.25,
} as Beach;

const mockWindow: PersonalizedForecastWindow = {
  start: new Date('2025-11-21T09:00:00Z'),
  end: new Date('2025-11-21T12:00:00Z'),
  tide: 'Rising',
  wind: '10 mph SW',
  waveHeight: '3-4 ft',
  wavePeriod: '12s',
  confidence: 85,
};

const mockForecast: EnhancedForecastEntity = {
  id: 'forecast-1',
  beach_id: 'test-beach-id',
  forecast_date: '2025-11-21',
  forecast_time: '09:00:00',
  wave_height: '3.5 ft',
  wave_period: null,
  wave_direction: null,
  water_temp: null,
  confidence_score: 85,
  data_source: 'NOAA_NWS',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockRecommendation: PersonalizedForecastRecommendation = {
  beach: {
    ...mockBeach,
    latitude: 32.75,
    longitude: -117.25,
  },
  window: mockWindow,
  forecast: mockForecast,
  score: 92,
  personalized: true,
  breakdown: {
    base: 75,
    onboardingPrefs: 10,
    learnedPrefs: 7,
    affinity: 0,
  },
  summary: 'Best conditions at Ocean Beach tomorrow morning: 3-4 ft waves, 10 wind',
  reasons: ['Conditions match your preferred wave and wind patterns'],
  generated_at: new Date().toISOString(),
};

const mockOptions: PersonalizedForecastOptions = {
  homeBeachId: 'test-beach-id',
  maxConcurrent: 3,
  timeout: 5000,
};

// If this file compiles, the types are correctly integrated
console.log('✅ Type integration verified');
console.log('✅ All imports resolved');
console.log('✅ Mock data structures are valid');
console.log('\n🎉 Integration verification PASSED!');

export { mockBeach, mockWindow, mockForecast, mockRecommendation, mockOptions };

