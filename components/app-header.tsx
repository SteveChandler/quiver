"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth } from "@/context/auth-context";
import {
  Loader2,
  User,
  LogOut,
  Search,
  Menu,
  Home,
  Map,
  Users,
  CalendarDays,
  Settings,
  Waves,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { preserveQueryParams } from "@/lib/utils/navigation-utils";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

import { useCachedProfile } from "@/hooks/use-cached-profile";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import {
  trackSignupCtaClick,
  trackSigninCtaClick,
} from "@/lib/analytics/signup-conversion-tracking";
import { isValidStateSlug } from "@/lib/utils/beach-url-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Detect whether the current pathname is a beach-context page (a covered
 * US state slug, Puerto Rico, or a Mexico beach route). Source of truth
 * for both the header CTA label and the signup source attribution so
 * the two can't drift apart.
 *
 * Previously this was a hardcoded regex `/^\/(ca|hi|or|wa|pr|mx)\//`
 * which missed every east-coast state and used a wrong `/mx/` prefix.
 */
function isBeachContextPath(pathname: string): boolean {
  const firstSegment = pathname.split("/")[1] ?? "";
  return firstSegment === "mexico" || isValidStateSlug(firstSegment);
}

export function AppHeader() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  // IMPORTANT: All hooks MUST be called before any conditional returns
  // This ensures the same hooks are called in the same order on every render

  // Use shared profile loading hook
  const { profile, profileLoading } = useCachedProfile();

  // Search state for header search bar
  const [searchQuery, setSearchQuery] = useState("");

  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auth modal state for unauthenticated users
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  // Prevent hydration mismatch: auth state resolves before children hydrate,
  // causing server HTML (spinner) to differ from client DOM (login buttons).
  // Always render spinner until after mount so first client render matches server.
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => setHasMounted(true), []);

  // Handle search submission
  const handleSearch = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (searchQuery.trim()) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("search", searchQuery.trim());
        router.push(`/map?${params.toString()}`);
      }
    },
    [searchQuery, router, searchParams],
  );

  // Handle mobile search icon click
  const handleMobileSearch = useCallback(() => {
    router.push("/map");
  }, [router]);

  // Don't render the app header on landing-style pages for unauthenticated users.
  // These pages render the landing Navbar instead.
  // IMPORTANT: This conditional return MUST come AFTER all hooks are called
  // Use hasMounted guard to prevent hydration mismatch: server always returns null
  // on "/", client matches on first render, then shows header after mount if logged in
  const usesLandingNav =
    pathname === "/" || pathname === "/cams" || pathname.startsWith("/cams/");
  const isRedeemPage = pathname === "/redeem";

  if (usesLandingNav && (!hasMounted || !user)) {
    return null;
  }

  const getSignupCta = (path: string) => {
    if (isBeachContextPath(path)) return "See Your Forecast";
    if (path.startsWith("/forecast")) return "Full Forecast";
    if (path.match(/^\/(beginner|longboard|dawn-patrol|tide|water-temp)\//))
      return "Find Your Spot";
    return "Get Started";
  };

  const getSignupContext = (
    path: string,
  ): { title: string; description: string } => {
    if (isBeachContextPath(path))
      return {
        title: "See Your Forecast",
        description: "Conditions explained clearly in 30 seconds",
      };
    if (path.startsWith("/forecast"))
      return {
        title: "See the Full Forecast",
        description: "Get the complete 12-day outlook",
      };
    return {
      title: "Get Started",
      description: "Conditions explained clearly in 30 seconds",
    };
  };

  // Check if user is admin (client-side check for UI only - server-side check in middleware)
  const isUserAdmin = profile?.is_admin === true;

  // Navigation items - different for authenticated vs unauthenticated users
  const navItems: { name: string; href: string }[] = user
    ? [
        { name: "Discover", href: "/map" },
        { name: "Alerts", href: "/alerts" },
        { name: "Sessions", href: "/profile?tab=sessions" },
        { name: "Community", href: "/discover" },
        ...(isUserAdmin ? [{ name: "Admin", href: "/admin" }] : []),
      ]
    : [
        { name: "Features", href: "/features" },
        { name: "Live Cams", href: "/cams" },
        { name: "Tools", href: "/tools" },
        { name: "Roadmap", href: "/roadmap" },
        { name: "What's New", href: "/whats-new" },
        { name: "About", href: "/about" },
      ];

  // Mobile navigation items for hamburger menu
  const mobileNavItems = [
    { name: "Home", href: "/", icon: Home },
    { name: "Map", href: "/map", icon: Map },
    { name: "Alerts", href: "/alerts", icon: Waves },
    { name: "Discover", href: "/discover", icon: Users },
    { name: "Sessions", href: "/profile?tab=sessions", icon: CalendarDays },
    { name: "Profile", href: "/profile", icon: User },
    ...(isUserAdmin ? [{ name: "Admin", href: "/admin", icon: Settings }] : []),
  ];

  const isActiveRoute = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href.startsWith("/#"))
      return pathname === "/" && href.includes("forecast");
    // Handle query parameter routes (e.g., /?tab=community)
    if (href.includes("?")) {
      const [hrefPath, hrefQuery] = href.split("?");
      if (pathname !== hrefPath) return false;
      const hrefParams = new URLSearchParams(hrefQuery);
      const currentParams = new URLSearchParams(searchParams.toString());
      // Check if all href params match current params
      for (const [key, value] of hrefParams.entries()) {
        if (currentParams.get(key) !== value) return false;
      }
      return true;
    }
    return pathname.startsWith(href);
  };

  // Helper function to preserve query parameters in navigation
  const getPreservedHref = (href: string) => {
    return preserveQueryParams(href, searchParams);
  };

  const safeAreaStyles: CSSProperties & { "--app-safe-area-top": string } = {
    "--app-safe-area-top": "env(safe-area-inset-top, 0px)",
  };

  return (
    <header
      className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-2 pt-[calc(var(--app-safe-area-top)+0.75rem)] md:py-0"
      style={safeAreaStyles}
    >
      <div
        className="flex w-full items-center md:h-16 gap-4"
        style={{ minHeight: "3.5rem" }}
      >
        {/* Left side with logo - uses container padding */}
        <div className="flex items-center pl-2 md:pl-4 shrink-0">
          <Link
            href={getPreservedHref("/")}
            className="flex items-center space-x-2 group focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
          >
            <Image
              src="/quiver-app-icon-128.png"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 rounded-md shadow-sm"
              aria-hidden="true"
            />
            <div className="text-xl font-bold text-[#F78E42] transition-colors duration-300 group-hover:text-[#FFAA63]">
              Quiver
            </div>
          </Link>

          {/* Desktop Navigation - Only show on desktop (≥1024px) */}
          {navItems.length > 0 && (
            <nav className="hidden lg:flex items-center space-x-8 ml-8">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={getPreservedHref(item.href)}
                  className={cn(
                    "text-sm font-medium transition-colors duration-200 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded px-1",
                    isActiveRoute(item.href)
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          )}
        </div>

        {/* Center: Desktop Search Bar - Hidden on mobile */}
        {user && (
          <form
            onSubmit={handleSearch}
            className="hidden md:flex flex-1 max-w-[600px] mx-8"
          >
            <div className="relative w-full rounded-full border border-transparent bg-muted focus-within:bg-background focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-[background-color,border-color,box-shadow] duration-200">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
                aria-hidden="true"
                data-testid="search-icon-desktop"
              />
              <Input
                type="search"
                placeholder="Search beaches, spots, or sessions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-full border-transparent bg-transparent focus:outline-none focus:ring-0 focus:border-transparent"
                aria-label="Search Quiver"
                data-testid="header-search-input"
              />
            </div>
          </form>
        )}

        {/* Right Side Actions - Positioned at screen edge with small padding */}
        <div className="ml-auto flex items-center space-x-2 pr-2 md:pr-3">
          {/* Mobile Search Icon - Hidden on desktop */}
          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMobileSearch}
              className="md:hidden h-8 w-8 p-0"
              aria-label="Search"
              data-testid="mobile-search-button"
            >
              <Search className="h-5 w-5" data-testid="search-icon-mobile" />
            </Button>
          )}

          {/* Mobile Hamburger Menu - All Users, Hidden on Desktop */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <button
                className="lg:hidden p-2 rounded-md hover:bg-muted transition-colors focus-ring"
                aria-label="Open navigation menu"
                aria-expanded={mobileMenuOpen}
                data-testid="mobile-menu-button"
              >
                <Menu className="h-6 w-6 text-foreground/70 hover:text-foreground" />
              </button>
            </SheetTrigger>

            <SheetContent
              side="right"
              className="w-[320px] sm:w-[320px] flex flex-col"
            >
              {user ? (
                // Authenticated user menu
                <>
                  <SheetHeader className="pb-0">
                    <SheetTitle>Navigation</SheetTitle>
                  </SheetHeader>

                  {/* User Info */}
                  <div className="py-6 border-b border-border bg-muted/30 -mx-6 px-6">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        src={profile?.avatar_url}
                        name={profile?.full_name}
                        email={user?.email}
                        size="lg"
                      />
                      <div className="flex flex-col gap-1">
                        <p className="text-base font-semibold">
                          {profile?.full_name || "Surfer"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {user?.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Primary Navigation */}
                  <nav className="flex-1 py-4 flex flex-col gap-1">
                    {mobileNavItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 h-12 px-4 rounded-md text-base font-medium transition-colors duration-200",
                          isActiveRoute(item.href)
                            ? "bg-primary/10 text-primary font-semibold border-l-4 border-primary"
                            : "text-foreground/80 hover:bg-muted hover:text-foreground",
                        )}
                        onClick={() => setMobileMenuOpen(false)}
                        data-testid={`mobile-nav-${item.name.toLowerCase()}`}
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.name}</span>
                      </Link>
                    ))}
                  </nav>

                  {/* Log Out */}
                  <div className="border-t border-border" />
                  <div className="py-4">
                    <button
                      onClick={async () => {
                        setMobileMenuOpen(false);
                        await signOut();
                        router.push("/");
                      }}
                      className="flex items-center gap-3 w-full h-12 px-4 rounded-md text-base font-medium text-destructive hover:bg-destructive/10 transition-colors focus-ring"
                      data-testid="mobile-nav-logout"
                    >
                      <LogOut className="h-5 w-5" />
                      <span>Log out</span>
                    </button>
                  </div>
                </>
              ) : (
                // Guest user menu
                <>
                  <SheetHeader className="pb-0">
                    <SheetTitle>Menu</SheetTitle>
                  </SheetHeader>

                  {/* Guest Navigation */}
                  <nav className="flex-1 py-4 flex flex-col gap-1">
                    <Link
                      href="/"
                      className={cn(
                        "flex items-center gap-3 h-12 px-4 rounded-md text-base font-medium transition-colors duration-200",
                        pathname === "/"
                          ? "bg-primary/10 text-primary font-semibold border-l-4 border-primary"
                          : "text-foreground/80 hover:bg-muted hover:text-foreground",
                      )}
                      onClick={() => setMobileMenuOpen(false)}
                      data-testid="mobile-nav-home"
                    >
                      <Home className="h-5 w-5" />
                      <span>Home</span>
                    </Link>
                    <Link
                      href="/map"
                      className={cn(
                        "flex items-center gap-3 h-12 px-4 rounded-md text-base font-medium transition-colors duration-200",
                        pathname.startsWith("/map")
                          ? "bg-primary/10 text-primary font-semibold border-l-4 border-primary"
                          : "text-foreground/80 hover:bg-muted hover:text-foreground",
                      )}
                      onClick={() => setMobileMenuOpen(false)}
                      data-testid="mobile-nav-map"
                    >
                      <Map className="h-5 w-5" />
                      <span>Map</span>
                    </Link>
                    <Link
                      href="/discover"
                      className={cn(
                        "flex items-center gap-3 h-12 px-4 rounded-md text-base font-medium transition-colors duration-200",
                        pathname.startsWith("/discover")
                          ? "bg-primary/10 text-primary font-semibold border-l-4 border-primary"
                          : "text-foreground/80 hover:bg-muted hover:text-foreground",
                      )}
                      onClick={() => setMobileMenuOpen(false)}
                      data-testid="mobile-nav-discover"
                    >
                      <Users className="h-5 w-5" />
                      <span>Discover</span>
                    </Link>
                  </nav>

                  {/* Auth Buttons */}
                  <div className="border-t border-border" />
                  <div className="py-4 flex flex-col gap-3">
                    <Button
                      variant="ghost"
                      size="lg"
                      className="w-full justify-start h-12 px-4 text-base font-medium"
                      onClick={() => {
                        trackSigninCtaClick({
                          source: "app-header-mobile",
                        });
                        setMobileMenuOpen(false);
                        setAuthMode("login");
                        setAuthModalOpen(true);
                      }}
                      data-testid="mobile-nav-login"
                    >
                      Log in
                    </Button>
                    {!isRedeemPage && (
                      <Button
                        size="lg"
                        className="w-full h-12 text-base font-semibold"
                        onClick={() => {
                          trackSignupCtaClick({
                            source: "app-header-mobile",
                          });
                          setMobileMenuOpen(false);
                          setAuthMode("signup");
                          setAuthModalOpen(true);
                        }}
                        data-testid="mobile-nav-signup"
                      >
                        {getSignupCta(pathname)}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>

          {/* Auth Section - Far Right */}
          {!hasMounted || authLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full border-2 border-transparent hover:border-primary hover:ring-3 hover:ring-primary/10 transition-[border-color,box-shadow] duration-200"
                  data-testid="user-avatar-button"
                  aria-label="User menu"
                >
                  <UserAvatar
                    src={profile?.avatar_url}
                    name={profile?.full_name}
                    email={user?.email}
                    size="sm"
                    isLoading={profileLoading}
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {profile?.full_name || "Surfer"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  onSelect={() => {
                    router.push("/profile");
                  }}
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onSelect={() => {
                    router.push("/alerts");
                  }}
                >
                  <Waves className="mr-2 h-4 w-4" />
                  <span>Alerts</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-red-600 focus:text-red-600"
                  onSelect={async () => {
                    try {
                      await signOut();
                      router.push("/");
                    } catch (error) {
                      console.error("Logout error:", error);
                    }
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden lg:inline-flex focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  onClick={() => {
                    trackSigninCtaClick({
                      source: "app-header",
                    });
                    setAuthMode("login");
                    setAuthModalOpen(true);
                  }}
                >
                  Log in
                </Button>
                {!isRedeemPage && (
                  <Button
                    size="sm"
                    className="rounded-full bg-[#F78E42] px-3 text-[#11100D] shadow-sm transition-[background-color,box-shadow,transform] duration-200 hover:bg-[#FFAA63] hover:shadow-md active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 lg:px-5 h-10 font-semibold"
                    onClick={() => {
                      const headerSource = `app-header-${isBeachContextPath(pathname) ? "beach" : pathname.startsWith("/forecast") ? "forecast" : "general"}`;
                      trackSignupCtaClick({
                        source: headerSource,
                      });
                      setAuthMode("signup");
                      setAuthModalOpen(true);
                    }}
                  >
                    <span className="lg:hidden">Sign Up</span>
                    <span className="hidden lg:inline">
                      {getSignupCta(pathname)}
                    </span>
                  </Button>
                )}
              </div>

              <UnifiedAuthModal
                isOpen={authModalOpen}
                onClose={() => setAuthModalOpen(false)}
                mode={authMode}
                source="app-header"
                returnTo={pathname}
                contextMessage={
                  authMode === "signup" ? getSignupContext(pathname) : undefined
                }
              />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
