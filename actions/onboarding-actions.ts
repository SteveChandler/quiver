'use server';

import { withAuthenticatedAction } from '@/lib/server-action-utils';

interface OnboardingData {
  fullName?: string;
  displayName?: string;
  homeBeachId?: string;
  homeBeachName?: string;
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  preferredTime?: 'dawn' | 'after_work' | 'weekends';
  surfStyles?: string[];
  pushEnabled?: boolean;
  emailEnabled?: boolean;
  referralCode?: string;
}

/**
 * Lazily infer the user's home break from the first beach they view.
 *
 * Called fire-and-forget from the beach-detail client. Idempotent: only writes
 * if home_beach_id is currently NULL. This lets users who skipped onboarding
 * get personalized forecasts without ever setting a preference explicitly.
 *
 * Users can still change their home break explicitly via /profile → Edit.
 * See Fix 5 in plans/majestic-squishing-newell.md.
 */
export async function inferHomeBreakFromView(beachId: string) {
  return withAuthenticatedAction(async (user, supabase) => {
    if (!beachId) {
      return { success: false, skipped: true };
    }

    // Read current home_beach_id — only set it if NULL (idempotent).
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('home_beach_id')
      .eq('id', user.id)
      .single();

    if (fetchError) {
      console.warn('inferHomeBreakFromView: failed to read profile:', fetchError);
      return { success: false, skipped: true };
    }

    if (profile?.home_beach_id) {
      // Already set — respect the user's explicit or prior choice.
      return { success: true, skipped: true };
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ home_beach_id: beachId })
      .eq('id', user.id);

    if (updateError) {
      console.warn('inferHomeBreakFromView: failed to update profile:', updateError);
      return { success: false, skipped: true };
    }

    // Log for telemetry — lets us distinguish "explicit home break" from
    // "inferred home break" when debugging the post-skip funnel.
    const { error: eventError } = await supabase.from('user_events').insert({
      user_id: user.id,
      event_type: 'onboarding_step',
      beach_id: beachId,
      metadata: {
        step: 'home_break_inferred',
        step_name: 'home_break_inferred',
        source: 'server',
      },
    });

    if (eventError) {
      console.warn('inferHomeBreakFromView: failed to log event:', eventError);
    }

    return { success: true, inferred: true };
  });
}

/**
 * Re-open onboarding by clearing onboarding_completed_at.
 * Called from the /profile "Set up your home break" CTA when a user who
 * previously tapped "Maybe later" wants to configure their profile.
 *
 * The caller is responsible for refreshing the profile context and resetting
 * the onboarding store's isCompleted state so the dialog will actually render.
 * See components/profile/set-home-break-cta.tsx.
 */
export async function reopenOnboarding() {
  return withAuthenticatedAction(async (user, supabase) => {
    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_completed_at: null })
      .eq('id', user.id);

    if (error) {
      console.error('Failed to reopen onboarding:', error);
      throw error;
    }

    // Log the re-entry event for funnel analysis. Reuses 'onboarding_step' for
    // the same reason as the skip/complete events (DB CHECK constraint).
    const { error: eventError } = await supabase.from('user_events').insert({
      user_id: user.id,
      event_type: 'onboarding_step',
      metadata: {
        step: 'reopened_from_profile',
        step_name: 'reopened_from_profile',
        source: 'server',
      },
    });

    if (eventError) {
      console.warn('Failed to log onboarding_reopened event:', eventError);
    }

    return { success: true };
  });
}

