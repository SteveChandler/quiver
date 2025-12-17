/**
 * Example Usage of PreferencesDisplayCard Component
 *
 * This file demonstrates how to integrate the PreferencesDisplayCard
 * into a profile page or settings page.
 */

"use client";

import { useRouter } from "next/navigation";
import { PreferencesDisplayCard } from "./preferences-display-card";
import type { Profile } from "@/types/database";

// Example 1: Basic usage without edit functionality
export function BasicExample({ profile }: { profile: Profile }) {
  return (
    <div className="max-w-2xl mx-auto p-4">
      <PreferencesDisplayCard profile={profile} />
    </div>
  );
}

// Example 2: With edit functionality
export function WithEditExample({ profile }: { profile: Profile }) {
  const router = useRouter();

  const handleEdit = () => {
    router.push("/profile/preferences");
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <PreferencesDisplayCard profile={profile} onEdit={handleEdit} />
    </div>
  );
}

// Example 3: In a profile page with multiple sections
export function ProfilePageExample({ profile }: { profile: Profile }) {
  const router = useRouter();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Other profile sections */}
      <div className="text-2xl font-bold">My Profile</div>

      {/* Preferences Section */}
      <PreferencesDisplayCard
        profile={profile}
        onEdit={() => router.push("/profile/preferences")}
      />

      {/* Other profile sections */}
    </div>
  );
}

// Example 4: Mock profile data for testing
export const mockProfile: Profile = {
  id: "user-123",
  full_name: "Test Surfer",
  avatar_url: null,
  bio: null,
  home_beach_id: null,
  experience_level: "intermediate",
  surf_styles: ["shortboard", "longboard"],
  preferred_wave_size: "medium",
  preferred_break_type: "beach",
  crowd_preference: "moderate",
  notif_reminders: false,
  digest_session_invites: false,
  inapp_session_invites: true,
  email_session_invites: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as unknown as Profile;

// Example 5: Empty profile (no preferences set)
export const emptyProfile: Profile = {
  id: "user-456",
  full_name: "New Surfer",
  avatar_url: null,
  bio: null,
  home_beach_id: null,
  experience_level: null,
  surf_styles: null,
  preferred_wave_size: null,
  preferred_break_type: null,
  crowd_preference: null,
  notif_reminders: false,
  digest_session_invites: false,
  inapp_session_invites: true,
  email_session_invites: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as unknown as Profile;

// Example usage in a page component
export default function ExamplePage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Preferences Display Examples</h1>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-4">With Preferences</h2>
          <WithEditExample profile={mockProfile} />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Empty State</h2>
          <WithEditExample profile={emptyProfile} />
        </section>
      </div>
    </div>
  );
}
