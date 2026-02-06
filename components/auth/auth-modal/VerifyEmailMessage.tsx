"use client";

import { Mail } from "lucide-react";

/**
 * Email verification message
 */
export interface VerifyEmailMessageProps {
  email: string;
}

export function VerifyEmailMessage({ email }: VerifyEmailMessageProps) {
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
