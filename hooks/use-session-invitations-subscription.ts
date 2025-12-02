"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Shared hook for session invitation Realtime subscriptions
 * Prevents duplicate subscriptions when used in multiple components
 *
 * @param userId - Current user ID
 * @param userEmail - Current user email
 * @param onUpdate - Callback to execute when invitation changes occur
 */
export function useSessionInvitationsSubscription(
  userId: string | undefined,
  userEmail: string | undefined,
  onUpdate: () => void
) {
  const supabase = useMemo(() => createClient(), []);

  // Use ref to avoid re-subscriptions when callback changes
  const onUpdateRef = useRef(onUpdate);
  // Debounce timer ref to prevent rapid duplicate calls
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // Debounced update function to batch rapid subscription events
  const debouncedUpdate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onUpdateRef.current();
      debounceTimerRef.current = null;
    }, 500);
  }, []);

  useEffect(() => {
    if (!userId && !userEmail) {
      return;
    }

    const channels: RealtimeChannel[] = [];
    let isSubscribed = true;

    // Subscribe by user ID if available
    if (userId) {
      const userChannel = supabase
        .channel(`session_invitations_user_${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "session_invitations",
            filter: `invitee_id=eq.${userId}`,
          },
          () => {
            if (isSubscribed) {
              debouncedUpdate();
            }
          }
        )
        .subscribe();
      channels.push(userChannel);
    }

    // Subscribe by email if available
    const emailValue = userEmail?.toLowerCase();
    if (emailValue) {
      const encoded = encodeURIComponent(emailValue);
      const emailChannel = supabase
        .channel(`session_invitations_email_${encoded}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "session_invitations",
            filter: `invitee_email=eq.${emailValue}`,
          },
          () => {
            if (isSubscribed) {
              debouncedUpdate();
            }
          }
        )
        .subscribe();
      channels.push(emailChannel);
    }

    return () => {
      isSubscribed = false;
      // Clear any pending debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      // Small delay to prevent "WebSocket closed before connection established" error
      setTimeout(() => {
        channels.forEach((channel) => {
          supabase.removeChannel(channel).catch(() => {
            // Silently handle removal errors in dev mode
            if (process.env.NODE_ENV === "development") {
              console.debug("Channel cleanup completed");
            }
          });
        });
      }, 100);
    };
  }, [supabase, userId, userEmail, debouncedUpdate]);
}

