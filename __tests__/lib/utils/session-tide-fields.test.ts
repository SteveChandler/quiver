/**
 * Test: Tide Fields Transformation in Session Utils
 *
 * Verifies that the new tide fields (tideHeight, tideStatus) are correctly
 * transformed from SessionFormState to database schema.
 */

import { transformSessionFormStateToDbSchema, sessionToFormState } from '@/lib/utils/session-utils';
import type { SessionFormState } from '@/hooks/use-session-form';

describe('Session Tide Fields Transformation', () => {
  describe('transformSessionFormStateToDbSchema', () => {
    it('should transform tide fields correctly', () => {
      const formState: SessionFormState = {
        selectedBeach: 'Pacific Beach',
        selectedBeachId: 'beach-123',
        selectedDate: '2026-01-07',
        selectedTime: '08:00',
        selectedBoard: '',
        duration: '90m',
        waveQuality: '',
        waterTemp: '65',
        crowdLevel: '',
        parkingEase: '',
        overallRating: '',
        notes: 'Great session with excellent tide conditions!',
        photos: [],
        waveTypes: [],
        selectedGoals: [],
        skillRatings: {},
        // New condition fields
        waveHeight: 4.5,
        windSpeed: 10,
        windDirection: 'NW',
        forecastAccuracy: 'accurate',
        // Tide fields
        tideHeight: 3.25,
        tideStatus: 'rising',
        isPublic: true,
        isMuted: false,
      };

      const dbData = transformSessionFormStateToDbSchema(formState);

      // Verify tide fields are transformed correctly
      expect(dbData.tide_height_ft).toBe(3.25);
      expect(dbData.tide_status).toBe('rising');

      // Verify other condition fields are also present
      expect(dbData.wave_height_ft).toBe(4.5);
      expect(dbData.wind_speed_mph).toBe(10);
      expect(dbData.wind_direction).toBe('NW');
      expect(dbData.forecast_accuracy).toBe('accurate');
    });

    it('should handle missing tide fields gracefully', () => {
      const formState: SessionFormState = {
        selectedBeach: 'Pacific Beach',
        selectedBeachId: 'beach-123',
        selectedDate: '2026-01-07',
        selectedTime: '08:00',
        selectedBoard: '',
        duration: '60m',
        waveQuality: '',
        waterTemp: '',
        crowdLevel: '',
        parkingEase: '',
        overallRating: '',
        notes: '',
        photos: [],
        waveTypes: [],
        selectedGoals: [],
        skillRatings: {},
        isPublic: true,
        isMuted: false,
        // No tide fields provided
      };

      const dbData = transformSessionFormStateToDbSchema(formState);

      // Tide fields should not be present if not provided
      expect(dbData.tide_height_ft).toBeUndefined();
      expect(dbData.tide_status).toBeUndefined();
    });

    it('should handle partial tide data', () => {
      const formStateOnlyHeight: SessionFormState = {
        selectedBeach: 'Pacific Beach',
        selectedBeachId: 'beach-123',
        selectedDate: '2026-01-07',
        selectedTime: '08:00',
        selectedBoard: '',
        duration: '60m',
        waveQuality: '',
        waterTemp: '',
        crowdLevel: '',
        parkingEase: '',
        overallRating: '',
        notes: '',
        photos: [],
        waveTypes: [],
        selectedGoals: [],
        skillRatings: {},
        isPublic: true,
        isMuted: false,
        tideHeight: 2.5, // Only height provided
      };

      const dbData1 = transformSessionFormStateToDbSchema(formStateOnlyHeight);
      expect(dbData1.tide_height_ft).toBe(2.5);
      expect(dbData1.tide_status).toBeUndefined();

      const formStateOnlyStatus: SessionFormState = {
        selectedBeach: 'Pacific Beach',
        selectedBeachId: 'beach-123',
        selectedDate: '2026-01-07',
        selectedTime: '08:00',
        selectedBoard: '',
        duration: '60m',
        waveQuality: '',
        waterTemp: '',
        crowdLevel: '',
        parkingEase: '',
        overallRating: '',
        notes: '',
        photos: [],
        waveTypes: [],
        selectedGoals: [],
        skillRatings: {},
        isPublic: true,
        isMuted: false,
        tideStatus: 'falling', // Only status provided
      };

      const dbData2 = transformSessionFormStateToDbSchema(formStateOnlyStatus);
      expect(dbData2.tide_height_ft).toBeUndefined();
      expect(dbData2.tide_status).toBe('falling');
    });

    it('should handle all valid tide status values', () => {
      const validStatuses = ['rising', 'falling', 'high', 'low'] as const;

      validStatuses.forEach((status) => {
        const formState: SessionFormState = {
          selectedBeach: 'Pacific Beach',
          selectedBeachId: 'beach-123',
          selectedDate: '2026-01-07',
          selectedTime: '08:00',
          selectedBoard: '',
          duration: '60m',
          waveQuality: '',
          waterTemp: '',
          crowdLevel: '',
          parkingEase: '',
          overallRating: '',
          notes: '',
          photos: [],
          waveTypes: [],
          selectedGoals: [],
          skillRatings: {},
          isPublic: true,
          isMuted: false,
          tideStatus: status,
        };

        const dbData = transformSessionFormStateToDbSchema(formState);
        expect(dbData.tide_status).toBe(status);
      });
    });
  });

  describe('sessionToFormState', () => {
    it('should reverse transform tide fields from database to form state', () => {
      const sessionData = {
        id: 'session-123',
        beach_id: 'beach-123',
        beach_name: 'Pacific Beach',
        arrival_time: '2026-01-07T08:00:00.000Z',
        duration_minutes: 90,
        wave_height_ft: 4.5,
        wind_speed_mph: 10,
        wind_direction: 'NW',
        water_temp: 65,
        forecast_accuracy: 'accurate',
        tide_height_ft: 3.25,
        tide_status: 'rising',
        notes: 'Great session!',
      };

      const formState = sessionToFormState(sessionData);

      // Verify tide fields are transformed back correctly
      expect(formState.tideHeight).toBe(3.25);
      expect(formState.tideStatus).toBe('rising');

      // Verify other condition fields
      expect(formState.waveHeight).toBe(4.5);
      expect(formState.windSpeed).toBe(10);
      expect(formState.windDirection).toBe('NW');
      expect(formState.forecastAccuracy).toBe('accurate');
    });

    it('should handle missing tide fields when converting from database', () => {
      const sessionData = {
        id: 'session-123',
        beach_id: 'beach-123',
        beach_name: 'Pacific Beach',
        arrival_time: '2026-01-07T08:00:00.000Z',
        duration_minutes: 60,
        // No tide fields
      };

      const formState = sessionToFormState(sessionData);

      expect(formState.tideHeight).toBeUndefined();
      expect(formState.tideStatus).toBeUndefined();
    });
  });
});
