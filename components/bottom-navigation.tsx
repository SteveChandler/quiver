"use client";

import { Home, Map, CalendarDays, User } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ModeToggle } from "./mode-toggle";
import { useState, useEffect, useCallback, useRef } from "react";

export function BottomNavigation() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

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
      name: "Sessions",
      href: "/sessions",
      icon: CalendarDays,
    },
    {
      name: "Profile",
      href: "/profile",
      icon: User,
    },
  ];

  const showNavigation = useCallback(() => {
    setIsVisible(true);

    // Clear existing timer
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    // Set new timer to hide after 3 seconds of inactivity
    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 3000);
  }, []);

  const handleUserActivity = useCallback(() => {
    showNavigation();
  }, [showNavigation]);

  useEffect(() => {
    // Add event listeners for user activity
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
  }, [handleUserActivity, showNavigation]);

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-10 bg-background border-t transition-transform duration-300 ease-in-out",
        isVisible ? "translate-y-0" : "translate-y-full"
      )}
    >
      <div className="absolute top-0 right-4 -translate-y-12">
        <ModeToggle />
      </div>
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
