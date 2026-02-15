"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FORECAST_REGIONS } from "@/lib/data/forecast-regions";
import { REGION_GROUPS } from "@/lib/data/region-groups";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { trackAuthModalOpened } from "@/lib/analytics/auth-events";
import { useLandingLocation } from "@/hooks/use-landing-location";

const STATIC_MENU_ITEMS = [
  { label: "7-Day Outlook", href: "/forecast", category: "Forecast" },
  { label: "Live Cams", href: "/cams", category: "Forecast" },
  { label: "United States", href: "/beaches/usa", category: "Countries" },
  { label: "Mexico", href: "/beaches/mexico", category: "Countries" },
  {
    label: "Reef Breaks",
    href: "/map?type=reef",
    category: "Surf Spot Types",
  },
  {
    label: "Point Breaks",
    href: "/map?type=point",
    category: "Surf Spot Types",
  },
  {
    label: "Beach Breaks",
    href: "/map?type=beach",
    category: "Surf Spot Types",
  },
  {
    label: "Beginner-Friendly",
    href: "/map?level=beginner",
    category: "Surf Spot Types",
  },
];

const GROUPED_STATIC_ITEMS = STATIC_MENU_ITEMS.reduce(
  (acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  },
  {} as Record<string, typeof STATIC_MENU_ITEMS>
);

