import { renderHook, act } from '@testing-library/react';
import { useIntelFormValidation, intelPostSchema } from '@/hooks/use-intel-form-validation';

describe('useIntelFormValidation', () => {
  describe('schema validation', () => {
    it('validates required title', () => {
      const result = intelPostSchema.safeParse({
        tag: 'conditions',
        title: '',
        description: 'test description',
      });
      expect(result.success).toBe(false);
    });

    it('validates required description', () => {
      const result = intelPostSchema.safeParse({
        tag: 'conditions',
        title: 'test title',
        description: '',
      });
      expect(result.success).toBe(false);
    });

    it('validates max title length', () => {
      const result = intelPostSchema.safeParse({
        tag: 'conditions',
        title: 'x'.repeat(101), // MAX_TITLE_LENGTH is 100
        description: 'test',
      });
      expect(result.success).toBe(false);
    });

    it('validates max description length', () => {
      const result = intelPostSchema.safeParse({
        tag: 'conditions',
        title: 'test',
        description: 'x'.repeat(501), // MAX_DESCRIPTION_LENGTH is 500
      });
      expect(result.success).toBe(false);
    });

    it('validates wave_height range (0-50)', () => {
      const valid = intelPostSchema.safeParse({
        tag: 'conditions',
        title: 'test',
        description: 'test',
        wave_height: 25,
      });
      expect(valid.success).toBe(true);

      const tooHigh = intelPostSchema.safeParse({
        tag: 'conditions',
        title: 'test',
        description: 'test',
        wave_height: 60,
      });
      expect(tooHigh.success).toBe(false);

      const negative = intelPostSchema.safeParse({
        tag: 'conditions',
        title: 'test',
        description: 'test',
        wave_height: -5,
      });
      expect(negative.success).toBe(false);
    });

    it('validates wind_speed range (0-150)', () => {
      const valid = intelPostSchema.safeParse({
        tag: 'conditions',
        title: 'test',
        description: 'test',
        wind_speed: 75,
      });
      expect(valid.success).toBe(true);

      const tooHigh = intelPostSchema.safeParse({
        tag: 'conditions',
        title: 'test',
        description: 'test',
        wind_speed: 200,
      });
      expect(tooHigh.success).toBe(false);
    });

    it('validates water_temp range (32-100)', () => {
      const valid = intelPostSchema.safeParse({
        tag: 'conditions',
        title: 'test',
        description: 'test',
        water_temp: 68,
      });
      expect(valid.success).toBe(true);

      const tooLow = intelPostSchema.safeParse({
        tag: 'conditions',
        title: 'test',
        description: 'test',
        water_temp: 20,
      });
      expect(tooLow.success).toBe(false);

      const tooHigh = intelPostSchema.safeParse({
        tag: 'conditions',
        title: 'test',
        description: 'test',
        water_temp: 110,
      });
      expect(tooHigh.success).toBe(false);
    });

    it('validates crowd_level range (1-5)', () => {
      const valid = intelPostSchema.safeParse({
        tag: 'conditions',
        title: 'test',
        description: 'test',
        crowd_level: 3,
      });
      expect(valid.success).toBe(true);

      const tooLow = intelPostSchema.safeParse({
        tag: 'conditions',
        title: 'test',
        description: 'test',
        crowd_level: 0,
      });
      expect(tooLow.success).toBe(false);

      const tooHigh = intelPostSchema.safeParse({
        tag: 'conditions',
        title: 'test',
        description: 'test',
        crowd_level: 6,
      });
      expect(tooHigh.success).toBe(false);
    });

    it('validates wind_direction enum', () => {
      const valid = intelPostSchema.safeParse({
        tag: 'conditions',
        title: 'test',
        description: 'test',
        wind_direction: 'OFFSHORE',
      });
      expect(valid.success).toBe(true);

      const invalid = intelPostSchema.safeParse({
        tag: 'conditions',
        title: 'test',
        description: 'test',
        wind_direction: 'INVALID',
      });
      expect(invalid.success).toBe(false);
    });

    it('validates forecast_accuracy enum', () => {
      const valid = intelPostSchema.safeParse({
        tag: 'conditions',
        title: 'test',
        description: 'test',
        forecast_accuracy: 'accurate',
      });
      expect(valid.success).toBe(true);

      const invalid = intelPostSchema.safeParse({
        tag: 'conditions',
        title: 'test',
        description: 'test',
        forecast_accuracy: 'invalid',
      });
      expect(invalid.success).toBe(false);
    });

    it('validates tag enum', () => {
      const valid = intelPostSchema.safeParse({
        tag: 'parking',
        title: 'test',
        description: 'test',
      });
      expect(valid.success).toBe(true);

      const invalid = intelPostSchema.safeParse({
        tag: 'invalid',
        title: 'test',
        description: 'test',
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe('generateConditionsSummary', () => {
    it('generates summary from wave types', () => {
      const { result } = renderHook(() => useIntelFormValidation());

      const summary = result.current.generateConditionsSummary({
        wave_types: ['clean', 'glassy'],
        crowd_level: null,
        wind_direction: null,
        wind_speed: null,
        water_temp: null,
      });

      expect(summary).toContain('Waves:');
      expect(summary).toContain('clean, glassy');
    });

    it('generates summary with crowd level', () => {
      const { result } = renderHook(() => useIntelFormValidation());

      const summary = result.current.generateConditionsSummary({
        wave_types: [],
        crowd_level: 4,
        wind_direction: null,
        wind_speed: null,
        water_temp: null,
      });

      expect(summary).toContain('Crowd: 4/5');
    });

    it('generates summary with wind direction', () => {
      const { result } = renderHook(() => useIntelFormValidation());

      const summary = result.current.generateConditionsSummary({
        wave_types: [],
        crowd_level: null,
        wind_direction: 'OFFSHORE',
        wind_speed: null,
        water_temp: null,
      });

      expect(summary).toContain('Wind: OFFSHORE');
    });

    it('generates summary with wind speed', () => {
      const { result } = renderHook(() => useIntelFormValidation());

      const summary = result.current.generateConditionsSummary({
        wave_types: [],
        crowd_level: null,
        wind_direction: null,
        wind_speed: 10,
        water_temp: null,
      });

      expect(summary).toContain('Wind Speed: 10 mph');
    });

    it('generates summary with water temp', () => {
      const { result } = renderHook(() => useIntelFormValidation());

      const summary = result.current.generateConditionsSummary({
        wave_types: [],
        crowd_level: null,
        wind_direction: null,
        wind_speed: null,
        water_temp: 68,
      });

      expect(summary).toContain('Water: 68F');
    });

    it('generates comprehensive summary with all fields', () => {
      const { result } = renderHook(() => useIntelFormValidation());

      const summary = result.current.generateConditionsSummary({
        wave_types: ['clean', 'hollow'],
        crowd_level: 3,
        wind_direction: 'OFFSHORE',
        wind_speed: 15,
        water_temp: 72,
      });

      expect(summary).toContain('Waves: clean, hollow');
      expect(summary).toContain('Crowd: 3/5');
      expect(summary).toContain('Wind: OFFSHORE');
      expect(summary).toContain('Wind Speed: 15 mph');
      expect(summary).toContain('Water: 72F');
    });

    it('returns default message when no conditions', () => {
      const { result } = renderHook(() => useIntelFormValidation());

      const summary = result.current.generateConditionsSummary({
        wave_types: [],
        crowd_level: null,
        wind_direction: null,
        wind_speed: null,
        water_temp: null,
      });

      expect(summary).toBe('Real-time conditions update');
    });

    it('handles empty wave_types array', () => {
      const { result } = renderHook(() => useIntelFormValidation());

      const summary = result.current.generateConditionsSummary({
        wave_types: [],
        crowd_level: 2,
        wind_direction: null,
        wind_speed: null,
        water_temp: null,
      });

      expect(summary).toBe('Crowd: 2/5');
    });

    it('handles undefined wave_types', () => {
      const { result } = renderHook(() => useIntelFormValidation());

      const summary = result.current.generateConditionsSummary({
        wave_types: undefined,
        crowd_level: 2,
        wind_direction: null,
        wind_speed: null,
        water_temp: null,
      });

      expect(summary).toBe('Crowd: 2/5');
    });
  });

  describe('validateBeforeSubmit', () => {
    it('returns missing fields array when title is empty', () => {
      const { result } = renderHook(() => useIntelFormValidation());

      const validation = result.current.validateBeforeSubmit({
        tag: 'conditions',
        title: '',
        description: 'test',
      });

      expect(validation.isValid).toBe(false);
      expect(validation.missingFields).toContain('title');
    });

    it('returns missing fields array when title is whitespace', () => {
      const { result } = renderHook(() => useIntelFormValidation());

      const validation = result.current.validateBeforeSubmit({
        tag: 'conditions',
        title: '   ',
        description: 'test',
      });

      expect(validation.isValid).toBe(false);
      expect(validation.missingFields).toContain('title');
    });

    it('returns missing fields array when description is empty', () => {
      const { result } = renderHook(() => useIntelFormValidation());

      const validation = result.current.validateBeforeSubmit({
        tag: 'conditions',
        title: 'test',
        description: '',
      });

      expect(validation.isValid).toBe(false);
      expect(validation.missingFields).toContain('description');
    });

    it('returns missing fields array when description is whitespace', () => {
      const { result } = renderHook(() => useIntelFormValidation());

      const validation = result.current.validateBeforeSubmit({
        tag: 'conditions',
        title: 'test',
        description: '   ',
      });

      expect(validation.isValid).toBe(false);
      expect(validation.missingFields).toContain('description');
    });

    it('returns both title and description when both are missing', () => {
      const { result } = renderHook(() => useIntelFormValidation());

      const validation = result.current.validateBeforeSubmit({
        tag: 'conditions',
        title: '',
        description: '',
      });

      expect(validation.isValid).toBe(false);
      expect(validation.missingFields).toContain('title');
      expect(validation.missingFields).toContain('description');
      expect(validation.missingFields).toHaveLength(2);
    });

    it('validates forecast_accuracy for check-in variant', () => {
      const { result } = renderHook(() => useIntelFormValidation({ variant: 'check-in' }));

      const validation = result.current.validateBeforeSubmit({
        tag: 'conditions',
        title: 'test',
        description: 'test',
        forecast_accuracy: null,
      });

      expect(validation.isValid).toBe(false);
      expect(validation.missingFields).toContain('forecast_accuracy');
    });

    it('does not require forecast_accuracy for intel variant', () => {
      const { result } = renderHook(() => useIntelFormValidation({ variant: 'intel' }));

      const validation = result.current.validateBeforeSubmit({
        tag: 'conditions',
        title: 'test',
        description: 'test',
        forecast_accuracy: null,
      });

      expect(validation.isValid).toBe(true);
      expect(validation.missingFields).not.toContain('forecast_accuracy');
    });

    it('passes when all required fields are present', () => {
      const { result } = renderHook(() => useIntelFormValidation());

      const validation = result.current.validateBeforeSubmit({
        tag: 'conditions',
        title: 'test',
        description: 'test',
      });

      expect(validation.isValid).toBe(true);
      expect(validation.missingFields).toHaveLength(0);
    });

    it('passes for check-in variant when all required fields are present', () => {
      const { result } = renderHook(() => useIntelFormValidation({ variant: 'check-in' }));

      const validation = result.current.validateBeforeSubmit({
        tag: 'conditions',
        title: 'test',
        description: 'test',
        forecast_accuracy: 'accurate',
      });

      expect(validation.isValid).toBe(true);
      expect(validation.missingFields).toHaveLength(0);
    });

    it('ignores optional fields in validation', () => {
      const { result } = renderHook(() => useIntelFormValidation());

      const validation = result.current.validateBeforeSubmit({
        tag: 'conditions',
        title: 'test',
        description: 'test',
        wave_height: null,
        wind_speed: null,
        wind_direction: null,
        water_temp: null,
        crowd_level: null,
        wave_types: [],
      });

      expect(validation.isValid).toBe(true);
    });
  });
});
