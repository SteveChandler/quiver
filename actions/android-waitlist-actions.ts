"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withAuthenticatedAction } from "@/lib/server-action-utils";
import {
  ANDROID_WAITLIST_CTA,
  ANDROID_WAITLIST_DESTINATION_STATUS,
} from "@/lib/constants/android-waitlist";

const androidWaitlistIntentSchema = z.object({
  source: z.string().trim().min(1).max(120),
  surface: z.string().trim().min(1).max(80),
  placement: z.string().trim().min(1).max(80),
});

export async function joinAndroidWaitlist(input: unknown) {
  const parsed = androidWaitlistIntentSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid Android waitlist intent",
    };
  }

  return withAuthenticatedAction(async (user, supabase) => {
    const joinedAt = new Date().toISOString();
    const profileUpdate = {
      wants_android_access: true,
      android_waitlist_joined_at: joinedAt,
      android_waitlist_source: parsed.data.source,
      android_waitlist_surface: parsed.data.surface,
      android_waitlist_placement: parsed.data.placement,
      updated_at: joinedAt,
    };

    const { data: updatedProfile, error } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to join Android waitlist: ${error.message}`);
    }

    if (!updatedProfile) {
      throw new Error("No profile row was updated for Android waitlist");
    }

    const { error: eventError } = await supabase.from("user_events").insert({
      user_id: user.id,
      event_type: "profile_update",
      metadata: {
        field: "android_waitlist",
        fields_changed: [
          "wants_android_access",
          "android_waitlist_joined_at",
        ],
        cta_family: "android_waitlist",
        cta_text: ANDROID_WAITLIST_CTA,
        destination_status: ANDROID_WAITLIST_DESTINATION_STATUS,
        destination_type: "profile_flag",
        platform: "android",
        profile_flag_set: true,
        source: parsed.data.source,
        surface: parsed.data.surface,
        placement: parsed.data.placement,
      },
    });

    if (eventError) {
      console.warn(
        "joinAndroidWaitlist: failed to record profile_update event:",
        eventError,
      );
    }

    revalidatePath("/features");
    revalidatePath("/pbsc");
    revalidatePath("/plans");
    revalidatePath("/pricing");
    revalidatePath("/profile");

    return {
      wants_android_access: true,
      android_waitlist_joined_at: joinedAt,
    };
  });
}
