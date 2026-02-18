import Link from "next/link";
import { FOOTER_LINKS } from "@/lib/constants/footer-links";

/**
 * SiteFooter - Compact server component rendered on all public content pages.
 *
 * Zero JS bundle impact (server component). Provides ~14 crawlable internal
 * links on every page for SEO internal linking and user navigation.
 *
 * Rendered conditionally in root layout — hidden on landing page (has own
 * footer), auth pages, and authenticated app pages.
 */
export function SiteFooter() {
  return (
    <footer className="bg-dark-grey text-white py-10 px-4 mt-12">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* About */}
          <div>
            <h4 className="font-roboto font-semibold mb-3 text-sm uppercase tracking-wide text-gray-400">
              About
            </h4>
            <ul className="space-y-2 text-sm text-gray-300">
              {FOOTER_LINKS.about.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Browse Beaches */}
          <div>
            <h4 className="font-roboto font-semibold mb-3 text-sm uppercase tracking-wide text-gray-400">
              Browse Beaches
            </h4>
            <ul className="space-y-2 text-sm text-gray-300">
              {FOOTER_LINKS.beaches.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Surf Guides */}
          <div>
            <h4 className="font-roboto font-semibold mb-3 text-sm uppercase tracking-wide text-gray-400">
              Surf Guides
            </h4>
            <ul className="space-y-2 text-sm text-gray-300">
              {FOOTER_LINKS.guides.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-roboto font-semibold mb-3 text-sm uppercase tracking-wide text-gray-400">
              Legal
            </h4>
            <ul className="space-y-2 text-sm text-gray-300">
              {FOOTER_LINKS.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-6 text-center">
          <p className="text-gray-400 text-xs">
            &copy; {new Date().getFullYear()} Quiver Surf. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
