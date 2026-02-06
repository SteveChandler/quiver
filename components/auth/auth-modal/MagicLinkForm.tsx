"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail } from "lucide-react";
import { validateEmail } from "@/lib/auth/auth-utils";

/**
 * Magic link form view
 */
export interface MagicLinkFormProps {
  email: string;
  loading: boolean;
  emailInputRef: React.RefObject<HTMLInputElement | null>;
  onEmailChange: (email: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}

export function MagicLinkForm({
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
          onKeyDown={(e) => e.key === "Enter" && !loading && onSubmit()}
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
