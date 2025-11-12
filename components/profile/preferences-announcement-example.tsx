/**
 * Example Integration for PreferencesAnnouncementDialog
 *
 * This file demonstrates how to integrate the preferences announcement dialog
 * into the profile view. This is an EXAMPLE ONLY - not production code.
 *
 * Choose one of the integration strategies below based on your needs:
 * 1. localStorage - Simple, client-side only
 * 2. Database - Server-side tracking, persistent across devices
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { PreferencesAnnouncementDialog } from './preferences-announcement-dialog';

// =============================================================================
// STRATEGY 1: localStorage (Simple, Client-Side Only)
// =============================================================================

const ANNOUNCEMENT_KEY = 'quiver_preferences_announcement_shown';

export function ProfileWithAnnouncementLocalStorage() {
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    // Only show to authenticated users
    if (!user) return;

    // Check if announcement has been shown before
    const hasSeenAnnouncement = localStorage.getItem(ANNOUNCEMENT_KEY);

    if (!hasSeenAnnouncement) {
      // Show announcement after a short delay for better UX
      const timer = setTimeout(() => {
        setShowAnnouncement(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleClose = () => {
    setShowAnnouncement(false);
    // Mark as shown in localStorage
    localStorage.setItem(ANNOUNCEMENT_KEY, 'true');
  };

  const handleUpdateProfile = () => {
    handleClose();
    router.push('/profile/preferences');
  };

  return (
    <>
      {/* Your existing profile content goes here */}
      <div className="p-6">
        <h1 className="text-2xl font-bold">My Profile</h1>
        {/* ... rest of profile content ... */}
      </div>

      {/* Preferences announcement dialog */}
      <PreferencesAnnouncementDialog
        open={showAnnouncement}
        onClose={handleClose}
        onUpdateProfile={handleUpdateProfile}
      />
    </>
  );
}

// =============================================================================
// STRATEGY 2: Database (Server-Side Tracking, Persistent)
// =============================================================================

/**
 * This strategy requires:
 * 1. Database column: `profiles.has_seen_preferences_announcement` (boolean)
 * 2. API endpoint: GET/POST `/api/user/preferences-announcement-status`
 *
 * Database Migration (example):
 * ```sql
 * ALTER TABLE profiles
 * ADD COLUMN has_seen_preferences_announcement BOOLEAN DEFAULT FALSE;
 * ```
 */

export function ProfileWithAnnouncementDatabase() {
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    // Check announcement status from server
    const checkAnnouncementStatus = async () => {
      try {
        const response = await fetch('/api/user/preferences-announcement-status');
        const data = await response.json();

        if (!data.hasSeenAnnouncement) {
          // Show announcement after a short delay
          setTimeout(() => {
            setShowAnnouncement(true);
          }, 1000);
        }
      } catch (error) {
        console.error('Failed to check announcement status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAnnouncementStatus();
  }, [user]);

  const handleClose = async () => {
    setShowAnnouncement(false);

    // Mark as seen in database
    try {
      await fetch('/api/user/preferences-announcement-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seen: true }),
      });
    } catch (error) {
      console.error('Failed to update announcement status:', error);
    }
  };

  const handleUpdateProfile = () => {
    handleClose();
    router.push('/profile/preferences');
  };

  return (
    <>
      {/* Your existing profile content goes here */}
      <div className="p-6">
        <h1 className="text-2xl font-bold">My Profile</h1>
        {/* ... rest of profile content ... */}
      </div>

      {/* Preferences announcement dialog */}
      {!isLoading && (
        <PreferencesAnnouncementDialog
          open={showAnnouncement}
          onClose={handleClose}
          onUpdateProfile={handleUpdateProfile}
        />
      )}
    </>
  );
}

// =============================================================================
// STRATEGY 3: Conditional (Only for Users Without Preferences)
// =============================================================================

/**
 * Show announcement only if user hasn't set any preferences yet.
 * This is useful if you want to target users who need to complete their profile.
 */

interface Profile {
  experience_level?: string | null;
  surf_styles?: string[] | null;
  preferred_wave_size?: string | null;
  preferred_break_type?: string | null;
  crowd_preference?: string | null;
}

export function ProfileWithAnnouncementConditional({
  profile,
}: {
  profile: Profile;
}) {
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if user has any preferences set
    const hasPreferences =
      profile.experience_level ||
      (profile.surf_styles && profile.surf_styles.length > 0) ||
      profile.preferred_wave_size ||
      profile.preferred_break_type ||
      profile.crowd_preference;

    // Only show announcement if no preferences are set
    if (!hasPreferences) {
      const hasSeenAnnouncement = localStorage.getItem(ANNOUNCEMENT_KEY);

      if (!hasSeenAnnouncement) {
        setTimeout(() => {
          setShowAnnouncement(true);
        }, 1000);
      }
    }
  }, [profile]);

  const handleClose = () => {
    setShowAnnouncement(false);
    localStorage.setItem(ANNOUNCEMENT_KEY, 'true');
  };

  const handleUpdateProfile = () => {
    handleClose();
    router.push('/profile/preferences');
  };

  return (
    <>
      {/* Your existing profile content goes here */}
      <div className="p-6">
        <h1 className="text-2xl font-bold">My Profile</h1>
        {/* ... rest of profile content ... */}
      </div>

      {/* Preferences announcement dialog */}
      <PreferencesAnnouncementDialog
        open={showAnnouncement}
        onClose={handleClose}
        onUpdateProfile={handleUpdateProfile}
      />
    </>
  );
}

// =============================================================================
// STRATEGY 4: Manual Trigger (Button to Show Dialog)
// =============================================================================

/**
 * Allow users to manually trigger the announcement dialog.
 * Useful for help sections or onboarding tours.
 */

export function ProfileWithManualTrigger() {
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const router = useRouter();

  const handleUpdateProfile = () => {
    setShowAnnouncement(false);
    router.push('/profile/preferences');
  };

  return (
    <>
      {/* Your existing profile content goes here */}
      <div className="p-6">
        <h1 className="text-2xl font-bold">My Profile</h1>

        {/* Manual trigger button */}
        <button
          onClick={() => setShowAnnouncement(true)}
          className="mt-4 text-blue-600 hover:text-blue-800 underline"
        >
          Learn about new profile preferences
        </button>

        {/* ... rest of profile content ... */}
      </div>

      {/* Preferences announcement dialog */}
      <PreferencesAnnouncementDialog
        open={showAnnouncement}
        onClose={() => setShowAnnouncement(false)}
        onUpdateProfile={handleUpdateProfile}
      />
    </>
  );
}
