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
 * links on every page for SEO internal linking and user navigation (5 columns).
 *
 * Rendered conditionally in root layout — hidden on auth pages and
 * authenticated app pages. The landing page uses this component with
 * `showBrandSection showSocialLinks` for its richer footer variant.
 *
 * Props:
 * - showBrandSection: Enables the rich brand column (Quiver heading, tagline,
 *   description). Switches to a 7-column grid with the brand spanning 2 cols.
 * - showSocialLinks: Adds Instagram and YouTube icon links inside the brand
 *   section. Has no effect when showBrandSection is false.
 */
export function SiteFooter({
  showBrandSection = false,
  showSocialLinks = false,
}: SiteFooterProps) {
  const currentYear = new Date().getFullYear();

  const headingClass = showBrandSection
    ? "font-heading font-semibold mb-4 text-lg"
    : "font-heading font-semibold mb-3 text-sm uppercase tracking-wide text-gray-400";

  const listClass = showBrandSection
    ? "space-y-2.5 font-sans text-gray-300 text-sm"
    : "space-y-2 text-sm text-gray-300";

  return (
    <footer
      className={`bg-dark-grey text-white ${showBrandSection ? "py-12 md:py-16" : "py-10"} px-4${showBrandSection ? "" : " mt-12"}`}
    >
      <div className="max-w-7xl mx-auto">
        <div
          className={`grid grid-cols-2 ${showBrandSection ? "md:grid-cols-7" : "md:grid-cols-5"} gap-8 ${showBrandSection ? "mb-10" : "mb-8"}`}
        >
          {showBrandSection && (
            <div className="md:col-span-2">
              <h3 className="text-3xl font-heading font-bold mb-3">Quiver</h3>
              <p className="font-sans text-gray-300 mb-4 text-base italic">
                Built for surfers. Powered by the swell.
              </p>
              <p className="font-sans text-gray-400 mb-6 max-w-md leading-relaxed">
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
                  <a
                    href="https://bsky.app/profile/quiversurf.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-300 hover:text-white transition-colors"
                    aria-label="Follow us on Bluesky"
                  >
                    <svg
                      className="h-6 w-6"
                      viewBox="0 0 568 501"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M123.121 33.664C188.241 82.553 258.281 181.68 284 234.873c25.719-53.192 95.759-152.32 160.879-201.21C491.866-1.611 568-28.906 568 57.947c0 17.346-9.945 145.713-15.778 166.555-20.275 72.453-94.155 90.933-159.875 79.748C507.222 323.8 536.444 388.56 473.333 453.32c-119.86 122.992-172.272-30.859-185.702-70.281-2.462-7.227-3.614-10.608-3.631-7.733-.017-2.875-1.169.506-3.631 7.733-13.43 39.422-65.842 193.273-185.702 70.281-63.111-64.76-33.889-129.52 80.986-149.071-65.72 11.185-139.6-7.295-159.875-79.748C10.945 203.659 1 75.291 1 57.946 1-28.906 76.135-1.612 123.121 33.664Z" />
                    </svg>
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

          {/* Forecasts */}
          <div>
            <h4 className={headingClass}>Forecasts</h4>
            <ul className={listClass}>
              {FOOTER_LINKS.forecasts.map((link) => (
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

          {/* Explore */}
          <div>
            <h4 className={headingClass}>Explore</h4>
            <ul className={listClass}>
              {FOOTER_LINKS.explore.map((link) => (
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
              <p className="font-sans text-gray-400 text-sm">
                &copy; {currentYear} Quiver Surf. All rights reserved.
              </p>
              <p className="font-sans text-gray-400 text-sm">
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
