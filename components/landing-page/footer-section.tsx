"use client";

import { Instagram, Play } from "lucide-react";

const FOOTER_LINKS = {
  product: [
    { name: "Features", href: "#" },
    { name: "Pricing", href: "#" },
    { name: "FAQ", href: "#" },
  ],
  company: [
    { name: "About", href: "#" },
    { name: "Contact", href: "#" },
    { name: "Privacy", href: "#" },
  ],
} as const;

export function FooterSection() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-dark-grey text-white py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-2xl font-roboto font-bold mb-4">Quiver</h3>
            <p className="font-open-sans text-gray-300 mb-4 max-w-md">
              The ultimate social platform for surfers. Connect with your
              community, plan sessions, and share the stoke.
            </p>
            <div className="flex space-x-4">
              <a
                href="#"
                className="text-gray-300 hover:text-white transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="h-6 w-6" />
              </a>
              <a
                href="#"
                className="text-gray-300 hover:text-white transition-colors"
                aria-label="TikTok"
              >
                <Play className="h-6 w-6" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-roboto font-semibold mb-4">Product</h4>
            <ul className="space-y-2 font-open-sans text-gray-300">
              {FOOTER_LINKS.product.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="hover:text-white transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-roboto font-semibold mb-4">Company</h4>
            <ul className="space-y-2 font-open-sans text-gray-300">
              {FOOTER_LINKS.company.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="hover:text-white transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-600 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="font-open-sans text-gray-300 text-sm">
              © {currentYear} Quiver. All rights reserved.
            </p>
            <div className="mt-4 md:mt-0">
              <p className="font-open-sans text-gray-300 text-sm">
                App coming soon to iOS & Android
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
