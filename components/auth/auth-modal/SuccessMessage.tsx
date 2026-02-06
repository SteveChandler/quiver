"use client";

import { LogIn } from "lucide-react";

/**
 * Success confirmation message
 */
export function SuccessMessage() {
  return (
    <div className="py-4 text-center space-y-3">
      <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
        <LogIn className="h-6 w-6 text-green-600" />
      </div>
      <div>
        <h3 className="font-semibold">Success!</h3>
        <p className="text-sm text-muted-foreground mt-1">
          You&apos;re now signed in.
        </p>
      </div>
    </div>
  );
}
