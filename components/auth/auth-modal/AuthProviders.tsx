"use client";

import { Button } from "@/components/ui/button";
import { Loader2, LogIn, Mail } from "lucide-react";
import { TermsCheckbox } from "./TermsCheckbox";

/**
 * Provider selection view
 */
export interface AuthProvidersProps {
  mode: "login" | "signup" | "auto";
  enableOAuth: boolean;
  enablePassword: boolean;
  enableMagicLink: boolean;
  loading: boolean;
  termsAccepted: boolean;
  onTermsAcceptedChange: (accepted: boolean) => void;
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
  termsAccepted,
  onTermsAcceptedChange,
  onGoogleClick,
  onEmailPasswordClick,
  onMagicLinkClick,
}: AuthProvidersProps) {
  return (
    <div className="grid gap-3 pt-2">
      {mode === "signup" && (
        <TermsCheckbox
          checked={termsAccepted}
          onCheckedChange={onTermsAcceptedChange}
          disabled={loading}
        />
      )}
      {enableOAuth && (
        <Button
          onClick={onGoogleClick}
          className="w-full"
          size="lg"
          variant="default"
          disabled={loading || (mode === "signup" && !termsAccepted)}
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
