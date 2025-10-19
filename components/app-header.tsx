"use client";

import { useCallback, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth } from "@/context/auth-context";
import { Loader2, User, LogOut, Bell } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { preserveQueryParams } from "@/lib/utils/navigation-utils";
import { cn } from "@/lib/utils";

import { useUserProfile } from "@/hooks/use-user-profile";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { Badge } from "@/components/ui/badge";
import { useSessionInvitationsSubscription } from "@/hooks/use-session-invitations-subscription";
// no notifications bell; link in avatar menu instead
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
      const list: any[] = json?.data?.invitations || [];
      return list.filter(
        (i) => i.status === "pending" && (!i.seen_at || i.seen_at === null)
      ).length;
    } catch {
      return 0;
    } finally {
      clearTimeout(timeout);
    }
  }, [user]);

  const { data: unreadCount = 0, refetch: refetchUnreadCount } =
    useDataFetcher<number>(fetchNotificationsCount);

  // Use shared subscription hook to avoid duplicate subscriptions
  // This replaces the inline subscription logic that was duplicating inbox page subscriptions
  useSessionInvitationsSubscription(user?.id, user?.email, refetchUnreadCount);

  // Don't render header on landing page for unauthenticated users
  // Landing page has its own Navbar component
  // IMPORTANT: This conditional return MUST come AFTER all hooks are called
  if (!user && pathname === "/") {
    return null;
  }

  // Navigation items - different for authenticated vs unauthenticated users
  const navItems: { name: string; href: string; icon: null }[] = user
    ? [] // Authenticated users have bottom navigation
    : [
        { name: "Features", href: "/features", icon: null },
        { name: "About", href: "/about", icon: null },
      ];

  const isActiveRoute = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href.startsWith("/#"))
      return pathname === "/" && href.includes("forecast");
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
      className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-2 pt-[calc(var(--app-safe-area-top)+1.5rem)] md:py-0"
      style={safeAreaStyles}
    >
      <div
        className="flex w-full items-center md:h-16"
        style={{ minHeight: "calc(var(--app-safe-area-top) + 4rem)" }}
      >
        {/* Left side with logo - uses container padding */}
        <div className="container flex items-center pl-2 md:pl-4">
          <Link
            href={getPreservedHref("/")}
            className="flex items-center space-x-2"
          >
            <div className="text-xl font-bold text-primary">Quiver</div>
          </Link>

          {/* Desktop Navigation - Only show if navItems exist */}
          {navItems.length > 0 && (
            <nav className="hidden md:flex items-center space-x-8 ml-8">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={getPreservedHref(item.href)}
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-primary",
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

        {/* Right Side Actions - Positioned at screen edge with small padding */}
        <div className="ml-auto flex items-center space-x-2 pr-2 md:pr-3">
          {/* Auth Section - Far Right */}
          {authLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
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
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/inbox"
                    className="cursor-pointer flex items-center"
                  >
                    <Bell className="mr-2 h-4 w-4" />
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 px-2">
                        {unreadCount}
                      </Badge>
                    )}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-red-600 focus:text-red-600"
                  onClick={async () => {
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
            <div className="flex items-center space-x-2">
              <Link href={getPreservedHref("/auth/sign-in")}>
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href={getPreservedHref("/auth/sign-up")}>
                <Button
                  size="sm"
                  className="bg-ocean-blue hover:bg-ocean-blue/90"
                >
                  Sign Up
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
