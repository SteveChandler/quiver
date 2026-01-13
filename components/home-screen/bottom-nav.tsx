"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, Map, BookOpen, User } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Navigation item configuration
 */
interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * Bottom navigation items
 */
const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/map", label: "Map", icon: Map },
  { href: "/profile?tab=sessions", label: "Log", icon: BookOpen },
  { href: "/profile", label: "Profile", icon: User },
];

/**
 * BottomNav - Fixed bottom navigation bar for mobile devices
 *
 * Features:
 * - Fixed position at bottom of screen
 * - Safe area padding for iOS devices
 * - Active state highlighting with orange accent
 * - Hidden on medium+ screens (md:hidden)
 * - Proper touch targets (44px minimum)
 *
 * @example
 * ```tsx
 * // Add to layout or page component
 * <BottomNav />
 * ```
 */
export function BottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * Determine if a nav item is currently active
   */
  const isActive = (href: string): boolean => {
    // Home is only active on exact match
    if (href === "/") {
      return pathname === "/";
    }
    // Log tab: match /profile with sessions tab
    if (href === "/profile?tab=sessions") {
      return pathname === "/profile" && searchParams.get("tab") === "sessions";
    }
    // Profile: exact match only (not when on sessions tab)
    if (href === "/profile") {
      return pathname === "/profile" && searchParams.get("tab") !== "sessions";
    }
    // Other routes: prefix match
    return pathname.startsWith(href);
  };

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40",
        "bg-white border-t border-gray-200",
        "pb-[env(safe-area-inset-bottom)]",
        "md:hidden" // Only show on mobile/small tablets
      )}
      role="navigation"
      aria-label="Main navigation"
      data-testid="bottom-nav"
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center",
                "w-full h-full min-h-[44px]",
                "text-xs font-medium transition-colors",
                active
                  ? "text-accent-orange"
                  : "text-gray-500 hover:text-gray-700 active:text-gray-900"
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon
                className={cn(
                  "h-6 w-6 mb-1",
                  active ? "text-accent-orange" : "text-gray-400"
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;
