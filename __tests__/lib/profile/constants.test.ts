import {
  PROFILE_CORE_FIELDS,
  PROFILE_PREFERENCE_FIELDS,
  PROFILE_NOTIFICATION_FIELDS,
  PROFILE_FULL_SELECT,
  PROFILE_ONBOARDING_SELECT,
} from '@/lib/profile/constants';

describe('profile constants', () => {
  describe('PROFILE_CORE_FIELDS', () => {
    it('should include onboarding_completed_at', () => {
      expect(PROFILE_CORE_FIELDS).toContain('onboarding_completed_at');
    });

    it('should include essential profile fields', () => {
      expect(PROFILE_CORE_FIELDS).toContain('followers_count');
      expect(PROFILE_CORE_FIELDS).toContain('following_count');
      expect(PROFILE_CORE_FIELDS).toContain('created_at');
    });
  });

  describe('PROFILE_PREFERENCE_FIELDS', () => {
    it('should include surf style preferences', () => {
      expect(PROFILE_PREFERENCE_FIELDS).toContain('surf_styles');
      expect(PROFILE_PREFERENCE_FIELDS).toContain('preferred_wave_size');
      expect(PROFILE_PREFERENCE_FIELDS).toContain('preferred_break_type');
      expect(PROFILE_PREFERENCE_FIELDS).toContain('crowd_preference');
    });
  });

  describe('PROFILE_NOTIFICATION_FIELDS', () => {
    it('should include notification settings', () => {
      expect(PROFILE_NOTIFICATION_FIELDS).toContain('notif_push_enabled');
      expect(PROFILE_NOTIFICATION_FIELDS).toContain('notif_forecast_alerts');
    });
  });

  describe('PROFILE_FULL_SELECT', () => {
    it('should be a non-empty string', () => {
      expect(typeof PROFILE_FULL_SELECT).toBe('string');
      expect(PROFILE_FULL_SELECT.length).toBeGreaterThan(0);
    });

    it('should include home_beach relation', () => {
      expect(PROFILE_FULL_SELECT).toContain('home_beach:beaches');
    });

    it('should include onboarding_completed_at', () => {
      expect(PROFILE_FULL_SELECT).toContain('onboarding_completed_at');
    });
  });

  describe('PROFILE_ONBOARDING_SELECT', () => {
    it('should select only onboarding_completed_at field', () => {
      expect(PROFILE_ONBOARDING_SELECT).toBe('onboarding_completed_at');
    });

    it('should be a non-empty string', () => {
      expect(typeof PROFILE_ONBOARDING_SELECT).toBe('string');
      expect(PROFILE_ONBOARDING_SELECT.length).toBeGreaterThan(0);
    });
  });
});
