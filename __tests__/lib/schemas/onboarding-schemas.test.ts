import {
  homeBeachSchema,
  type HomeBeachFormData,
} from '@/lib/schemas/onboarding-schemas';

describe('Onboarding Schemas', () => {
  describe('homeBeachSchema', () => {
    describe('Valid Data', () => {
      it('accepts valid home beach data', () => {
        const validData = {
          homeBeachId: '123e4567-e89b-12d3-a456-426614174000',
          homeBeachName: 'Malibu Beach',
        };

        const result = homeBeachSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(validData);
        }
      });
    });

    describe('Invalid Data', () => {
      it('rejects empty homeBeachId', () => {
        const invalidData = {
          homeBeachId: '',
          homeBeachName: 'Malibu Beach',
        };

        const result = homeBeachSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('Please select a beach');
        }
      });

      it('rejects empty homeBeachName', () => {
        const invalidData = {
          homeBeachId: '123',
          homeBeachName: '',
        };

        const result = homeBeachSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('rejects missing homeBeachId', () => {
        const invalidData = {
          homeBeachName: 'Malibu Beach',
        };

        const result = homeBeachSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });
  });
});