/**
 * Skip onboarding permanently by setting onboarding_completed_at.
 * Called when user taps "Maybe later" on any step of the onboarding dialog.
 *
 * Users who skip can re-open the dialog from /profile via the "Set up your
 * home break" CTA (see Fix 4 in plans/majestic-squishing-newell.md).
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

    // Log a server-confirmed skip event to user_events. Reuses the existing
    // 'onboarding_step' event type (the table CHECK constraint only allows the
    // existing enum values), with metadata.step = 'skipped' to distinguish from
    // step transitions. This is NOT the same as lib/analytics.track() — that
    // function is a browser-only no-op when called from server actions, so the
    // previous track('onboarding_skipped') call never fired anywhere.
    // See project_server_analytics_noop.md for the diagnosis.
    const { error: eventError } = await supabase.from('user_events').insert({
      user_id: user.id,
      event_type: 'onboarding_step',
      metadata: {
        step: 'skipped',
        step_name: 'skipped',
        source: 'server',
      },
    });

    if (eventError) {
      // Don't fail the skip if telemetry insert fails — the profile update
      // already succeeded and is the user-visible outcome.
      console.warn('Failed to log onboarding_skipped event:', eventError);
    }

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

      // `preferred_session_time` is no longer captured during onboarding —
      // users set it post-onboarding via Oracle's in-app SessionTimeSelector,
      // which is the source of truth. Plan: abstract-exploring-phoenix (E2).

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

      // Seed a default alert rule on the user's home beach so they get a
      // retention hook ("you were right, I would've surfed") within their
      // first days. Falls back to mellow_session when experience_level is
      // null so every new user is reachable. Non-blocking.
      try {
        const { seedDefaultRuleForUser } = await import('@/lib/alerts/seed-default-rule');
        const seedResult = await seedDefaultRuleForUser({
          supabase,
          userId: user.id,
          beachId: data.homeBeachId,
          experienceLevel: data.experienceLevel ?? null,
          notifyEmail: updatedProfile.notif_email_enabled ?? true,
          notifyPush: updatedProfile.notif_push_enabled ?? false,
        });

        await supabase.from('user_events').insert({
          user_id: user.id,
          event_type: 'onboarding_step',
          metadata: {
            step: 'alert_rule_seeded',
            step_name: 'alert_rule_seeded',
            source: 'server',
            ...seedResult,
          },
        });
      } catch (seedErr) {
        console.warn('[onboarding] alert rule seed error (non-blocking):', seedErr);
      }

      // Generate referral code for new user and claim referral if provided (non-blocking)
      try {
        const { getOrCreateReferralCode, claimReferral } = await import('@/actions/referral-actions');
        await getOrCreateReferralCode();

        // If they arrived via a referral link, claim it
        if (data.referralCode) {
          await claimReferral(data.referralCode);
        }
      } catch (refErr) {
        console.warn('[onboarding] Referral handling error (non-blocking):', refErr);
      }

      // `user_email_prefs` upsert removed — verified dead-table write.
      // Earlier comment ("forecast-digest-email cron filters on
      // user_email_prefs.email_frequency / home_beach_id") was wrong;
      // re-audit on 2026-04-17 confirmed the cron reads `profiles`
      // directly (`notif_email_enabled`, `notif_forecast_alerts`,
      // `home_beach_id`). No cron, lib, hook, or component reads any
      // column of `user_email_prefs`. Writing to it on every onboard
      // was pure dead weight. If a future email-preference surface
      // needs this, give it a new table with readers, or add the
      // columns to `profiles` alongside the existing notif flags.
      // Plan: abstract-exploring-phoenix cleanup.

      // Award welcome XP for completing onboarding
      try {
        const { trackXP } = await import('@/lib/gamification');
        await trackXP('onboarding_completed', user.id);
      } catch (xpError) {
        console.log('XP tracking not available:', xpError);
      }

      // Log a server-confirmed completion event to user_events. The client also
      // fires onboarding_step with metadata.step='completed' via useOnboardingTracking
      // on the ONBOARDING_COMPLETION_SIGNAL transition, but that only runs if
      // handleFinish actually executes. The server-side insert is the authoritative
      // audit trail that the profile save + onboarding_completed_at commit actually
      // happened. Uses source: 'server' metadata to distinguish from the client
      // event in analytics queries if dedupe is needed.
      // See project_server_analytics_noop.md for why the old track() call was dead.
      try {
        await supabase.from('user_events').insert({
          user_id: user.id,
          event_type: 'onboarding_step',
          metadata: {
            step: 'completed',
            step_name: 'completed',
            source: 'server',
            has_home_beach: !!data.homeBeachId,
            experience_level: data.experienceLevel ?? null,
            preferred_time: data.preferredTime ?? null,
            surf_styles_count: data.surfStyles?.length || 0,
            push_enabled: data.pushEnabled || false,
            email_enabled: data.emailEnabled !== false,
          },
        });
      } catch (evtErr) {
        console.warn('Failed to log onboarding_completed event:', evtErr);
      }

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
