"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "@/context/auth-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, LogIn, Mail, AlertCircle } from "lucide-react";
import {
  initiateOAuthFlow,
  sendMagicLink,
  validateEmail,
  validatePassword,
  getAuthRedirect,
  setAuthRedirect,
  clearAuthRedirect,
} from "@/lib/auth/auth-utils";
import {
  trackAuthModalOpened,
  trackAuthMethodSelected,
  trackLoginStarted,
  trackLoginSuccess,
  trackLoginFailed,
  trackSignupStarted,
  trackSignupSuccess,
  trackSignupFailed,
  trackMagicLinkSent,
  categorizeAuthError,
  extractEmailDomain,
} from "@/lib/analytics/auth-events";

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
  /** Source identifier for analytics (e.g., 'landing-navbar', 'auth-gate') */
  source?: string;

  /** UI customization */
  dismissible?: boolean;
  showCloseButton?: boolean;

  /** Auth gate context - shows guest-specific messaging */
  isAuthGate?: boolean;

  /** Feature flags */
  enableMagicLink?: boolean;
  enablePassword?: boolean;
  enableOAuth?: boolean;
}

/**
 * Internal view states for the modal
 */
type AuthView =
  | "providers"        // Choose auth method
  | "email-password"   // Email + password form
  | "magic-link"       // Email-only magic link form
  | "verify-email"     // Post-signup verification message
  | "success";         // Success confirmation

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
  isAuthGate = false,
  enableMagicLink = true,
  enablePassword = true,
  enableOAuth = true,
}: UnifiedAuthModalProps) {
  const { signIn, signUp } = useAuth();

  // View and form state
  const [view, setView] = useState<AuthView>(initialView);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number>(0);

  // Refs
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  // Track modal open event
  useEffect(() => {
    if (isOpen) {
      trackAuthModalOpened({ mode, source });
    }
  }, [isOpen, mode, source]);

  // Store returnTo in localStorage when provided
  useEffect(() => {
    if (returnTo) {
      setAuthRedirect(returnTo);
    }
  }, [returnTo]);

  // Focus email input when view changes to forms
  useEffect(() => {
    if ((view === "email-password" || view === "magic-link") && emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, [view]);

  // Get return path
  const getReturnPath = (): string => {
    if (returnTo) return returnTo;
    const stored = getAuthRedirect();
    if (stored) return stored;
    return "/";
  };

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setView(initialView);
      setEmail("");
      setPassword("");
      setDisplayName("");
      setError(null);
      setLoading(false);
    }
  }, [isOpen, initialView]);

  /**
   * Handle Google OAuth sign-in
   */
  const handleGoogleOAuth = async () => {
    setLoading(true);
    setError(null);

    const currentMode = mode === "auto" ? "login" : mode;
    trackAuthMethodSelected({ method: "google", mode: currentMode });
    trackLoginStarted("google");
    setStartTime(Date.now());

    const result = await initiateOAuthFlow("google", getReturnPath());

    if (result.error) {
      setError(result.error);
      trackLoginFailed({ method: "google", error_type: "oauth_failed" });
      setLoading(false);
    }
    // If successful, browser will redirect - no need to setLoading(false)
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

    trackAuthMethodSelected({ method: "magic_link", mode: "login" });
    trackLoginStarted("magic_link");
    setStartTime(Date.now());

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
    if (mode === "signup" && !displayName.trim()) {
      setError("Please enter your name");
      return;
    }

    setLoading(true);
    const currentMode = mode === "auto" ? "login" : mode;
    trackAuthMethodSelected({ method: "password", mode: currentMode });
    setStartTime(Date.now());

    try {
      if (mode === "signup") {
        // Signup flow
        trackSignupStarted("password");
        await signUp(email, password, displayName.trim());

        const duration = Date.now() - startTime;
        trackSignupSuccess({ method: "password", requires_verification: true });

        // Show verification message
        setView("verify-email");
        setLoading(false);
      } else {
        // Login flow
        trackLoginStarted("password");
        await signIn(email, password);

        const duration = Date.now() - startTime;
        trackLoginSuccess({ method: "password", duration_ms: duration });

        setLoading(false);

        // Close modal - AuthContext will handle redirect if needed
        onClose();
      }
    } catch (err: any) {
      const errorType = categorizeAuthError(err);
      const errorMessage = err?.message || "Authentication failed";

      if (mode === "signup") {
        trackSignupFailed({ method: "password", error_type: errorType });
      } else {
        trackLoginFailed({ method: "password", error_type: errorType });
      }

      setError(errorMessage);
      setLoading(false);
    }
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
    setView("providers");
    setError(null);
  };

  const switchToLogin = () => {
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
            mode={mode}
            enableOAuth={enableOAuth}
            enablePassword={enablePassword}
            enableMagicLink={enableMagicLink}
            loading={loading}
            onGoogleClick={handleGoogleOAuth}
            onEmailPasswordClick={() => setView("email-password")}
            onMagicLinkClick={() => setView("magic-link")}
          />
        );

      case "email-password":
        return (
          <EmailPasswordForm
            mode={mode}
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
    <Dialog open={isOpen} onOpenChange={dismissible ? onClose : undefined}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => !dismissible && e.preventDefault()}
        onEscapeKeyDown={(e) => !dismissible && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {isAuthGate
              ? "Keep Exploring with Quiver"
              : mode === "login"
              ? "Log in to Quiver"
              : "Sign Up"}
          </DialogTitle>
          <DialogDescription>
            {isAuthGate
              ? "Log in or sign up to access interactive maps, save sessions, and connect with the community."
              : mode === "login"
              ? "Access your sessions, forecasts, and community."
              : "Join Quiver to plan sessions and connect with surfers."}
          </DialogDescription>
        </DialogHeader>

        {returnTo && returnTo !== "/" && (
          <p className="text-xs text-muted-foreground">
            Return to <span className="font-medium">{returnTo}</span> after you sign in.
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
            {mode === "login" ? (
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <button
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

/**
 * Provider selection view
 */
interface AuthProvidersProps {
  mode: "login" | "signup" | "auto";
  enableOAuth: boolean;
  enablePassword: boolean;
  enableMagicLink: boolean;
  loading: boolean;
  onGoogleClick: () => void;
  onEmailPasswordClick: () => void;
  onMagicLinkClick: () => void;
}

function AuthProviders({
  mode,
  enableOAuth,
  enablePassword,
  enableMagicLink,
  loading,
  onGoogleClick,
  onEmailPasswordClick,
  onMagicLinkClick,
}: AuthProvidersProps) {
  return (
    <div className="grid gap-3 pt-2">
      {enableOAuth && (
        <Button
          onClick={onGoogleClick}
          className="w-full"
          size="lg"
          variant="default"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="mr-2 h-4 w-4" />
          )}
          Continue with Google
        </Button>
      )}

      {(enablePassword || enableMagicLink) && enableOAuth && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>
      )}

      {enablePassword && (
        <Button
          onClick={onEmailPasswordClick}
          className="w-full"
          size="lg"
          variant="outline"
          disabled={loading}
        >
          <Mail className="mr-2 h-4 w-4" />
          Continue with Email
        </Button>
      )}

      {enableMagicLink && mode === "login" && (
        <Button
          onClick={onMagicLinkClick}
          className="w-full"
          size="lg"
          variant="outline"
          disabled={loading}
        >
          <Mail className="mr-2 h-4 w-4" />
          Continue with Email Link
        </Button>
      )}
    </div>
  );
}

/**
 * Email + password form view
 */
interface EmailPasswordFormProps {
  mode: "login" | "signup" | "auto";
  email: string;
  password: string;
  displayName: string;
  loading: boolean;
  emailInputRef: React.RefObject<HTMLInputElement>;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  onDisplayNameChange: (name: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}

function EmailPasswordForm({
  mode,
  email,
  password,
  displayName,
  loading,
  emailInputRef,
  onEmailChange,
  onPasswordChange,
  onDisplayNameChange,
  onSubmit,
  onBack,
}: EmailPasswordFormProps) {
  return (
    <div className="space-y-4 pt-2">
      {mode === "signup" && (
        <div className="space-y-2">
          <Label htmlFor="displayName">Your Name</Label>
          <Input
            id="displayName"
            type="text"
            placeholder="John Doe"
            value={displayName}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            autoComplete="name"
            disabled={loading}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="your.email@example.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          autoComplete="email"
          ref={emailInputRef}
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          disabled={loading}
        />
      </div>

      <Button
        onClick={onSubmit}
        className="w-full"
        size="lg"
        disabled={loading}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {mode === "signup" ? "Sign up" : "Log in"}
      </Button>

      <Button
        onClick={onBack}
        variant="ghost"
        className="w-full"
        disabled={loading}
      >
        Back to options
      </Button>
    </div>
  );
}

/**
 * Magic link form view
 */
interface MagicLinkFormProps {
  email: string;
  loading: boolean;
  emailInputRef: React.RefObject<HTMLInputElement>;
  onEmailChange: (email: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}

function MagicLinkForm({
  email,
  loading,
  emailInputRef,
  onEmailChange,
  onSubmit,
  onBack,
}: MagicLinkFormProps) {
  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input
          id="email"
          type="email"
          placeholder="your.email@example.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          ref={emailInputRef}
          disabled={loading}
        />
      </div>

      <Button
        onClick={onSubmit}
        className="w-full"
        size="lg"
        disabled={!validateEmail(email) || loading}
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Mail className="mr-2 h-4 w-4" />
        )}
        Send Magic Link
      </Button>

      <Button
        onClick={onBack}
        variant="ghost"
        className="w-full"
        disabled={loading}
      >
        Back to options
      </Button>
    </div>
  );
}

/**
 * Email verification message
 */
function VerifyEmailMessage({ email }: { email: string }) {
  return (
    <div className="py-4 text-center space-y-3">
      <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
        <Mail className="h-6 w-6 text-green-600" />
      </div>
      <div>
        <h3 className="font-semibold">Check your email</h3>
        <p className="text-sm text-muted-foreground mt-1">
          We sent a confirmation link to{" "}
          <span className="font-medium">{email}</span>
        </p>
      </div>
    </div>
  );
}

/**
 * Success confirmation message
 */
function SuccessMessage() {
  return (
    <div className="py-4 text-center space-y-3">
      <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
        <LogIn className="h-6 w-6 text-green-600" />
      </div>
      <div>
        <h3 className="font-semibold">Success!</h3>
        <p className="text-sm text-muted-foreground mt-1">
          You're now signed in.
        </p>
      </div>
    </div>
  );
}
