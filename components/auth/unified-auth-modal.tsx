"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "@/context/auth-context";
import { usePathname, useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import {
  initiateOAuthFlow,
  sendMagicLink,
  validateEmail,
  validateEmailDomain,
  validatePassword,
  getAuthRedirect,
  setAuthRedirect,
} from "@/lib/auth/auth-utils";
import {
  trackAuthModalOpened,
  trackAuthModalClosedWithoutAction,
  trackAuthMethodSelected,
  trackAuthProviderSelected,
  trackLoginStarted,
  trackLoginSuccess,
  trackLoginFailed,
  trackSignupStarted,
  trackSignupSuccess,
  trackSignupFailed,
  trackMagicLinkSent,
  trackSignupFormSubmitted,
  categorizeAuthError,
  extractEmailDomain,
} from "@/lib/analytics/auth-events";
import { useLocationSafe } from "@/context/location-context";
import { getAttributionFromCookies } from "@/lib/attribution";
import { signInWithApple } from "@/lib/auth/apple-sign-in";
import {
  AuthProviders,
  EmailPasswordForm,
  MagicLinkForm,
  VerifyEmailMessage,
  SuccessMessage,
} from "./auth-modal";

/**
 * Convert a raw pathname into a user-friendly label for the auth dialog.
 */
function friendlyPathName(path: string): string {
  const map: Record<string, string> = {
    "/map": "the map",
    "/discover": "discovery",
    "/sessions": "your sessions",
    "/profile": "your profile",
    "/inbox": "your inbox",
  };
  if (map[path]) return map[path];
  // Beach paths: /XX/city/beach or /ca/city/beach
  if (/^\/[a-z]{2}\/[^/]+\/[^/]+$/.test(path)) return "this spot";
  return "this page";
}

/**
 * Props for the UnifiedAuthModal component
 */
export interface UnifiedAuthModalProps {
  /** Control modal open state */
  isOpen: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Optional callback on successful authentication */
  onSuccess?: (user: User) => void;

  /** Modal mode: login, signup, or auto-detect */
  mode: "login" | "signup" | "auto";
  /** Initial view to show (defaults to 'providers') */
  initialView?: "providers" | "email-password" | "magic-link";

  /** Explicit return path after auth */
  returnTo?: string;
  /** Source identifier for analytics (e.g., 'landing-navbar', 'content-gate') */
  source?: string;

  /** UI customization */
  dismissible?: boolean;
  showCloseButton?: boolean;
  /** Contextual title/description override for the modal */
  contextMessage?: { title?: string; description?: string };

  /** Feature flags */
  enableMagicLink?: boolean;
  enablePassword?: boolean;
  enableOAuth?: boolean;
}

/**
 * Internal view states for the modal
 */
type AuthView =
  | "providers" // Choose auth method
  | "email-password" // Email + password form
  | "magic-link" // Email-only magic link form
  | "verify-email" // Post-signup verification message
  | "success"; // Success confirmation

/**
 * Unified authentication modal component
 * Handles login, signup, and auto-detection modes with multiple auth methods
 */
export function UnifiedAuthModal({
  isOpen,
  onClose,
  onSuccess,
  mode,
  initialView = "providers",
  returnTo,
  source = "unknown",
  dismissible = true,
  showCloseButton = true,
  contextMessage,
  enableMagicLink = true,
  enablePassword = true,
  enableOAuth = true,
}: UnifiedAuthModalProps) {
  const { signIn, signUp, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const initialMode: "login" | "signup" =
    mode === "signup" ? "signup" : "login";

  // View and form state
  const [view, setView] = useState<AuthView>(initialView);
  const [activeMode, setActiveMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [emailSuggestion, setEmailSuggestion] = useState<{
    suggestion: string;
    suggestedEmail: string;
  } | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  // Track whether the user completed an auth action so we can fire
  // auth_modal_closed_without_action only for dismissals that didn't lead to auth.
  const authActionTakenRef = useRef(false);

  // Location context for signup metadata
  const locationContext = useLocationSafe();

  /**
   * Build rich metadata payload for signup
   */
  const buildSignupMetadata = (method: "email" | "google") => {
    const now = new Date().toISOString();
    const termsVersion = "2026-01-25";
    const attribution = getAttributionFromCookies();
    const ipLocation = locationContext?.ipLocation;

    // Strip query params from referrer to avoid leaking sensitive URLs
    let referrer = "direct";
    if (typeof document !== "undefined" && document.referrer) {
      try {
        const url = new URL(document.referrer);
        referrer = url.origin + url.pathname;
      } catch {
        referrer = "unknown";
      }
    }

    // Detect device type using modern API with UA fallback
    let deviceKind: "mobile" | "desktop" = "desktop";
    if (typeof navigator !== "undefined") {
      if ("userAgentData" in navigator && (navigator as any).userAgentData?.mobile) {
        deviceKind = "mobile";
      } else if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        deviceKind = "mobile";
      }
    }

    return {
      signup_context: {
        method,
        entrypoint: source,
        landing_path:
          // eslint-disable-next-line no-restricted-properties -- Reading pathname for analytics context, not navigation
          typeof window !== "undefined" ? window.location.pathname : "/",
        referrer,
        utm: {
          source: attribution.utm_source,
          medium: attribution.utm_medium,
          campaign: attribution.utm_campaign,
          content: attribution.utm_content,
          term: attribution.utm_term,
        },
        tz:
          typeof Intl !== "undefined"
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : null,
        locale: typeof navigator !== "undefined" ? navigator.language : null,
        device: {
          kind: deviceKind,
        },
        captured_at: new Date().toISOString(),
      },
      location_data: ipLocation
        ? {
            source: "ip",
            city: ipLocation.city,
            region: ipLocation.region,
            country: ipLocation.country,
            latitude: ipLocation.latitude,
            longitude: ipLocation.longitude,
          }
        : null,
      legal_consent: {
        terms_accepted_at: now,
        terms_version: termsVersion,
        privacy_accepted_at: now,
      },
    };
  };

  // Track modal open event — only for anonymous users (pre-auth funnel)
  useEffect(() => {
    if (isOpen && !user) {
      trackAuthModalOpened({ mode, source });
    }
  }, [isOpen, mode, source, user]);

  // Store returnTo in localStorage when provided
  useEffect(() => {
    if (returnTo) {
      setAuthRedirect(returnTo);
    }
  }, [returnTo]);

  // Focus email input when view changes to forms
  useEffect(() => {
    if (
      (view === "email-password" || view === "magic-link") &&
      emailInputRef.current
    ) {
      emailInputRef.current.focus();
    }
  }, [view]);

  // Check for typo domain suggestions when email changes (debounced to avoid
  // flashing suggestions while the user is mid-typing, e.g. "gmail.co" → "gmail.com")
  useEffect(() => {
    if (!email || !validateEmail(email)) {
      setEmailSuggestion(null);
      return;
    }
    const timer = setTimeout(() => {
      const domainCheck = validateEmailDomain(email);
      if (domainCheck.suggestion && domainCheck.suggestedEmail) {
        setEmailSuggestion({
          suggestion: domainCheck.suggestion,
          suggestedEmail: domainCheck.suggestedEmail,
        });
      } else {
        setEmailSuggestion(null);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [email]);

  // Get return path
  const getReturnPath = (): string => {
    if (returnTo) return returnTo;
    const stored = getAuthRedirect();
    if (stored) return stored;
    return "/";
  };

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      authActionTakenRef.current = false;
    } else {
      setView(initialView);
      setActiveMode(initialMode);
      setEmail("");
      setPassword("");
      setDisplayName("");
      setEmailSuggestion(null);
      setError(null);
      setLoading(false);
    }
  }, [isOpen, initialView, initialMode]);

  /**
   * Handle Apple Sign-In
   */
  const handleAppleSignIn = async () => {
    const start = Date.now();
    setLoading(true);
    setError(null);

    authActionTakenRef.current = true;
    trackAuthMethodSelected({ method: "apple", mode: activeMode });
    trackAuthProviderSelected({ provider: "apple", mode: activeMode, source });
    if (activeMode === "signup") {
      trackSignupStarted("apple", {
        source,
        // eslint-disable-next-line no-restricted-properties -- Reading pathname for analytics context, not navigation
        landing_page: typeof window !== "undefined" ? window.location.pathname : undefined,
      });
    } else {
      trackLoginStarted("apple");
    }

    const result = await signInWithApple(getReturnPath());

    if (result.error) {
      setError(result.error);
      trackLoginFailed({ method: "apple", error_type: "oauth_failed" });
      setLoading(false);
      return;
    }

    // Native: signInWithIdToken() completed inline — session is already established.
    // Web: signInWithOAuth() triggered a redirect; this code runs briefly before
    // the browser navigates away, so setLoading(false) + onClose() are harmless.
    const duration = Date.now() - start;
    if (activeMode === "signup") {
      trackSignupSuccess({
        method: "apple",
        requires_verification: false,
        source,
        // eslint-disable-next-line no-restricted-properties -- Reading pathname for analytics context, not navigation
        landing_page: typeof window !== "undefined" ? window.location.pathname : undefined,
      });
    } else {
      trackLoginSuccess({ method: "apple", duration_ms: duration });
    }
    setLoading(false);
    onClose();
  };

  /**
   * Handle Google OAuth sign-in
   */
  const handleGoogleOAuth = async () => {
    const start = Date.now();
    setLoading(true);
    setError(null);

    authActionTakenRef.current = true;
    trackAuthMethodSelected({ method: "google", mode: activeMode });
    trackAuthProviderSelected({ provider: "google", mode: activeMode, source });
    if (activeMode === "signup") {
      trackSignupStarted("google", {
        source,
        // eslint-disable-next-line no-restricted-properties -- Reading pathname for analytics context, not navigation
        landing_page: typeof window !== "undefined" ? window.location.pathname : undefined,
      });
    } else {
      trackLoginStarted("google");
    }

    // Build metadata only for signup
    const metadata =
      activeMode === "signup" ? buildSignupMetadata("google") : undefined;

    const result = await initiateOAuthFlow("google", getReturnPath(), metadata);

    if (result.error) {
      setError(result.error);
      trackLoginFailed({ method: "google", error_type: "oauth_failed" });
      setLoading(false);
      return;
    }

    // Native: signInWithIdToken() completed inline — session is already established.
    // Web: signInWithOAuth() triggered a redirect; this code runs briefly before
    // the browser navigates away, so setLoading(false) + onClose() are harmless.
    const duration = Date.now() - start;
    if (activeMode === "signup") {
      // Google OAuth verifies email server-side, so no client-side verification step is needed.
      trackSignupSuccess({
        method: "google",
        requires_verification: false,
        source,
        // eslint-disable-next-line no-restricted-properties -- Reading pathname for analytics context, not navigation
        landing_page: typeof window !== "undefined" ? window.location.pathname : undefined,
      });
    } else {
      trackLoginSuccess({ method: "google", duration_ms: duration });
    }
    setLoading(false);
    onClose();
  };

  /**
   * Handle magic link authentication
   */
  const handleMagicLink = async () => {
    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError(null);

    authActionTakenRef.current = true;
    trackAuthMethodSelected({ method: "magic_link", mode: "login" });
    trackAuthProviderSelected({ provider: "email", mode: "login", source, email_method: "magic_link" });
    trackLoginStarted("magic_link");

    const result = await sendMagicLink(email, getReturnPath());

    if (result.error) {
      setError(result.error);
      trackLoginFailed({ method: "magic_link", error_type: "send_failed" });
      setLoading(false);
    } else {
      trackMagicLinkSent(extractEmailDomain(email));
      setView("verify-email");
      setLoading(false);
    }
  };

  /**
   * Handle email/password authentication
   */
  const handleEmailPassword = async () => {
    setError(null);

    // Validate inputs
    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.error || "Invalid password");
      return;
    }

    // For signup mode, require display name
    if (activeMode === "signup" && !displayName.trim()) {
      setError("Please enter your name");
      return;
    }

    setLoading(true);
    authActionTakenRef.current = true;
    trackAuthMethodSelected({ method: "password", mode: activeMode });
    trackAuthProviderSelected({ provider: "email", mode: activeMode, source, email_method: "password" });
    if (!user) {
      trackSignupFormSubmitted({ mode: activeMode, source });
    }
    const start = Date.now();

    try {
      if (activeMode === "signup") {
        // Signup flow
        trackSignupStarted("password", {
          source,
          // eslint-disable-next-line no-restricted-properties -- Reading pathname for analytics context, not navigation
          landing_page: typeof window !== "undefined" ? window.location.pathname : undefined,
        });

        // Build metadata for signup
        const metadata = buildSignupMetadata("email");

        await signUp(email, password, displayName.trim(), metadata, getReturnPath());

        trackSignupSuccess({
          method: "password",
          requires_verification: true,
          source,
          // eslint-disable-next-line no-restricted-properties -- Reading pathname for analytics context, not navigation
          landing_page: typeof window !== "undefined" ? window.location.pathname : undefined,
        });

        setLoading(false);

        // Email/password signup requires email confirmation.
        // Encode the current page path so the confirm route can return the user
        // to the beach page (or wherever they signed up from) after verification.
        const confirmReturnTo = getReturnPath();
        const confirmQuery = new URLSearchParams({ signup: "confirm-email" });
        if (confirmReturnTo && confirmReturnTo !== "/") {
          confirmQuery.set("returnTo", confirmReturnTo);
        }
        router.replace(`/?${confirmQuery.toString()}`);

        // Close modal when it's an overlay (e.g. landing page).
        // If we're on the dedicated /auth/sign-up page, onClose() navigates to "/"
        // and would strip the query param before the landing toast can read it.
        if (pathname !== "/auth/sign-up") {
          onClose();
        }
      } else {
        // Login flow
        trackLoginStarted("password");
        await signIn(email, password);

        const duration = Date.now() - start;
        trackLoginSuccess({ method: "password", duration_ms: duration });

        setLoading(false);

        // Close modal - AuthContext will handle redirect if needed
        onClose();
      }
    } catch (err: unknown) {
      const errorType = categorizeAuthError(err);
      const errorMessage =
        err instanceof Error ? err.message : "Authentication failed";

      if (activeMode === "signup") {
        trackSignupFailed({ method: "password", error_type: errorType });
      } else {
        trackLoginFailed({ method: "password", error_type: errorType });
      }

      setError(errorMessage);
      setLoading(false);
    }
  };

  /**
   * Handle modal close — fires auth_modal_closed_without_action when the user
   * dismisses without completing an auth flow.
   */
  const handleClose = () => {
    if (!authActionTakenRef.current && view !== "verify-email" && view !== "success") {
      trackAuthModalClosedWithoutAction({ mode, source });
    }
    onClose();
  };

  /**
   * Handle view back navigation
   */
  const handleBack = () => {
    setView("providers");
    setError(null);
  };

  /**
   * Handle mode switching (login <-> signup)
   */
  const switchToSignup = () => {
    setActiveMode("signup");
    setView("providers");
    setError(null);
  };

  const switchToLogin = () => {
    setActiveMode("login");
    setView("providers");
    setError(null);
  };

  /**
   * Render the appropriate view content
   */
  const renderContent = () => {
    switch (view) {
      case "providers":
        return (
          <AuthProviders
            mode={activeMode}
            enableOAuth={enableOAuth}
            enablePassword={enablePassword}
            enableMagicLink={enableMagicLink}
            loading={loading}
            onAppleClick={process.env.NEXT_PUBLIC_APPLE_CLIENT_ID ? handleAppleSignIn : undefined}
            onGoogleClick={handleGoogleOAuth}
            onEmailPasswordClick={() => setView("email-password")}
            onMagicLinkClick={() => setView("magic-link")}
          />
        );

      case "email-password":
        return (
          <EmailPasswordForm
            mode={activeMode}
            email={email}
            password={password}
            displayName={displayName}
            loading={loading}
            emailInputRef={emailInputRef}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onDisplayNameChange={setDisplayName}
            onSubmit={handleEmailPassword}
            onBack={handleBack}
            emailSuggestion={emailSuggestion}
            onAcceptSuggestion={(correctedEmail: string) => {
              setEmail(correctedEmail);
              setEmailSuggestion(null);
            }}
          />
        );

      case "magic-link":
        return (
          <MagicLinkForm
            email={email}
            loading={loading}
            emailInputRef={emailInputRef}
            onEmailChange={setEmail}
            onSubmit={handleMagicLink}
            onBack={handleBack}
            emailSuggestion={emailSuggestion}
            onAcceptSuggestion={(correctedEmail: string) => {
              setEmail(correctedEmail);
              setEmailSuggestion(null);
            }}
          />
        );

      case "verify-email":
        return <VerifyEmailMessage email={email} />;

      case "success":
        return <SuccessMessage />;

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={dismissible ? handleClose : undefined}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => !dismissible && e.preventDefault()}
        onEscapeKeyDown={(e) => !dismissible && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {contextMessage?.title
              ? contextMessage.title
              : activeMode === "login"
                ? "Log in to Quiver"
                : "Sign Up"}
          </DialogTitle>
          <DialogDescription>
            {contextMessage?.description
              ? contextMessage.description
              : activeMode === "login"
                ? "Access your sessions, forecasts, and community."
                : "Join Quiver to plan sessions and connect with surfers."}
          </DialogDescription>
        </DialogHeader>

        {returnTo && returnTo !== "/" && (
          <p className="text-xs text-muted-foreground">
            Return to <span className="font-medium">{friendlyPathName(returnTo)}</span> after you
            sign in.
          </p>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {renderContent()}

        {view === "providers" && mode !== "auto" && (
          <DialogFooter className="sm:justify-center">
            {activeMode === "login" ? (
              <p className="text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={switchToSignup}
                  className="text-primary hover:underline"
                >
                  Sign up
                </button>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={switchToLogin}
                  className="text-primary hover:underline"
                >
                  Log in
                </button>
              </p>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