export function Navbar({ autoOpenLogin = false }: { autoOpenLogin?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const { regionName } = useLandingLocation();

  // Prevent hydration mismatch from Radix UI components generating different IDs
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-open login modal for returning users (once per mount)
  const hasAutoOpened = useRef(false);
  useEffect(() => {
    if (autoOpenLogin && mounted && !hasAutoOpened.current) {
      hasAutoOpened.current = true;
      setAuthMode("login");
      setAuthModalOpen(true);
      trackAuthModalOpened({
        mode: "login",
        source: "returning-user-auto",
      });
    }
  }, [autoOpenLogin, mounted]);

  // Match user's detected region to a forecast region slug for "Near you" badge
  const nearbySlug = useMemo(() => {
    if (!regionName) return null;
    const match = Object.values(FORECAST_REGIONS).find(
      (r) => r.name.toLowerCase() === regionName.toLowerCase()
    );
    return match?.slug ?? null;
  }, [regionName]);

  return (
    <nav className="absolute top-0 left-0 right-0 z-50 w-full">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center py-5">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <Image
                src="/logoQuiver.png"
                alt="Quiver Logo"
                width={32}
                height={32}
                priority
                className="transition-transform group-hover:scale-110"
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {/* Explore Dropdown */}
            {mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 text-white hover:text-white/80 transition-colors font-medium [text-shadow:_0_1px_3px_rgb(0_0_0_/_40%)]">
                  Explore
                  <ChevronDown className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-80 max-h-[80vh] overflow-y-auto p-4">
                  {/* Region groups */}
                  {REGION_GROUPS.map((group) => (
                    <div key={group.label} className="mb-3 last:mb-0">
                      <DropdownMenuLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 py-1">
                        {group.label}
                      </DropdownMenuLabel>
                      {group.slugs.map((slug) => {
                        const region = FORECAST_REGIONS[slug];
                        if (!region) return null;
                        return (
                          <DropdownMenuItem key={slug} asChild>
                            <Link
                              href={`/forecast/${slug}`}
                              className="flex items-center gap-2 px-2 py-1.5 text-sm text-dark-grey hover:text-ocean-blue hover:bg-blue-50 rounded cursor-pointer"
                            >
                              {region.name}
                              {nearbySlug === slug && (
                                <span className="text-[10px] font-medium text-ocean-blue bg-blue-50 px-1.5 py-0.5 rounded-full">
                                  Near you
                                </span>
                              )}
                            </Link>
                          </DropdownMenuItem>
                        );
                      })}
                    </div>
                  ))}
                  <DropdownMenuSeparator />
                  {/* Static items grouped by category */}
                  {Object.entries(GROUPED_STATIC_ITEMS).map(([category, items]) => (
                    <div key={category} className="mb-3 last:mb-0">
                      <DropdownMenuLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 py-1">
                        {category}
                      </DropdownMenuLabel>
                      {items.map((item) => (
                        <DropdownMenuItem key={item.label} asChild>
                          <Link
                            href={item.href}
                            className="block px-2 py-1.5 text-sm text-dark-grey hover:text-ocean-blue hover:bg-blue-50 rounded cursor-pointer"
                          >
                            {item.label}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className="flex items-center gap-1 text-white hover:text-white/80 transition-colors font-medium [text-shadow:_0_1px_3px_rgb(0_0_0_/_40%)]">
                Explore
                <ChevronDown className="h-4 w-4" />
              </span>
            )}

            {/* Other Nav Links */}
            <Link
              href="/discover"
              className="text-white hover:text-white/80 transition-colors font-medium [text-shadow:_0_1px_3px_rgb(0_0_0_/_40%)]"
            >
              Discover
            </Link>

            {/* Auth Buttons */}
            <div className="flex items-center gap-4 ml-2">
              <button
                onClick={() => {
                  setAuthMode("login");
                  setAuthModalOpen(true);
                  trackAuthModalOpened({
                    mode: "login",
                    source: "landing-navbar",
                  });
                }}
                className="text-white/70 hover:text-white text-sm font-medium transition-colors"
              >
                Log in
              </button>
              <Button
                onClick={() => {
                  setAuthMode("signup");
                  setAuthModalOpen(true);
                  trackAuthModalOpened({
                    mode: "signup",
                    source: "landing-navbar",
                  });
                }}
                className="bg-white/95 text-ocean-blue hover:bg-white font-semibold rounded-full px-5 py-2 shadow-lg backdrop-blur-sm hover:shadow-xl transition-all duration-200"
              >
                Get Started
              </Button>
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden">
            {mounted ? (
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/10"
                    aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                    data-testid="mobile-menu-button"
                  >
                    {mobileMenuOpen ? (
                      <X className="h-6 w-6" />
                    ) : (
                      <Menu className="h-6 w-6" />
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80 p-0 flex flex-col">
                  {/* Scrollable menu content */}
                  <div className="flex-1 overflow-y-auto px-6">
                    <div className="flex flex-col gap-6 mt-8">
                      {/* Mobile Explore - Region groups */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                          Explore
                        </h3>
                        {REGION_GROUPS.map((group) => (
                          <div key={group.label} className="mb-4">
                            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                              {group.label}
                            </div>
                            {group.slugs.map((slug) => {
                              const region = FORECAST_REGIONS[slug];
                              if (!region) return null;
                              return (
                                <Link
                                  key={slug}
                                  href={`/forecast/${slug}`}
                                  className="flex items-center gap-2 px-3 py-2 text-dark-grey hover:text-ocean-blue hover:bg-blue-50 rounded"
                                  onClick={() => setMobileMenuOpen(false)}
                                >
                                  {region.name}
                                  {nearbySlug === slug && (
                                    <span className="text-[10px] font-medium text-ocean-blue bg-blue-50 px-1.5 py-0.5 rounded-full">
                                      Near you
                                    </span>
                                  )}
                                </Link>
                              );
                            })}
                          </div>
                        ))}
                        {/* Static items */}
                        {Object.entries(
                          STATIC_MENU_ITEMS.reduce(
                            (acc, item) => {
                              if (!acc[item.category]) acc[item.category] = [];
                              acc[item.category].push(item);
                              return acc;
                            },
                            {} as Record<string, typeof STATIC_MENU_ITEMS>
                          )
                        ).map(([category, items]) => (
                          <div key={category} className="mb-4">
                            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                              {category}
                            </div>
                            {items.map((item) => (
                              <Link
                                key={item.label}
                                href={item.href}
                                className="block px-3 py-2 text-dark-grey hover:text-ocean-blue hover:bg-blue-50 rounded"
                                onClick={() => setMobileMenuOpen(false)}
                              >
                                {item.label}
                              </Link>
                            ))}
                          </div>
                        ))}
                      </div>

                      {/* Mobile Other Links */}
                      <div className="border-t pt-4">
                        <Link
                          href="/discover"
                          className="block px-3 py-2 text-dark-grey hover:text-ocean-blue hover:bg-blue-50 rounded font-medium"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Discover
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Auth Buttons - Pinned to bottom */}
                  <div className="border-t pt-4 pb-6 px-6 mt-auto flex flex-col gap-3">
                    <Button
                      size="lg"
                      className="w-full bg-ocean-blue hover:bg-ocean-blue/90 text-white font-semibold"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setAuthMode("signup");
                        setAuthModalOpen(true);
                        trackAuthModalOpened({
                          mode: "signup",
                          source: "landing-navbar-mobile",
                        });
                      }}
                    >
                      Get Started
                    </Button>
                    <Button
                      variant="ghost"
                      size="lg"
                      className="w-full text-gray-600"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setAuthMode("login");
                        setAuthModalOpen(true);
                        trackAuthModalOpened({
                          mode: "login",
                          source: "landing-navbar-mobile",
                        });
                      }}
                    >
                      Log in
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
                aria-label="Open menu"
                data-testid="mobile-menu-button"
              >
                <Menu className="h-6 w-6" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode={authMode}
        source="landing-navbar"
        returnTo="/"
        contextMessage={authMode === "signup" ? { title: "Get Started", description: "Personalized surf forecasts in 30 seconds" } : undefined}
      />
    </nav>
  );
}
