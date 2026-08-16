"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

/**
 * Email + password form view
 *
 * Terms consent is handled passively via the provider selection view — no
 * checkbox is shown here. The submit button is enabled as soon as loading
 * completes.
 */
export interface EmailPasswordFormProps {
  mode: "login" | "signup" | "auto";
  email: string;
  password: string;
  displayName: string;
  loading: boolean;
  emailInputRef: React.RefObject<HTMLInputElement | null>;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  onDisplayNameChange: (name: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  emailSuggestion?: { suggestion: string; suggestedEmail: string } | null;
  onAcceptSuggestion?: (correctedEmail: string) => void;
}

export function EmailPasswordForm({
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
  emailSuggestion,
  onAcceptSuggestion,
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
          onKeyDown={(e) => e.key === "Enter" && !loading && onSubmit()}
          autoComplete="email"
          ref={emailInputRef}
          disabled={loading}
        />
        {emailSuggestion && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {emailSuggestion.suggestion}{" "}
            <button
              type="button"
              className="underline font-medium hover:text-amber-700 dark:hover:text-amber-300 focus-ring"
              onClick={() => onAcceptSuggestion?.(emailSuggestion.suggestedEmail)}
            >
              Use {emailSuggestion.suggestedEmail}
            </button>
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && onSubmit()}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          disabled={loading}
        />
      </div>

      {/* Passive consent notice for signup — no checkbox, just informational text */}
      {mode === "signup" && (
        <p className="text-xs text-muted-foreground">
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
