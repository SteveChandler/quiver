"use client";

import React, { useEffect, useRef, useState } from "react";
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
 * Bottom navigation items.
 * Labels are aligned with desktop top-nav language:
 *   "Discover" matches desktop "Discover" (/map)
 *   "Sessions" matches desktop "Sessions" (/profile?tab=sessions)
 */
const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/map", label: "Discover", icon: Map },
  { href: "/profile?tab=sessions", label: "Sessions", icon: BookOpen },
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

  // Hide on scroll-down, show on scroll-up to reclaim screen real estate on
  // content-dense mobile layouts. Always visible at the top of the page.
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;

      if (currentY < 50) {
        setVisible(true);
      } else if (delta > 10) {
        setVisible(false); // scrolling down
      } else if (delta < -10) {
        setVisible(true); // scrolling up
      }

      lastScrollY.current = currentY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
        "bg-[#1E2560] border-t border-[#404C92]",
        "pb-[env(safe-area-inset-bottom)]",
        "md:hidden", // Only show on mobile/small tablets
        "transition-transform duration-300 ease-out motion-reduce:transition-none",
        visible ? "translate-y-0" : "translate-y-full"
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
                  ? "text-[#F78E42]"
                  : "text-[#7B83B5] hover:text-[#A0A8D0] active:text-[#C0C8E0]"
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon
                className={cn(
                  "h-6 w-6 mb-1",
                  active ? "text-[#F78E42]" : "text-[#5A6298]"
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
