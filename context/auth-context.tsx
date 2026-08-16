"use client";

/**
 * iOS Safari OAuth investigation (2026-04-12):
 *
 * `onAuthStateChange` DOES handle `SIGNED_IN` (line ~276). Two mitigations
 * already exist for the iOS Safari cookie-race where `onAuthStateChange`
 * doesn't fire because cross-origin redirect cookies aren't immediately
 * visible to the JS client:
 *
 *   1. Init-time fallback (lines ~230-244): if `getSession()` returns null
 *      but `sb-*` auth cookies or `pending_signup_metadata` exist in storage,
 *      a second `getSession()` call is attempted.
 *
 *   2. Callback marker cookie (lines ~249-263): `app/auth/callback/route.ts`
 *      sets a short-lived `auth_callback_completed` cookie (maxAge 30s). On
 *      init, if that cookie exists and session is still null, another
 *      `getSession()` retry is performed.
 *
 * These mitigations address the known iOS Safari race but rely on the auth
 * cookies becoming readable within the retry window. If Safari defers
 * cookie writes further (e.g., under aggressive ITP), users could still
 * land on the app without a session. No additional fix applied here.
 */

import type React from "react";

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import * as Sentry from "@sentry/nextjs";
import {
  safeGetItem,
  safeSetItem,
  safeRemoveItem,
} from "@/lib/utils/safe-storage";
import { getExistingVisitorId, clearVisitorId } from "@/lib/utils/visitor-id";
import { AUTH_INIT_TIMEOUT_MS } from "@/lib/constants/ui";
import {
  captureClientPostHogEvent,
  queueClientPostHogSignup,
  resetPostHog,
} from "@/lib/posthog-client";
import {
  parseSignupMetadata,
  type WebSignupContext,
} from "@/lib/analytics/acquisition-context";
import {
  clearSignupFlow,
  getSignupFlow,
  trackLoginSuccess,
  trackSignupSuccess,
} from "@/lib/analytics/auth-events";

type PendingSignupCompletion = {
  context?: WebSignupContext;
  metadataPresent: boolean;
};

/**
 * Reconcile an OAuth signup after either bootstrap or a SIGNED_IN callback.
 * Supabase can resolve the callback session before registering the listener,
 * so this must not depend on a particular AuthChangeEvent value.
 */
function processPendingSignupCompletion(
  session: Session,
  supabase: ReturnType<typeof createClient>,
): PendingSignupCompletion {
  if (typeof window === "undefined") {
    return { metadataPresent: false };
  }

  const pendingMetadata = sessionStorage.getItem("pending_signup_metadata");
  if (!pendingMetadata) return { metadataPresent: false };

  try {
    if (pendingMetadata.length > 16_384) {
      throw new Error("Metadata payload exceeds size limit");
    }

    const raw = JSON.parse(pendingMetadata);
    const metadata = parseSignupMetadata(raw);
    const context = metadata.signup_context;
    const signupFlow = getSignupFlow();
    const createdAt = Date.parse(session.user.created_at);
    const isNewUser =
      Number.isFinite(createdAt) && Date.now() - createdAt < 60_000;

    if (signupFlow) {
      if (isNewUser) {
        trackSignupSuccess({
          method: context.method === "email" ? "password" : context.method,
          requires_verification: false,
          flow_id: signupFlow.flow_id,
          source: signupFlow.source,
          landing_page: signupFlow.landing_page,
          redirect_path: signupFlow.redirect_path,
          redirect_state: "completed",
          started_at: signupFlow.started_at,
        });
      } else {
        // Signup-mode OAuth can resolve to an existing account. Record the
        // actual authenticated outcome and close the signup flow cleanly.
        trackLoginSuccess({
          method: signupFlow.provider,
          duration_ms: 0,
          source: signupFlow.source,
          landing_page: signupFlow.landing_page,
          flow_id: signupFlow.flow_id,
          redirect_path: signupFlow.redirect_path,
          redirect_state: "completed",
          started_at: signupFlow.started_at,
        });
        clearSignupFlow(signupFlow.flow_id);
      }
    }

    if (isNewUser) {
      const metadataAppliedKey = `signup_metadata_applied_${session.user.id}`;
      if (!sessionStorage.getItem(metadataAppliedKey)) {
        sessionStorage.setItem(metadataAppliedKey, "true");
        supabase.auth
          .updateUser({ data: metadata })
          .then(({ error }: { error: unknown }) => {
            if (error && process.env.NODE_ENV === "development") {
              console.error(
                "[AuthContext] Failed to update user metadata:",
                error,
              );
            }
          });
      }
    }

    return { context, metadataPresent: true };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[AuthContext] Error parsing pending signup metadata:",
        error,
      );
    }
    return { metadataPresent: true };
  }
}

