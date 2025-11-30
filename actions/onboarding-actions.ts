'use server';

import { withAuthenticatedAction } from '@/lib/server-action-utils';
import { track } from '@/lib/analytics';

interface OnboardingData {
  fullName?: string;
  displayName?: string;
  homeBeachId?: string;
  homeBeachName?: string;
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  surfStyles?: string[];
  preferredWaveSize?: 'small' | 'medium' | 'large' | 'any';
  preferredBreakType?: 'beach' | 'point' | 'reef' | 'any';
  crowdPreference?: 'social' | 'moderate' | 'solitude';
  referralCode?: string;
  pushEnabled?: boolean;
  emailEnabled?: boolean;
}

export async function saveOnboardingData(data: OnboardingData) {
  return withAuthenticatedAction(async (user, supabase) => {
    try {
      // Update profile with all collected data
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: data.fullName,
          display_name: data.displayName,
          home_beach_id: data.homeBeachId || null,
          experience_level: data.experienceLevel || null,
          surf_styles: data.surfStyles || [],
          preferred_wave_size: data.preferredWaveSize || null,
          preferred_break_type: data.preferredBreakType || null,
          crowd_preference: data.crowdPreference || null,
          notif_push_enabled: data.pushEnabled ?? true,
          notif_email_enabled: data.emailEnabled ?? true,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileError) {
        console.error('Profile update error:', profileError);
        throw new Error(profileError.message);
      }

      // Process referral code if provided
      if (data.referralCode) {
        const { data: referrer } = await supabase
          .from('profiles')
          .select('id, referral_code')
          .eq('referral_code', data.referralCode)
          .maybeSingle();

        if (referrer) {
          // Create referral record
          const { error: referralError } = await supabase
            .from('referrals')
            .insert({
              referrer_id: referrer.id,
              referee_id: user.id,
              referral_code: data.referralCode,
              status: 'completed',
              completed_at: new Date().toISOString(),
            });

          if (!referralError) {
            // Award XP for both users (if gamification system exists)
            try {
              const { trackXP } = await import('@/lib/gamification-actions');
              await trackXP('referral_signup', user.id, 'invite');
              await trackXP('successful_referral', referrer.id, 'invite');
            } catch (xpError) {
              console.log('XP tracking not available:', xpError);
            }
          }
        }
      }

      // Award welcome XP for completing onboarding
      try {
        const { trackXP } = await import('@/lib/gamification-actions');
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
        used_referral: !!data.referralCode,
        push_enabled: data.pushEnabled || false,
        email_enabled: data.emailEnabled !== false,
      });

      return { success: true };
    } catch (error: any) {
      console.error('Failed to save onboarding data:', error);
      return {
        success: false,
        error: error.message || 'Failed to save your preferences',
      };
    }
  });
}

