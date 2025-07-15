"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth } from "@/context/auth-context";
import { Menu, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useUserProfile } from "@/hooks/use-user-profile";

export function AppHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const pathname = usePathname();

  // Use shared profile loading hook
  const { profile, loading: profileLoading } = useUserProfile({
    userId: user?.id,
    enabled: !!user,
  });

  const navItems: { name: string; href: string; icon: null }[] = [];

  const isActiveRoute = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href.startsWith("/#"))
      return pathname === "/" && href.includes("forecast");
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between pl-4 pr-2">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <Image
            src="/logo-word (2).png"
            alt="Quiver"
            width={120}
            height={32}
            className="h-8 w-auto"
            priority
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
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

        {/* Right Side Actions */}
        <div className="flex items-center space-x-2">
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
            <Link href="/profile">
              <UserAvatar
                src={profile?.avatar_url}
                name={profile?.full_name}
                email={user?.email}
                size="sm"
                isLoading={profileLoading}
              />
            </Link>
          ) : (
            <Link href="/auth/sign-up">
              <Button size="sm">Sign Up</Button>
            </Link>
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
                href={item.href}
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

            {/* Mobile Auth Button */}
            {!user && (
              <Link
                href="/auth/sign-up"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Button size="sm" className="w-full">
                  Sign Up
                </Button>
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
