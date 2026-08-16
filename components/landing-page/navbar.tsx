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
import { cn } from "@/lib/utils";

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
  "inline-flex min-h-11 items-center justify-center rounded-md border border-[#11100D]/45 bg-transparent px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#11100D] transition hover:bg-[#11100D]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3A75] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4EBD8]";
const NAVBAR_MOBILE_CTA_CLASS =
  "inline-flex min-h-12 w-full items-center justify-center rounded-md bg-[#F78E42] px-4 text-base font-bold text-[#11100D] transition hover:bg-[#FDB84B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3A75]";
const NAVBAR_APP_CTA_LABEL = "Get the app";

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
        {NAVBAR_APP_CTA_LABEL}
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
      iosLabel={NAVBAR_APP_CTA_LABEL}
      androidLabel={NAVBAR_APP_CTA_LABEL}
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

  const isStatic = position === "static";
  const navTextClass = isStatic
    ? "text-[#11100D] hover:text-[#0B3A75] [text-shadow:none]"
    : "text-white hover:text-white/80 [text-shadow:_0_1px_3px_rgb(0_0_0_/_40%)]";

  return (
    <nav
      className={
        isStatic
          ? "relative z-50 w-full border-b border-[#11100D]/10 bg-[#F4EBD8]"
          : "absolute top-0 left-0 right-0 z-50 w-full"
      }
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-center justify-between py-3 sm:py-4 md:py-3">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <Image
                src="/quiver-app-icon.png"
                alt="Quiver Logo"
                width={48}
                height={48}
                priority
                className="h-10 w-10 transition-transform group-hover:scale-110 sm:h-12 sm:w-12"
              />
              <span
                className={cn(
                  "hidden text-lg font-semibold tracking-tight sm:inline",
                  isStatic
                    ? "text-[#11100D]"
                    : "text-white [text-shadow:_0_1px_3px_rgb(0_0_0_/_40%)]",
                )}
              >
                Quiver
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6" suppressHydrationWarning>
            <Link
              href="#features"
              className={cn(
                "font-mono text-sm font-bold uppercase tracking-[0.18em] transition-colors",
                navTextClass,
              )}
            >
              Features
            </Link>

            {/* Explore Dropdown */}
            {mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={cn(
                    "flex items-center gap-1 font-mono text-sm font-bold uppercase tracking-[0.18em] transition-colors",
                    navTextClass,
                  )}
                >
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
              <span
                className={cn(
                  "flex items-center gap-1 font-mono text-sm font-bold uppercase tracking-[0.18em] transition-colors",
                  navTextClass,
                )}
              >
                Spots
                <ChevronDown className="h-4 w-4" />
              </span>
            )}

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
                className={cn(
                  "font-mono text-xs font-bold uppercase tracking-[0.14em] transition-colors",
                  navTextClass,
                ) + " focus-ring"}
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
                    className={cn(
                      isStatic
                        ? "text-[#11100D] hover:bg-[#11100D]/10"
                        : "text-white hover:bg-white/10",
                    )}
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
                    Browse surf spots, open the app, or log in.
                  </SheetDescription>
                  {/* Scrollable menu content */}
                  <div className="flex-1 overflow-y-auto px-6">
                    <div className="flex flex-col gap-6 mt-8">
                      <Link
                        href="#features"
                        className="block px-3 py-2 font-mono text-sm font-bold uppercase tracking-[0.18em] text-dark-grey hover:text-ocean-blue hover:bg-blue-50 rounded"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Features
                      </Link>

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
                className={cn(
                  isStatic
                    ? "text-[#11100D] hover:bg-[#11100D]/10"
                    : "text-white hover:bg-white/10",
                )}
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
