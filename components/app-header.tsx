"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth } from "@/context/auth-context";
import { Menu, X, Loader2, User, LogOut, Bell } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { preserveQueryParams } from "@/lib/utils/navigation-utils";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

import { useUserProfile } from "@/hooks/use-user-profile";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { Badge } from "@/components/ui/badge";
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, isLoading: authLoading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Use shared profile loading hook
  const { profile, loading: profileLoading } = useUserProfile({
    userId: user?.id,
    enabled: !!user,
  });

  // Notifications are accessible via avatar dropdown → Notifications (/inbox)

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

  const {
    data: unreadCount = 0,
    refetch: refetchUnreadCount,
  } = useDataFetcher<number>(fetchNotificationsCount);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!user?.id && !user?.email) {
      return;
    }

    const channels: RealtimeChannel[] = [];

    if (user?.id) {
      const userChannel = supabase
        .channel(`session_invitations_invitee_${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "session_invitations",
            filter: `invitee_id=eq.${user.id}`,
          },
          () => {
            refetchUnreadCount();
          }
        )
        .subscribe();
      channels.push(userChannel);
    }

    const emailValue = user?.email;
    if (emailValue) {
      const encoded = encodeURIComponent(emailValue);
      const emailChannel = supabase
        .channel(`session_invitations_invitee_email_${encoded}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "session_invitations",
            filter: `invitee_email=eq.${emailValue}`,
          },
          () => {
            refetchUnreadCount();
          }
        )
        .subscribe();
      channels.push(emailChannel);
    }

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [supabase, user?.id, user?.email, refetchUnreadCount]);

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

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center w-full">
        {/* Left side with logo - uses container padding */}
        <div className="container flex items-center pl-4">
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
        <div className="flex items-center space-x-2 ml-auto pr-3">
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>

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

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t bg-background">
          <nav className="container px-4 py-4 space-y-4">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={getPreservedHref(item.href)}
                className={cn(
                  "block text-sm font-medium transition-colors hover:text-primary",
                  isActiveRoute(item.href)
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}

            {/* Mobile Auth Buttons */}
            {!user && (
              <div className="space-y-2 pt-2 border-t">
                <Link
                  href={getPreservedHref("/auth/sign-in")}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Button variant="outline" size="sm" className="w-full">
                    Sign In
                  </Button>
                </Link>
                <Link
                  href={getPreservedHref("/auth/sign-up")}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Button
                    size="sm"
                    className="w-full bg-ocean-blue hover:bg-ocean-blue/90"
                  >
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
