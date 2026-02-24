import Link from "next/link";
import { Instagram, Play } from "lucide-react";
import { FOOTER_LINKS } from "@/lib/constants/footer-links";

interface SiteFooterProps {
  showBrandSection?: boolean;
  showSocialLinks?: boolean;
}

/**
 * SiteFooter - Compact server component rendered on all public content pages.
 *
 * Zero JS bundle impact (server component). Provides ~14 crawlable internal
 * links on every page for SEO internal linking and user navigation.
 *
 * Rendered conditionally in root layout — hidden on auth pages and
 * authenticated app pages. The landing page uses this component with
 * `showBrandSection showSocialLinks` for its richer footer variant.
 *
 * Props:
 * - showBrandSection: Enables the rich brand column (Quiver heading, tagline,
 *   description). Switches to a 6-column grid with the brand spanning 2 cols.
 * - showSocialLinks: Adds Instagram and YouTube icon links inside the brand
 *   section. Has no effect when showBrandSection is false.
 */
export function SiteFooter({
  showBrandSection = false,
  showSocialLinks = false,
}: SiteFooterProps) {
  const currentYear = new Date().getFullYear();

  const headingClass = showBrandSection
    ? "font-roboto font-semibold mb-4 text-lg"
    : "font-roboto font-semibold mb-3 text-sm uppercase tracking-wide text-gray-400";

  const listClass = showBrandSection
    ? "space-y-2.5 font-open-sans text-gray-300 text-sm"
    : "space-y-2 text-sm text-gray-300";

  return (
    <footer
      className={`bg-dark-grey text-white ${showBrandSection ? "py-12 md:py-16" : "py-10"} px-4${showBrandSection ? "" : " mt-12"}`}
    >
      <div className="max-w-7xl mx-auto">
        <div
          className={`grid grid-cols-2 ${showBrandSection ? "md:grid-cols-6" : "md:grid-cols-4"} gap-8 ${showBrandSection ? "mb-10" : "mb-8"}`}
        >
          {showBrandSection && (
            <div className="md:col-span-2">
              <h3 className="text-3xl font-roboto font-bold mb-3">Quiver</h3>
              <p className="font-open-sans text-gray-300 mb-4 text-base italic">
                Built for surfers. Powered by the swell.
              </p>
              <p className="font-open-sans text-gray-400 mb-6 max-w-md leading-relaxed">
                Discover surf spots, connect with your community, and track your
                sessions. Join the movement that&apos;s bringing surfers
                together.
              </p>
              {showSocialLinks && (
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
              )}
            </div>
          )}

          {/* About */}
          <div>
            <h4 className={headingClass}>
              {showBrandSection ? "About Quiver" : "About"}
            </h4>
            <ul className={listClass}>
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
            <h4 className={headingClass}>Browse Beaches</h4>
            <ul className={listClass}>
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
            <h4 className={headingClass}>Surf Guides</h4>
            <ul className={listClass}>
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
            <h4 className={headingClass}>Legal</h4>
            <ul className={listClass}>
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

        <div className={`border-t border-gray-700 ${showBrandSection ? "pt-8" : "pt-6"}`}>
          {showBrandSection ? (
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="font-open-sans text-gray-400 text-sm">
                &copy; {currentYear} Quiver Surf. All rights reserved.
              </p>
              <p className="font-open-sans text-gray-400 text-sm">
                Made with 🌊 for the surf community
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-gray-400 text-xs">
                &copy; {currentYear} Quiver Surf. All rights reserved.
              </p>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
