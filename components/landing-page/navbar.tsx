"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { trackAuthModalOpened } from "@/lib/analytics/auth-events";

const EXPLORE_MENU_ITEMS = [
  { label: "San Diego County", href: "/map", category: "Regions" },
  { label: "Orange County", href: "/map", category: "Regions" },
  { label: "Los Angeles County", href: "/map", category: "Regions" },
  {
    label: "Reef Breaks",
    href: "/discover?type=reef",
    category: "Surf Spot Types",
  },
  {
    label: "Point Breaks",
    href: "/discover?type=point",
    category: "Surf Spot Types",
  },
  {
    label: "Beach Breaks",
    href: "/discover?type=beach",
    category: "Surf Spot Types",
  },
  {
    label: "Beginner-Friendly",
    href: "/discover?level=beginner",
    category: "Surf Spot Types",
  },
  {
    label: "Offshore Winds",
    href: "/discover?conditions=offshore",
    category: "Conditions",
  },
  {
    label: "Best Swell Size",
    href: "/discover?conditions=swell",
    category: "Conditions",
  },
  {
    label: "Optimal Tide",
    href: "/discover?conditions=tide",
    category: "Conditions",
  },
];

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  const groupedMenuItems = EXPLORE_MENU_ITEMS.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof EXPLORE_MENU_ITEMS>);

  return (
    <nav className="absolute top-0 left-0 right-0 z-50 w-full bg-transparent backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <Image
                src="/logoQuiver.png"
                alt="Quiver Logo"
                width={32}
                height={32}
                className="transition-transform group-hover:scale-110"
              />
              <span className="text-2xl font-bold font-roboto text-white drop-shadow-lg">
                Quiver
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {/* Explore Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-white hover:text-white/80 transition-colors font-medium drop-shadow-lg">
                Explore
                <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 p-4">
                {Object.entries(groupedMenuItems).map(([category, items]) => (
                  <div key={category} className="mb-4 last:mb-0">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      {category}
                    </div>
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

            {/* Other Nav Links */}
            <Link
              href="/discover"
              className="text-white hover:text-white/80 transition-colors font-medium drop-shadow-lg"
            >
              Discover
            </Link>

            {/* Auth Buttons */}
            <div className="flex items-center gap-3 ml-2">
              <Button
                variant="outline"
                className="text-white border-white hover:bg-transparent hover:bg-white/10 hover:text-white font-medium rounded-full px-6 bg-transparent"
                onClick={() => {
                  setAuthMode("login");
                  setAuthModalOpen(true);
                  trackAuthModalOpened({ mode: "login", source: "landing-navbar" });
                }}
              >
                Log in
              </Button>
              <Button
                className="bg-ocean-blue hover:bg-ocean-blue/90 text-white font-medium rounded-full px-6"
                onClick={() => {
                  setAuthMode("signup");
                  setAuthModalOpen(true);
                  trackAuthModalOpened({ mode: "signup", source: "landing-navbar" });
                }}
              >
                Sign Up
              </Button>
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10"
                >
                  {mobileMenuOpen ? (
                    <X className="h-6 w-6" />
                  ) : (
                    <Menu className="h-6 w-6" />
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <div className="flex flex-col gap-6 mt-8">
                  {/* Mobile Explore Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Explore
                    </h3>
                    {Object.entries(groupedMenuItems).map(
                      ([category, items]) => (
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
                      )
                    )}
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

                  {/* Mobile Auth Buttons */}
                  <div className="border-t pt-4 flex flex-col gap-3">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setAuthMode("login");
                        setAuthModalOpen(true);
                        trackAuthModalOpened({ mode: "login", source: "landing-navbar-mobile" });
                      }}
                    >
                      Log in
                    </Button>
                    <Button
                      className="w-full bg-ocean-blue hover:bg-ocean-blue/90 text-white"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setAuthMode("signup");
                        setAuthModalOpen(true);
                        trackAuthModalOpened({ mode: "signup", source: "landing-navbar-mobile" });
                      }}
                    >
                      Sign Up
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode={authMode}
        source="landing-navbar"
      />
    </nav>
  );
}
