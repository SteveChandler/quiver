"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import {
  buildPostHogUserProperties,
  identifyPostHogUser,
  initPostHog,
  resetPostHog,
} from "@/lib/posthog-client";

export function PostHogProvider(): null {
  const { user } = useAuth();
  const identifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (user?.id) {
      identifyPostHogUser(user.id, buildPostHogUserProperties(user));
      identifiedUserId.current = user.id;
      return;
    }

    if (identifiedUserId.current) {
      resetPostHog();
      identifiedUserId.current = null;
    }
  }, [user]);

  return null;
}
