import {
  profileSchema,
  homeBeachSchema,
  preferencesSchema,
  notificationsSchema,
  type ProfileFormData,
  type HomeBeachFormData,
  type PreferencesFormData,
  type NotificationsFormData,
} from '@/lib/schemas/onboarding-schemas';

describe('Onboarding Schemas', () => {
  describe('profileSchema', () => {
    describe('Valid Data', () => {
      it('accepts valid profile data', () => {
        const validData = {
          fullName: 'John Doe',
          displayName: 'JohnD123',
        };

        const result = profileSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(validData);
        }
      });

      it('accepts names with minimum length (2 characters)', () => {
        const validData = {
          fullName: 'Jo',
          displayName: 'Jo',
        };

        const result = profileSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('accepts names with maximum length (50 chars full, 30 chars display)', () => {
        const validData = {
          fullName: 'A'.repeat(50),
          displayName: 'A'.repeat(30),
        };

        const result = profileSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('accepts display names with underscores', () => {
        const validData = {
          fullName: 'John Doe',
          displayName: 'John_Doe_123',
        };

        const result = profileSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe('Invalid Data - fullName', () => {
      it('rejects fullName shorter than 2 characters', () => {
        const invalidData = {
          fullName: 'J',
          displayName: 'JohnD',
        };

        const result = profileSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('at least 2 characters');
        }
      });

      it('rejects fullName longer than 50 characters', () => {
        const invalidData = {
          fullName: 'A'.repeat(51),
          displayName: 'JohnD',
        };

        const result = profileSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('less than 50 characters');
        }
      });

      it('accepts empty fullName (optional field)', () => {
        const validData = {
          fullName: '',
          displayName: 'JohnD',
        };

        const result = profileSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe('Invalid Data - displayName', () => {
      it('rejects displayName shorter than 2 characters', () => {
        const invalidData = {
          fullName: 'John Doe',
          displayName: 'J',
        };

        const result = profileSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('at least 2 characters');
        }
      });

      it('rejects displayName longer than 30 characters', () => {
        const invalidData = {
          fullName: 'John Doe',
          displayName: 'A'.repeat(31),
        };

        const result = profileSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('less than 30 characters');
        }
      });

      it('rejects displayName with spaces', () => {
        const invalidData = {
          fullName: 'John Doe',
          displayName: 'John Doe',
        };

        const result = profileSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('letters, numbers, and underscores');
        }
      });

      it('rejects displayName with special characters', () => {
        const invalidData = {
          fullName: 'John Doe',
          displayName: 'John@Doe!',
        };

        const result = profileSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('letters, numbers, and underscores');
        }
      });

      it('rejects displayName with hyphens', () => {
        const invalidData = {
          fullName: 'John Doe',
          displayName: 'John-Doe',
        };

        const result = profileSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      it('accepts missing fullName (optional field)', () => {
        const validData = {
          displayName: 'JohnD',
        };

        const result = profileSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('accepts missing displayName (optional field)', () => {
        const validData = {
          fullName: 'John Doe',
        };

        const result = profileSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('accepts empty object (all fields optional)', () => {
        const validData = {};

        const result = profileSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });
  });

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

  describe('preferencesSchema', () => {
    describe('Valid Data', () => {
      it('accepts valid preferences with beginner level', () => {
        const validData = {
          experienceLevel: 'beginner' as const,
          surfStyles: ['longboard'],
        };

        const result = preferencesSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(validData);
        }
      });

      it('accepts all valid experience levels', () => {
        const levels = ['beginner', 'intermediate', 'advanced', 'expert'] as const;

        levels.forEach((level) => {
          const validData = {
            experienceLevel: level,
            surfStyles: ['shortboard'],
          };

          const result = preferencesSchema.safeParse(validData);
          expect(result.success).toBe(true);
        });
      });

      it('accepts multiple surf styles', () => {
        const validData = {
          experienceLevel: 'intermediate' as const,
          surfStyles: ['longboard', 'shortboard', 'funboard'],
        };

        const result = preferencesSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.surfStyles).toHaveLength(3);
        }
      });
    });

    describe('Invalid Data', () => {
      it('rejects invalid experience level', () => {
        const invalidData = {
          experienceLevel: 'pro',
          surfStyles: ['longboard'],
        };

        const result = preferencesSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('rejects empty surfStyles array', () => {
        const invalidData = {
          experienceLevel: 'beginner',
          surfStyles: [],
        };

        const result = preferencesSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('at least one style');
        }
      });

      it('rejects missing experienceLevel', () => {
        const invalidData = {
          surfStyles: ['longboard'],
        };

        const result = preferencesSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          // Accept either custom error or Zod's default enum error
          const errorMessage = result.error.issues[0].message;
          const hasExpectedError =
            errorMessage.includes('Please select your experience level') ||
            errorMessage.includes('Invalid option') ||
            errorMessage.includes('Required');
          expect(hasExpectedError).toBe(true);
        }
      });

      it('rejects missing surfStyles', () => {
        const invalidData = {
          experienceLevel: 'beginner',
        };

        const result = preferencesSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('notificationsSchema', () => {
    describe('Valid Data', () => {
      it('accepts valid notification preferences', () => {
        const validData = {
          pushEnabled: true,
          emailEnabled: false,
        };

        const result = notificationsSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(validData);
        }
      });

      it('applies default values when fields are missing', () => {
        const validData = {};

        const result = notificationsSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.pushEnabled).toBe(false);
          expect(result.data.emailEnabled).toBe(true);
        }
      });

      it('accepts explicit false values', () => {
        const validData = {
          pushEnabled: false,
          emailEnabled: false,
        };

        const result = notificationsSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.pushEnabled).toBe(false);
          expect(result.data.emailEnabled).toBe(false);
        }
      });

      it('accepts explicit true values', () => {
        const validData = {
          pushEnabled: true,
          emailEnabled: true,
        };

        const result = notificationsSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.pushEnabled).toBe(true);
          expect(result.data.emailEnabled).toBe(true);
        }
      });
    });

    describe('Invalid Data', () => {
      it('rejects non-boolean pushEnabled', () => {
        const invalidData = {
          pushEnabled: 'true',
          emailEnabled: true,
        };

        const result = notificationsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('rejects non-boolean emailEnabled', () => {
        const invalidData = {
          pushEnabled: true,
          emailEnabled: 1,
        };

        const result = notificationsSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('XSS Protection', () => {
    it('does not automatically sanitize XSS attempts in fullName', () => {
      const xssAttempt = {
        fullName: '<script>alert("XSS")</script>',
        displayName: 'ValidName',
      };

      const result = profileSchema.safeParse(xssAttempt);
      // Schema validates format but doesn't sanitize
      // Sanitization should happen server-side
      expect(result.success).toBe(true);
    });

    it('regex blocks XSS in displayName due to special characters', () => {
      const xssAttempt = {
        fullName: 'John Doe',
        displayName: '<script>alert()</script>',
      };

      const result = profileSchema.safeParse(xssAttempt);
      // Display name regex should block special characters
      expect(result.success).toBe(false);
    });
  });
});
