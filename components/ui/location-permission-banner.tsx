"use client";

import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MapPin, X } from "lucide-react";

type LocationErrorType = "denied" | "unavailable" | "timeout";

interface LocationPermissionBannerProps {
  errorType: LocationErrorType;
  onRetry: () => void;
  onDismiss?: () => void;
}

const STORAGE_KEY = "quiver_location_permission_dismissed";

const ERROR_MESSAGES: Record<
  LocationErrorType,
  { title: string; description: string; buttonText: string }
> = {
  denied: {
    title: "Location Access Denied",
    description:
      "Grant permission for personalized beach recommendations near you.",
    buttonText: "Grant Location Access",
  },
  unavailable: {
    title: "Location Unavailable",
    description:
      "Your device location couldn't be determined. Check your settings and try again.",
    buttonText: "Try Again",
  },
  timeout: {
    title: "Location Request Timed Out",
    description:
      "The location request took too long. This may be due to weak GPS signal.",
    buttonText: "Retry",
  },
};

export function LocationPermissionBanner({
  errorType,
  onRetry,
  onDismiss,
}: LocationPermissionBannerProps) {
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
    onDismiss?.();
  };

  const handleRetry = () => {
    // Clear dismissed state when user actively tries to retry
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        // localStorage not available or disabled - fail silently
        console.warn("localStorage not available:", error);
      }
    }
    setIsDismissed(false);
    onRetry();
  };

  if (isDismissed) {
    return null;
  }

  const { title, description, buttonText } = ERROR_MESSAGES[errorType];

  return (
    <Alert
      className="relative bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800"
      data-testid="location-permission-banner"
    >
      <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-900 dark:text-amber-100">
        {title}
      </AlertTitle>
      <AlertDescription className="text-amber-800 dark:text-amber-200">
        {description}
      </AlertDescription>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          onClick={handleRetry}
          size="sm"
          variant="default"
          className="bg-amber-600 hover:bg-amber-700 text-white"
          data-testid="location-permission-retry-button"
        >
          <MapPin className="h-4 w-4 mr-1" />
          {buttonText}
        </Button>
        <Button
          onClick={handleDismiss}
          size="sm"
          variant="ghost"
          className="text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
          data-testid="location-permission-dismiss-text-button"
        >
          Dismiss
        </Button>
      </div>
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-100 focus-ring"
        aria-label="Dismiss banner"
        data-testid="location-permission-dismiss-button"
      >
        <X className="h-4 w-4" />
      </button>
    </Alert>
  );
}