/**
 * Run post-auth side effects once per authenticated user/session. Storage
 * markers make this safe when bootstrap and SIGNED_IN both observe a session.
 */
function processAuthenticatedSession(
  session: Session,
  supabase: ReturnType<typeof createClient>,
): PendingSignupCompletion {
  const pendingSignupCompletion = processPendingSignupCompletion(
    session,
    supabase,
  );
  if (typeof window === "undefined") return pendingSignupCompletion;

  const storedPath = safeGetItem("auth_redirect_path");
  if (storedPath) safeRemoveItem("auth_redirect_path");
  safeSetItem("quiver_returning_user", "true");

  const userId = session.user.id;
  const isNewUser = session.user.created_at
    ? Date.now() - new Date(session.user.created_at).getTime() < 60_000
    : false;
  const welcomeEmailKey = `welcome_email_sent_${userId}`;
  if (isNewUser && !sessionStorage.getItem(welcomeEmailKey)) {
    sessionStorage.setItem(welcomeEmailKey, "true");
    fetch("/api/internal/send-welcome-email", { method: "POST" }).catch(
      (error) => {
        if (process.env.NODE_ENV === "development") {
          console.error("[AuthContext] Failed to trigger welcome email:", error);
        }
        Sentry.captureException(error, {
          tags: { context: "auth_welcome_email" },
          extra: { userId },
        });
      },
    );
    fetch("/api/admin/new-user-alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: session.user.app_metadata?.provider || "unknown",
        viewportWidth: window.innerWidth,
        entryPage: window.location.pathname, // eslint-disable-line no-restricted-properties -- analytics context only
      }),
      keepalive: true,
    }).catch(() => {});
  }

  const pendingMetadata = pendingSignupCompletion.metadataPresent
    ? sessionStorage.getItem("pending_signup_metadata")
    : null;
  const linkKey = `events_linked_${userId}`;
  const visitorId = getExistingVisitorId();
  if (visitorId && !sessionStorage.getItem(linkKey)) {
    sessionStorage.setItem(linkKey, "true");
    const linkRequest = fetch("/api/events/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: visitorId,
        ...(pendingSignupCompletion.context
          ? { signupContext: pendingSignupCompletion.context }
          : {}),
      }),
    });
    linkRequest
      .then((response) => {
        if (response.ok) {
          clearVisitorId();
        } else {
          sessionStorage.removeItem(linkKey);
        }
      })
      .catch((error) => {
        sessionStorage.removeItem(linkKey);
        if (process.env.NODE_ENV === "development") {
          console.error("[AuthContext] Failed to link anonymous events:", error);
        }
      });
  }
  if (pendingMetadata) sessionStorage.removeItem("pending_signup_metadata");

  if (process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && isNewUser) {
    const postHogKey = `posthog_signup_queued_${userId}`;
    if (!sessionStorage.getItem(postHogKey)) {
      sessionStorage.setItem(postHogKey, "true");
      const rawProvider = session.user.app_metadata?.provider;
      const provider = typeof rawProvider === "string" ? rawProvider : "email";
      queueClientPostHogSignup(userId, provider);
    }
  }

  return pendingSignupCompletion;
}

