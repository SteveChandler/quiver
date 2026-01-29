"use client";

import { useCallback, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth } from "@/context/auth-context";
import {
  Loader2,
  User,
  LogOut,
  Bell,
  Search,
  Menu,
  Home,
  Map,
  Users,
  CalendarDays,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { preserveQueryParams } from "@/lib/utils/navigation-utils";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

import { useUserProfile } from "@/hooks/use-user-profile";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { Badge } from "@/components/ui/badge";
import { useSessionInvitationsSubscription } from "@/hooks/use-session-invitations-subscription";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { trackAuthModalOpened } from "@/lib/analytics/auth-events";
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

/** Shape of invitation data from the API */
interface Invitation {
  status: string;
  seen_at: string | null;
}

export function AppHeader() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  // IMPORTANT: All hooks MUST be called before any conditional returns
  // This ensures the same hooks are called in the same order on every render

  // Use shared profile loading hook
  const { profile, loading: profileLoading } = useUserProfile({
    userId: user?.id,
    enabled: !!user,
  });

  // Unread notification count (pending invitations)
  const fetchNotificationsCount = useCallback(async () => {
    if (!user) return 0;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(
        "/api/session-planner/invitations?type=received",
        {
          cache: "no-store",
          signal: controller.signal,
        }
      );
      if (!res.ok) return 0;
      const json = await res.json();
      const invitations: Invitation[] = json?.data?.invitations || [];
      return invitations.filter(
        (i) => i.status === "pending" && (!i.seen_at || i.seen_at === null)
      ).length;
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Notification fetch failed:", e);
      }
      return 0;
    } finally {
      clearTimeout(timeout);
    }
  }, [user]);

  const { data: unreadCountData, refetch: refetchUnreadCount } =
    useDataFetcher<number>(fetchNotificationsCount);
  const unreadCount = unreadCountData ?? 0;

  // Use shared subscription hook to avoid duplicate subscriptions
  // This replaces the inline subscription logic that was duplicating inbox page subscriptions
  useSessionInvitationsSubscription(user?.id, user?.email, refetchUnreadCount);

  // Search state for header search bar
  const [searchQuery, setSearchQuery] = useState("");

  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auth modal state for unauthenticated users
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

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
    [searchQuery, router, searchParams]
  );

  // Handle mobile search icon click
  const handleMobileSearch = useCallback(() => {
    router.push("/map");
  }, [router]);

  // Don't render header on landing page for unauthenticated users
  // Landing page has its own Navbar component
  // IMPORTANT: This conditional return MUST come AFTER all hooks are called
  if (!user && pathname === "/") {
    return null;
  }

  // Check if user is admin (client-side check for UI only - server-side check in middleware)
  const isUserAdmin = profile?.is_admin === true;

  // Navigation items - different for authenticated vs unauthenticated users
  const navItems: { name: string; href: string }[] = user
    ? [
        { name: "Discover", href: "/map" },
        { name: "Sessions", href: "/profile?tab=sessions" },
        { name: "Community", href: "/?tab=community" },
        ...(isUserAdmin ? [{ name: "Admin", href: "/admin" }] : []),
      ]
    : [
        { name: "Features", href: "/features" },
        { name: "About", href: "/about" },
      ];

  // Mobile navigation items for hamburger menu
  const mobileNavItems = [
    { name: "Home", href: "/", icon: Home },
    { name: "Map", href: "/map", icon: Map },
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
            <div className="text-xl font-bold text-primary transition-colors duration-300 hover:text-primary/90">
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
                      : "text-muted-foreground"
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
            <div className="relative w-full rounded-full border border-transparent bg-muted focus-within:bg-background focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all duration-200">
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

          {/* Notification Bell - Authenticated Users Only */}
          {user && (
            <Link href="/inbox" className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="relative h-8 w-8 p-0 rounded-full hover:bg-muted transition-colors duration-200"
                aria-label={
                  unreadCount > 0
                    ? `Notifications, ${unreadCount} unread`
                    : "Notifications"
                }
                data-testid="notification-bell-button"
              >
                <Bell
                  className="h-5 w-5 text-foreground/70 hover:text-foreground transition-colors"
                  data-testid="notification-bell-icon"
                />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs font-semibold border-2 border-background"
                    data-testid="notification-badge"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Badge>
                )}
              </Button>
            </Link>
          )}

          {/* Mobile Hamburger Menu - All Users, Hidden on Desktop */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <button
                className="lg:hidden p-2 rounded-md hover:bg-muted transition-colors"
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
                          "flex items-center gap-3 h-12 px-4 rounded-md text-base font-medium transition-all duration-200",
                          isActiveRoute(item.href)
                            ? "bg-primary/10 text-primary font-semibold border-l-4 border-primary"
                            : "text-foreground/80 hover:bg-muted hover:text-foreground"
                        )}
                        onClick={() => setMobileMenuOpen(false)}
                        data-testid={`mobile-nav-${item.name.toLowerCase()}`}
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.name}</span>
                      </Link>
                    ))}
                  </nav>

                  {/* Quick Actions */}
                  <div className="border-t border-border" />
                  <div className="py-4 flex flex-col gap-1">
                    <Link
                      href="/inbox"
                      className="flex items-center gap-3 h-12 px-4 rounded-md text-base font-medium text-foreground/80 hover:bg-muted transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                      data-testid="mobile-nav-notifications"
                    >
                      <Bell className="h-5 w-5" />
                      <span>Notifications</span>
                      {unreadCount > 0 && (
                        <Badge
                          variant="destructive"
                          className="ml-auto h-5 min-w-5"
                        >
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </Badge>
                      )}
                    </Link>
                  </div>

                  {/* Log Out */}
                  <div className="border-t border-border" />
                  <div className="py-4">
                    <button
                      onClick={async () => {
                        setMobileMenuOpen(false);
                        await signOut();
                        router.push("/");
                      }}
                      className="flex items-center gap-3 w-full h-12 px-4 rounded-md text-base font-medium text-destructive hover:bg-destructive/10 transition-colors"
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
                        "flex items-center gap-3 h-12 px-4 rounded-md text-base font-medium transition-all duration-200",
                        pathname === "/"
                          ? "bg-primary/10 text-primary font-semibold border-l-4 border-primary"
                          : "text-foreground/80 hover:bg-muted hover:text-foreground"
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
                        "flex items-center gap-3 h-12 px-4 rounded-md text-base font-medium transition-all duration-200",
                        pathname.startsWith("/map")
                          ? "bg-primary/10 text-primary font-semibold border-l-4 border-primary"
                          : "text-foreground/80 hover:bg-muted hover:text-foreground"
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
                        "flex items-center gap-3 h-12 px-4 rounded-md text-base font-medium transition-all duration-200",
                        pathname.startsWith("/discover")
                          ? "bg-primary/10 text-primary font-semibold border-l-4 border-primary"
                          : "text-foreground/80 hover:bg-muted hover:text-foreground"
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
                        setMobileMenuOpen(false);
                        setAuthMode("login");
                        setAuthModalOpen(true);
                        trackAuthModalOpened({
                          mode: "login",
                          source: "app-header-mobile",
                        });
                      }}
                      data-testid="mobile-nav-login"
                    >
                      Log in
                    </Button>
                    <Button
                      size="lg"
                      className="w-full h-12 text-base font-semibold"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setAuthMode("signup");
                        setAuthModalOpen(true);
                        trackAuthModalOpened({
                          mode: "signup",
                          source: "app-header-mobile",
                        });
                      }}
                      data-testid="mobile-nav-signup"
                    >
                      Sign Up
                    </Button>
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>

          {/* Auth Section - Far Right */}
          {authLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full border-2 border-transparent hover:border-primary hover:ring-3 hover:ring-primary/10 transition-all duration-200"
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
                  className="focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthModalOpen(true);
                    trackAuthModalOpened({
                      mode: "login",
                      source: "app-header",
                    });
                  }}
                >
                  Log in
                </Button>
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-5 h-10 font-semibold shadow-sm transition-all duration-200 active:scale-98 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  onClick={() => {
                    setAuthMode("signup");
                    setAuthModalOpen(true);
                    trackAuthModalOpened({
                      mode: "signup",
                      source: "app-header",
                    });
                  }}
                >
                  Sign Up
                </Button>
              </div>

              <UnifiedAuthModal
                isOpen={authModalOpen}
                onClose={() => setAuthModalOpen(false)}
                mode={authMode}
                source="app-header"
                returnTo={pathname}
              />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
