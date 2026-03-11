'use server';

import { withAuthenticatedAction } from '@/lib/server-action-utils';
import { track } from '@/lib/analytics';

interface OnboardingData {
  fullName?: string;
  displayName?: string;
  homeBeachId?: string;
  homeBeachName?: string;
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  preferredTime?: 'dawn' | 'after_work' | 'weekends';
  surfStyles?: string[];
  preferredWaveSize?: 'small' | 'medium' | 'large' | 'any';
  preferredBreakType?: 'beach' | 'point' | 'reef' | 'any';
  crowdPreference?: 'social' | 'moderate' | 'solitude';
  pushEnabled?: boolean;
  emailEnabled?: boolean;
}

/**
 * Skip onboarding permanently by setting onboarding_completed_at.
 * Called when user dismisses the onboarding dialog.
 */
export async function skipOnboarding() {
  return withAuthenticatedAction(async (user, supabase) => {
    const { error } = await supabase
      .from('profiles')
      .update({
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      console.error('Failed to skip onboarding:', error);
      throw error;
    }

    track('onboarding_skipped', {
      user_id: user.id,
    });

    return { success: true };
  });
}

export async function saveOnboardingData(data: OnboardingData) {
  return withAuthenticatedAction(async (user, supabase) => {
    try {
      console.log('[onboarding] Saving data...');

      // Enforce required field for onboarding completion.
      // (Hybrid approach: only home beach is required; everything else may be skipped.)
      if (!data.homeBeachId) {
        return {
          success: false,
          error: 'Please select a home beach to continue.',
        };
      }
      
      // Check if display name is taken by another user
      if (data.displayName) {
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('display_name', data.displayName)
          .neq('id', user.id)
          .maybeSingle();

        if (existingUser) {
          return {
            success: false,
            error: 'Display name is already taken. Please choose another.',
          };
        }
      }

      // Update profile with all collected data (only set fields that were collected)
      const profileUpdate: Record<string, unknown> = {
        home_beach_id: data.homeBeachId,
        onboarding_completed_at: new Date().toISOString(),
      };

      // Only override notification prefs if explicitly provided
      if (data.pushEnabled !== undefined) profileUpdate.notif_push_enabled = data.pushEnabled;
      if (data.emailEnabled !== undefined) profileUpdate.notif_email_enabled = data.emailEnabled;

      // Only set fields that were actually collected
      if (data.fullName) profileUpdate.full_name = data.fullName;
      if (data.displayName) profileUpdate.display_name = data.displayName;
      if (data.experienceLevel) profileUpdate.experience_level = data.experienceLevel;
      if (data.surfStyles?.length) profileUpdate.surf_styles = data.surfStyles;
      if (data.preferredWaveSize) profileUpdate.preferred_wave_size = data.preferredWaveSize;
      if (data.preferredBreakType) profileUpdate.preferred_break_type = data.preferredBreakType;
      if (data.crowdPreference) profileUpdate.crowd_preference = data.crowdPreference;

      // Map onboarding time bucket to oracle preferred_session_time
      const SESSION_TIME_MAP: Record<string, string> = {
        dawn: 'dawn_patrol',
        after_work: 'evening',
        weekends: 'any',
      };
      if (data.preferredTime) {
        profileUpdate.preferred_session_time = SESSION_TIME_MAP[data.preferredTime] ?? 'any';
      }

      const { data: updatedProfile, error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', user.id)
        .select()
        .single();

      if (profileError) {
        console.error('Profile update error:', profileError);
        throw new Error(profileError.message);
      }

      if (!updatedProfile) {
        throw new Error('Profile not found. Please ensure your account is fully set up.');
      }

      // Create default email preferences (non-blocking)
      // This ensures users receive forecast-digest-email (Mon/Thu)
      if (data.homeBeachId && data.emailEnabled !== false) {
        try {
          await supabase.from('user_email_prefs').upsert({
            user_id: user.id,
            email_frequency: 'daily',
            min_good_score: 6.0,
            skill_level: data.experienceLevel === 'expert' ? 'advanced' : (data.experienceLevel || 'beginner'),
            pref_time_bucket: data.preferredTime || 'dawn',
            timezone: 'America/Los_Angeles',
            home_beach_id: data.homeBeachId,
          }, { onConflict: 'user_id' });
        } catch (prefsErr) {
          console.warn('[onboarding] Email prefs creation error (non-blocking):', prefsErr);
        }
      }

      // Award welcome XP for completing onboarding
      try {
        const { trackXP } = await import('@/lib/gamification');
        await trackXP('onboarding_completed', user.id);
      } catch (xpError) {
        console.log('XP tracking not available:', xpError);
      }

      // Track analytics
      track('onboarding_completed', {
        user_id: user.id,
        has_home_beach: !!data.homeBeachId,
        experience_level: data.experienceLevel,
        surf_styles_count: data.surfStyles?.length || 0,
        push_enabled: data.pushEnabled || false,
        email_enabled: data.emailEnabled !== false,
      });

      return { success: true, profile: updatedProfile };
    } catch (error: unknown) {
      console.error('Failed to save onboarding data:', error);

      // Handle unique constraint violation specifically
      const errorMessage = error instanceof Error ? error.message : '';
      const errorCode = error && typeof error === 'object' && 'code' in error
        ? (error as { code: unknown }).code
        : undefined;

      if (errorMessage.includes('idx_profiles_display_name') || errorCode === '23505') {
        return {
          success: false,
          error: 'Display name is already taken. Please choose another.',
        };
      }

      return {
        success: false,
        error: errorMessage || 'Failed to save your preferences',
      };
    }
  });
}
