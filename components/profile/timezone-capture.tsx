"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { useProfileContext } from "@/context/profile-context";

const SESSION_KEY_PREFIX = "quiver_timezone_captured_";

export function TimezoneCapture() {
  const { user } = useAuth();
  const { profile, isLoading } = useProfileContext();

  useEffect(() => {
    if (!user?.id || isLoading || !profile || profile.timezone !== null) return;

    const sessionKey = `${SESSION_KEY_PREFIX}${user.id}`;
    try {
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, "true");
    } catch {
      return;
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timezone) return;

    void fetch("/api/user/timezone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone }),
    }).catch(() => {});
  }, [isLoading, profile, user?.id]);

  return null;
}
