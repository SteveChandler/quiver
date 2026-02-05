"use client";

import Link from "next/link";
import { Instagram, Play } from "lucide-react";

const FOOTER_LINKS = {
  about: [
    { name: "About Quiver", href: "/about" },
    { name: "Features", href: "/features" },
    { name: "How It Works", href: "/features" },
  ],
  beaches: [
    { name: "United States", href: "/beaches/usa" },
    { name: "Mexico", href: "/beaches/mexico" },
  ],
  guides: [
    { name: "7-Day Outlook", href: "/forecast" },
    { name: "Beginner Spots", href: "/beginner/ca" },
    { name: "Tide Charts", href: "/tide/san-diego" },
    { name: "Dawn Patrol", href: "/dawn-patrol/ca" },
    { name: "Sunset Sessions", href: "/sunset/ca" },
  ],
  support: [
    { name: "Help Center", href: "#" },
    { name: "Contact Us", href: "#" },
    { name: "Community Guidelines", href: "#" },
  ],
  legal: [
    { name: "Privacy Policy", href: "/privacy" },
    { name: "Terms of Service", href: "/terms" },
    { name: "Cookie Policy", href: "#" },
  ],
} as const;

/**
 * Render a footer link - uses Next.js Link for internal routes,
 * native anchor for placeholder (#) links
 */
function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const isInternalRoute = href.startsWith("/");

  if (isInternalRoute) {
    return (
      <Link href={href} className="hover:text-white transition-colors">
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className="hover:text-white transition-colors">
      {children}
    </a>
  );
}

export function FooterSection() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-dark-grey text-white py-12 md:py-16 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Main Footer Content */}
        <div className="grid grid-cols-2 md:grid-cols-7 gap-8 mb-10">
          {/* Brand Section */}
          <div className="md:col-span-2">
            <h3 className="text-3xl font-roboto font-bold mb-3">Quiver</h3>
            <p className="font-open-sans text-gray-300 mb-4 text-base italic">
              Built for surfers. Powered by the swell.
            </p>
            <p className="font-open-sans text-gray-400 mb-6 max-w-md leading-relaxed">
              Discover surf spots, connect with your community, and track your
              sessions. Join the movement that&apos;s bringing surfers together.
            </p>
            <div className="flex space-x-4">
              <a
                href="https://instagram.com/quiversurf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white transition-colors"
                aria-label="Follow us on Instagram"
              >
                <Instagram className="h-6 w-6" />
              </a>
              <a
                href="https://youtube.com/@quiversurf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white transition-colors"
                aria-label="Subscribe on YouTube"
              >
                <Play className="h-6 w-6" />
              </a>
            </div>
          </div>

          {/* About Quiver */}
          <div>
            <h4 className="font-roboto font-semibold mb-4 text-lg">
              About Quiver
            </h4>
            <ul className="space-y-2.5 font-open-sans text-gray-300 text-sm">
              {FOOTER_LINKS.about.map((link) => (
                <li key={link.name}>
                  <FooterLink href={link.href}>{link.name}</FooterLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Browse Beaches */}
          <div>
            <h4 className="font-roboto font-semibold mb-4 text-lg">
              Browse Beaches
            </h4>
            <ul className="space-y-2.5 font-open-sans text-gray-300 text-sm">
              {FOOTER_LINKS.beaches.map((link) => (
                <li key={link.name}>
                  <FooterLink href={link.href}>{link.name}</FooterLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Surf Guides */}
          <div>
            <h4 className="font-roboto font-semibold mb-4 text-lg">
              Surf Guides
            </h4>
            <ul className="space-y-2.5 font-open-sans text-gray-300 text-sm">
              {FOOTER_LINKS.guides.map((link) => (
                <li key={link.name}>
                  <FooterLink href={link.href}>{link.name}</FooterLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-roboto font-semibold mb-4 text-lg">
              Support / Contact
            </h4>
            <ul className="space-y-2.5 font-open-sans text-gray-300 text-sm">
              {FOOTER_LINKS.support.map((link) => (
                <li key={link.name}>
                  <FooterLink href={link.href}>{link.name}</FooterLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-roboto font-semibold mb-4 text-lg">Legal</h4>
            <ul className="space-y-2.5 font-open-sans text-gray-300 text-sm">
              {FOOTER_LINKS.legal.map((link) => (
                <li key={link.name}>
                  <FooterLink href={link.href}>{link.name}</FooterLink>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-700 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="font-open-sans text-gray-400 text-sm">
              © {currentYear} Quiver Surf. All rights reserved.
            </p>
            <p className="font-open-sans text-gray-400 text-sm">
              Made with 🌊 for the surf community
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
