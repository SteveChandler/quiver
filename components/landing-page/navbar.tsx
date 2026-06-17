"use client";

import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { trackAuthModalOpened } from "@/lib/analytics/auth-events";
import { trackSigninCtaClick } from "@/lib/analytics/signup-conversion-tracking";
import { IosAppStoreCta } from "@/components/app-store/ios-app-store-cta";
import { NativeAppFunnelCta } from "@/components/app-store/native-app-funnel-cta";
import {
  getFirstTouchPlatform,
  type FirstTouchPlatform,
} from "@/lib/analytics/web-context";
import { useLandingLocation } from "@/hooks/use-landing-location";
import HeroSearchLazy from "@/components/landing-page/hero-search-lazy";
import { useRouter } from "next/navigation";
import { IOS_APP_STORE_CTA } from "@/lib/constants/app-store";

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

type NavbarPosition = "overlay" | "static";
type NavbarNativeCtaPlacement = "navbar_primary" | "navbar_mobile_primary";

const NAVBAR_CTA_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-ocean-blue px-6 py-3 font-sans text-sm font-semibold text-white shadow-sm transition hover:bg-ocean-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]";
const NAVBAR_MOBILE_CTA_CLASS =
  "inline-flex min-h-12 w-full items-center justify-center rounded-md bg-ocean-blue px-4 text-base font-semibold text-white transition hover:bg-ocean-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-blue";

function NavbarNativeCta({
  platform,
  placement,
  className,
}: {
  platform: FirstTouchPlatform;
  placement: NavbarNativeCtaPlacement;
  className: string;
}): ReactElement {
  if (platform === "desktop") {
    return (
      <IosAppStoreCta
        source="landing-navbar-app-store"
        surface="landing-page"
        placement={placement}
        className={className}
      >
        {IOS_APP_STORE_CTA}
      </IosAppStoreCta>
    );
  }

  return (
    <NativeAppFunnelCta
      platform={platform}
      source="landing-navbar"
      surface="landing-page"
      placement={placement}
      className={className}
    />
  );
}

export function Navbar({
  autoOpenLogin = false,
  position = "overlay",
}: {
  autoOpenLogin?: boolean;
  position?: NavbarPosition;
}) {
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [nativeCtaPlatform, setNativeCtaPlatform] =
    useState<FirstTouchPlatform>("desktop");
  const { regionName } = useLandingLocation();
  const router = useRouter();

  const navigateToMap = (query?: string) => {
    const trimmed = query?.trim();
    const url =
      trimmed && trimmed.length > 0
        ? `/map?search=${encodeURIComponent(trimmed)}`
        : "/map";
    router.push(url);
  };

  // Prevent hydration mismatch from Radix UI components generating different IDs
  useEffect(() => {
    setMounted(true);
    setNativeCtaPlatform(getFirstTouchPlatform());
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
    <nav
      className={
        position === "static"
          ? "relative z-50 w-full bg-[#252D6B]"
          : "absolute top-0 left-0 right-0 z-50 w-full"
      }
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center py-5">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <Image
                src="/quiver-app-icon.png"
                alt="Quiver Logo"
                width={48}
                height={48}
                priority
                className="transition-transform group-hover:scale-110"
              />
              <span className="text-white font-semibold text-lg tracking-tight [text-shadow:_0_1px_3px_rgb(0_0_0_/_40%)] hidden sm:inline">
                Quiver
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6" suppressHydrationWarning>
            {/* Explore Dropdown */}
            {mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 text-white hover:text-white/80 transition-colors font-medium [text-shadow:_0_1px_3px_rgb(0_0_0_/_40%)]">
                  Spots
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
                Spots
                <ChevronDown className="h-4 w-4" />
              </span>
            )}

            {/* Compact Search Bar */}
            <div className="w-[300px]">
              <HeroSearchLazy onFallback={navigateToMap} />
            </div>

            {/* Auth Buttons */}
            <div className="flex items-center gap-4 ml-2">
              <button
                onClick={() => {
                  trackSigninCtaClick({
                    source: "landing-navbar",
                    cta_type: "nav_button",
                  });
                  setAuthMode("login");
                  setAuthModalOpen(true);
                }}
                className="text-medium hover:text-white text-sm font-medium transition-colors"
              >
                Log in
              </button>
              <NavbarNativeCta
                platform={nativeCtaPlatform}
                placement="navbar_primary"
                className={NAVBAR_CTA_CLASS}
              />
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden" suppressHydrationWarning>
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
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <SheetDescription className="sr-only">
                    Browse surf spots, search beaches, open the app, or log in.
                  </SheetDescription>
                  {/* Scrollable menu content */}
                  <div className="flex-1 overflow-y-auto px-6">
                    <div className="flex flex-col gap-6 mt-8">
                      {/* Mobile Search */}
                      <div className="w-full">
                        <HeroSearchLazy onFallback={navigateToMap} />
                      </div>

                      {/* Mobile Explore - Region groups */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                          Spots
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

                    </div>
                  </div>

                  {/* Mobile Auth Buttons - Pinned to bottom */}
                  <div className="border-t pt-4 pb-6 px-6 mt-auto flex flex-col gap-3">
                    <NavbarNativeCta
                      platform={nativeCtaPlatform}
                      placement="navbar_mobile_primary"
                      className={NAVBAR_MOBILE_CTA_CLASS}
                    />
                    <Button
                      variant="ghost"
                      size="lg"
                      className="w-full text-gray-600"
                      onClick={() => {
                        trackSigninCtaClick({
                          source: "landing-navbar-mobile",
                          cta_type: "nav_button",
                        });
                        setMobileMenuOpen(false);
                        setAuthMode("login");
                        setAuthModalOpen(true);
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
        contextMessage={authMode === "signup" ? { title: "Get Free Alerts", description: "Know when conditions match your level and spots." } : undefined}
      />
    </nav>
  );
}
