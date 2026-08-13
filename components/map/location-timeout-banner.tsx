"use client";

import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MapPin, X } from "lucide-react";

interface LocationTimeoutBannerProps {
  onGrantLocation: () => void;
}

const STORAGE_KEY = "quiver_location_timeout_dismissed";

export function LocationTimeoutBanner({
  onGrantLocation,
}: LocationTimeoutBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const dismissed = localStorage.getItem(STORAGE_KEY);
        setIsDismissed(dismissed === "true");
      } catch (error) {
        // localStorage not available or disabled - fail silently
        console.warn("localStorage not available:", error);
      }
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, "true");
      } catch (error) {
        // localStorage not available or disabled - fail silently
        console.warn("localStorage not available:", error);
      }
    }
  };

  const handleGrantLocation = () => {
    // Clear dismissed state when user actively tries to grant location
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        // localStorage not available or disabled - fail silently
        console.warn("localStorage not available:", error);
      }
    }
    setIsDismissed(false);
    onGrantLocation();
  };

  if (isDismissed) {
    return null;
  }

  return (
    <Alert
      className="relative bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800"
      data-testid="location-timeout-banner"
    >
      <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-900 dark:text-amber-100">
        Using Default Location
      </AlertTitle>
      <AlertDescription className="text-amber-800 dark:text-amber-200">
        We&apos;re showing beaches near Ocean Beach, San Diego. Grant location
        access for accurate results near you.
      </AlertDescription>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          onClick={handleGrantLocation}
          size="sm"
          variant="default"
          className="min-h-11 bg-amber-600 hover:bg-amber-700 text-white"
        >
          <MapPin className="h-4 w-4 mr-1" />
          Grant Location Access
        </Button>
        <Button
          onClick={handleDismiss}
          size="sm"
          variant="ghost"
          className="min-h-11 text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
        >
          Dismiss
        </Button>
      </div>
      <button
        onClick={handleDismiss}
        className="absolute right-1 top-1 inline-flex h-11 w-11 items-center justify-center text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-100 focus-ring"
        aria-label="Dismiss banner"
        data-testid="dismiss-banner-button"
      >
        <X className="h-4 w-4" />
      </button>
    </Alert>
  );
}
