"use client";

import { Button } from "@/components/ui/button";
import { Loader2, LogIn, Mail } from "lucide-react";

/**
 * Provider selection view
 *
 * Uses passive consent for Terms of Service in signup mode — the buttons are
 * always enabled and consent is communicated via text below the OAuth buttons,
 * reducing friction at the critical conversion moment.
 */
export interface AuthProvidersProps {
  mode: "login" | "signup" | "auto";
  enableOAuth: boolean;
  enablePassword: boolean;
  enableMagicLink: boolean;
  loading: boolean;
  /** Optional Apple Sign-In handler. When provided, an Apple button is shown before Google (per Apple HIG). */
  onAppleClick?: () => void;
  onGoogleClick: () => void;
  onEmailPasswordClick: () => void;
  onMagicLinkClick: () => void;
}

export function AuthProviders({
  mode,
  enableOAuth,
  enablePassword,
  enableMagicLink,
  loading,
  onAppleClick,
  onGoogleClick,
  onEmailPasswordClick,
  onMagicLinkClick,
}: AuthProvidersProps) {
  return (
    <div className="grid gap-3 pt-2">
      {enableOAuth && onAppleClick && (
        <Button
          onClick={onAppleClick}
          className="w-full"
          size="lg"
          variant="default"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <svg
              className="mr-2 h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
          )}
          Continue with Apple
        </Button>
      )}

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

      {/* Passive consent notice — shown after OAuth buttons in signup mode */}
      {enableOAuth && mode === "signup" && (
        <p className="text-center text-xs text-muted-foreground">
          By signing up, you agree to our{" "}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Terms
          </a>{" "}
          and{" "}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Privacy Policy
          </a>
        </p>
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
