"use client";

import { Home, Map, CalendarDays, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { UI_TIMING } from "@/lib/constants/ui";

export function BottomNavigation() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Hide navigation on session wizard pages to prevent interference with wizard footer
  const isSessionWizard = pathname === '/sessions/new';
  if (isSessionWizard) {
    return null;
  }

  // Check if we're in test mode (disable auto-hide for testing)
  const isTestMode =
    typeof window !== "undefined" &&
    (window.location.search.includes("test=true") ||
      process.env.NODE_ENV === "test" ||
      // @ts-ignore - Playwright sets this global
      window.__PLAYWRIGHT__ === true ||
      // Check for Playwright user agent
      navigator.userAgent.includes("Playwright"));

  const navItems = [
    {
      name: "Home",
      href: "/",
      icon: Home,
    },
    {
      name: "Map",
      href: "/map",
      icon: Map,
    },
    {
      name: "Discover",
      href: "/discover",
      icon: Users,
    },
    {
      name: "Profile",
      href: "/profile",
      icon: User,
    },
  ];

  const showNavigation = useCallback(() => {
    setIsVisible(true);

    // Skip auto-hide in test mode
    if (isTestMode) {
      return;
    }

    // Clear existing timer
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    // Set new timer to hide after configured delay of inactivity
    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, UI_TIMING.AUTO_HIDE_DELAY);
  }, [isTestMode]);

  const handleUserActivity = useCallback(() => {
    showNavigation();
  }, [showNavigation]);

  useEffect(() => {
    // Add event listeners for user activity (but not in test mode)
    if (!isTestMode) {
      const options = { passive: true };
      window.addEventListener("scroll", handleUserActivity, options);
      window.addEventListener("touchstart", handleUserActivity, options);
      window.addEventListener("touchmove", handleUserActivity, options);
      window.addEventListener("mousemove", handleUserActivity, options);

      // Show navigation initially and set timer
      showNavigation();

      return () => {
        // Cleanup event listeners
        window.removeEventListener("scroll", handleUserActivity);
        window.removeEventListener("touchstart", handleUserActivity);
        window.removeEventListener("touchmove", handleUserActivity);
        window.removeEventListener("mousemove", handleUserActivity);

        // Clear timer
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
        }
      };
    } else {
      // In test mode, just show navigation and keep it visible
      setIsVisible(true);
    }
  }, [handleUserActivity, showNavigation, isTestMode]);

  return (
    <div
      data-testid="bottom-navigation"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-10 bg-background border-t transition-transform duration-300 ease-in-out",
        isVisible ? "translate-y-0" : "translate-y-full"
      )}
    >
      <nav className="flex justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center py-2 px-4 text-xs",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              onClick={handleUserActivity} // Show nav when user taps a nav item
            >
              <item.icon
                className={cn(
                  "h-6 w-6 mb-1",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
