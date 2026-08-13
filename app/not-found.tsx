import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "The page you're looking for doesn't exist.",
  robots: {
    index: false,
    follow: true,
    googleBot: {
      index: false,
      follow: true,
    },
  },
  // No canonical - don't canonicalize 404 URLs
};

export default function NotFound() {
  return (
    <div className="noise-texture min-h-screen bg-[#252D6B] flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <h1 className="font-heading text-4xl font-bold text-white mb-4">
          Caught inside.
        </h1>
        <p className="text-white/70 mb-8 text-base">
          This page got worked. Let&apos;s paddle back out.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#F78E42] text-[#11100D] font-semibold rounded-lg hover:bg-[#F78E42]/90 transition-colors"
        >
          Back to the lineup
        </Link>
      </div>
    </div>
  );
}