/**
 * AuthContext provides authentication state and methods throughout the application.
 *
 * Lifecycle:
 * 1. On mount (client-side only), initializes auth state from Supabase
 * 2. Sets up auth state change listener for real-time updates
 * 3. Manages session refresh and user account setup
 * 4. Cleans up subscriptions on unmount to prevent memory leaks
 *
 * Performance considerations:
 * - Uses refs to prevent race conditions during initialization
 * - Memoized to prevent unnecessary re-renders
 * - 8-second timeout stops loading spinner if initialization is slow
 */

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signUp: (
    email: string,
    password: string,
    fullName?: string,
    metadata?: Record<string, any>,
    returnTo?: string,
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Use refs to prevent race conditions
  const initializingRef = useRef(false);
  const setupCompleteRef = useRef(false);
  const supabase = useMemo(() => createClient(), []);

  // Centralized function to update auth state
  const setupUserAccount = useCallback(async (userId: string) => {
    if (setupCompleteRef.current) return;

    try {
      // Add any user setup logic here (create profile, etc.)
      setupCompleteRef.current = true;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("AuthContext: User setup failed:", error);
      }
      // Don't fail auth if setup fails
    }
  }, []);

  const updateAuthState = useCallback(
    (newSession: Session | null) => {
      setSession(newSession);
      setUser(newSession?.user || null);
      setIsAuthenticated(!!newSession);

      // Setup user account if needed
      if (newSession?.user && !setupCompleteRef.current) {
        setupUserAccount(newSession.user.id);
      }
    },
    [setupUserAccount],
  );

  // Simplified session refresh function
  const refreshSession = async (): Promise<void> => {
    if (initializingRef.current) {
      return;
    }

    initializingRef.current = true;
    setIsLoading(true);

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("AuthContext: Error getting session:", error);
        }
        // Don't clear auth state — the session in cookies may still be valid
        return;
      }

      updateAuthState(session);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("AuthContext: Exception during session refresh:", error);
      }
      // Don't clear auth state on transient errors — leave current state intact
    } finally {
      setIsLoading(false);
      initializingRef.current = false;
    }
  };

  // Initialize auth state on mount - client-side only
  useEffect(() => {
    let mounted = true;
    let subscription: any = null;
    let timeoutId: NodeJS.Timeout;

    const initializeAuth = async () => {
      if (initializingRef.current || !mounted) return;

      initializingRef.current = true;
      setIsLoading(true);

      // Timeout: stop loading spinner if initialization is slow.
      // Auth initialization continues in background; onAuthStateChange will update state.
      timeoutId = setTimeout(() => {
        if (mounted && initializingRef.current) {
          if (process.env.NODE_ENV === "development") {
            console.warn("AuthContext: Auth initialization timed out after 8s");
          }
          setIsLoading(false);
          initializingRef.current = false;
        }
      }, AUTH_INIT_TIMEOUT_MS);

      try {
        let {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        // Clear timeout since we got a response
        clearTimeout(timeoutId);

        if (error && process.env.NODE_ENV === "development") {
          console.error("AuthContext: Error during initialization:", error);
        }

        // Force session refresh after OAuth redirect
        // iOS Safari may not fire onAuthStateChange if cookies were set
        // during cross-origin redirect. Detect via cookie presence.
        if (!session && typeof window !== "undefined") {
          const hasAuthCookies = document.cookie.includes("sb-");
          const justRedirected = sessionStorage.getItem(
            "pending_signup_metadata",
          );

          if (hasAuthCookies || justRedirected) {
            const {
              data: { session: refreshedSession },
            } = await supabase.auth.getSession();
            if (refreshedSession) {
              session = refreshedSession;
            }
          }
        }

        // Check if we just completed an OAuth callback
        // The auth callback route sets a short-lived marker cookie so the client
        // knows to force-refresh auth state (handles iOS Safari cookie race)
        if (typeof window !== "undefined") {
          const hasCallbackMarker = document.cookie.includes(
            "auth_callback_completed",
          );
          if (hasCallbackMarker && !session) {
            document.cookie =
              "auth_callback_completed=; max-age=0; path=/";
            const {
              data: { session: freshSession },
            } = await supabase.auth.getSession();
            if (freshSession) {
              session = freshSession;
            }
          }
        }

        // Update auth state regardless of error - session might still be valid
        updateAuthState(session);
        if (session) {
          processAuthenticatedSession(session, supabase);
        }

        // Set up auth state listener for real-time updates
        const {
          data: { subscription: authSubscription },
        } = supabase.auth.onAuthStateChange(
          (event: AuthChangeEvent, session: Session | null) => {
            if (!mounted) return;

            // Handle post-auth redirect when user signs in
            if (event === "SIGNED_IN" && session) {
              processAuthenticatedSession(session, supabase);

              // Note: We don't navigate here. The auth state update (below) will cause
              // React components to re-render and show authenticated content.
              // For cross-page redirects (OAuth, magic link), see app/auth/callback/route.ts
            }

            updateAuthState(session);
          },
        );

        subscription = authSubscription;
      } catch (error) {
        if (mounted) {
          if (process.env.NODE_ENV === "development") {
            console.error(
              "AuthContext: Exception during initialization:",
              error,
            );
          }
          clearTimeout(timeoutId);
          // Don't clear auth state — leave current state intact
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
          initializingRef.current = false;
        }
      }
    };

    // Only initialize on client side
    if (typeof window !== "undefined") {
      initializeAuth();
    } else {
      // Server side - set defaults immediately
      setIsLoading(false);
    }

    // Listen for auth-expired events from fetchWithAuthRetry
    const handleAuthExpired = () => {
      updateAuthState(null);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("quiver:auth-expired", handleAuthExpired);
    }

    // Proactively refresh session when app becomes visible after being hidden
    // This ensures users stay logged in after closing/reopening the browser tab
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && !initializingRef.current) {
        try {
          // Use getSession which triggers automatic token refresh if needed
          const {
            data: { session: refreshedSession },
            error,
          } = await supabase.auth.getSession();

          if (error) {
            if (process.env.NODE_ENV === "development") {
              console.error(
                "AuthContext: Error refreshing session on visibility change:",
                error,
              );
            }
            return; // Don't update state on error - leave current state intact
          }

          if (mounted) {
            updateAuthState(refreshedSession);
          }
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error(
              "AuthContext: Exception refreshing session on visibility change:",
              error,
            );
          }
        }
      }
    };

    if (typeof window !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    // Cleanup function to prevent memory leaks
    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (subscription) {
        subscription.unsubscribe();
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("quiver:auth-expired", handleAuthExpired);
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      }
      initializingRef.current = false;
    };
  }, [supabase, updateAuthState]);

  const signUp = async (
    email: string,
    password: string,
    fullName?: string,
    metadata?: Record<string, any>,
    returnTo?: string,
  ): Promise<void> => {
    setIsLoading(true);
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
      // Embed the returnTo path in the confirmation link so Supabase redirects
      // the user back to their beach page (or wherever they signed up from)
      // after clicking the email link. Falls back to "/" if not provided.
      const safeReturnTo =
        returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
          ? returnTo
          : "/";
      const emailRedirectTo = siteUrl
        ? `${siteUrl.replace(/\/$/, "")}/auth/confirm?next=${encodeURIComponent(safeReturnTo)}`
        : undefined;

      // Store returnTo in a cookie as fallback for email confirmation redirect.
      // Supabase may strip custom query params from emailRedirectTo, and
      // localStorage doesn't survive cross-device email opens.
      if (safeReturnTo && safeReturnTo !== "/") {
        document.cookie = `auth_return_to=${encodeURIComponent(safeReturnTo)}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
      }

      // Merge fullName into metadata if provided
      const userData = {
        ...(fullName ? { full_name: fullName } : {}),
        ...(metadata || {}),
      };

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          ...(Object.keys(userData).length > 0 ? { data: userData } : {}),
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
        },
      });

      if (error) throw error;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("AuthContext: Sign up error:", error);
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);

    try {
      // Reset state
      setupCompleteRef.current = false;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // The onAuthStateChange listener will handle updating the state
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("AuthContext: Sign in error:", error);
      }
      // Don't clear existing session — a failed sign-in attempt shouldn't log out a user
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    setIsLoading(true);

    try {
      if (process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) {
        captureClientPostHogEvent("user_signed_out");
        resetPostHog();
      }

      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      // Reset setup state
      setupCompleteRef.current = false;

      // The onAuthStateChange listener will handle clearing the state
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("AuthContext: Sign out error:", error);
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    session,
    isLoading,
    isAuthenticated,
    signUp,
    signIn,
    signOut,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};

export const useOptionalAuth = () => {
  return useContext(AuthContext);
};
