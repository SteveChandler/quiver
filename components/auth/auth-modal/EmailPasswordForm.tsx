"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { TermsCheckbox } from "./TermsCheckbox";

/**
 * Email + password form view
 */
export interface EmailPasswordFormProps {
  mode: "login" | "signup" | "auto";
  email: string;
  password: string;
  displayName: string;
  termsAccepted: boolean;
  loading: boolean;
  emailInputRef: React.RefObject<HTMLInputElement | null>;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  onDisplayNameChange: (name: string) => void;
  onTermsAcceptedChange: (accepted: boolean) => void;
  onSubmit: () => void;
  onBack: () => void;
}

export function EmailPasswordForm({
  mode,
  email,
  password,
  displayName,
  termsAccepted,
  loading,
  emailInputRef,
  onEmailChange,
  onPasswordChange,
  onDisplayNameChange,
  onTermsAcceptedChange,
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
          onKeyDown={(e) => e.key === "Enter" && !loading && onSubmit()}
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
          onKeyDown={(e) => e.key === "Enter" && !loading && onSubmit()}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          disabled={loading}
        />
      </div>

      {mode === "signup" && (
        <TermsCheckbox
          checked={termsAccepted}
          onCheckedChange={onTermsAcceptedChange}
          disabled={loading}
        />
      )}

      <Button
        onClick={onSubmit}
        className="w-full"
        size="lg"
        disabled={loading || (mode === "signup" && !termsAccepted)}
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
