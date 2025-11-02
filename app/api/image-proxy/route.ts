import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering - this route uses request.url
export const dynamic = 'force-dynamic';

/**
 * Image Proxy API Route
 *
 * Proxies external images (Openverse, Flickr, etc.) to enable Next.js Image Optimization.
 * This solves CORS issues and allows Next.js to optimize, resize, and serve images in modern formats (WebP, AVIF).
 *
 * Usage: /api/image-proxy?url=<encoded_image_url>
 *
 * Performance benefits:
 * - Enables automatic WebP/AVIF conversion
 * - Allows responsive image sizing
 * - Provides caching headers
 * - Reduces bandwidth usage
 */

const ALLOWED_DOMAINS = [
  "api.openverse.org",
  "upload.wikimedia.org",
  "live.staticflickr.com",
  "i0.wp.com",
  "i1.wp.com",
  "i2.wp.com",
  "files.wordpress.com",
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get("url");

    if (!imageUrl) {
      return new NextResponse("Missing url parameter", { status: 400 });
    }

    // Validate the URL is from an allowed domain
    const url = new URL(imageUrl);
    const isAllowed = ALLOWED_DOMAINS.some((domain) =>
      url.hostname.endsWith(domain)
    );

    if (!isAllowed) {
      return new NextResponse("Domain not allowed", { status: 403 });
    }

    // Fetch the image
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "QuiverApp/1.0",
      },
      // Cache for 7 days
      next: { revalidate: 604800 },
    });

    if (!response.ok) {
      return new NextResponse(`Failed to fetch image: ${response.statusText}`, {
        status: response.status,
      });
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";

    // Return the image with appropriate caching headers
    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, immutable", // 7 days
        "CDN-Cache-Control": "public, max-age=2592000", // 30 days for CDN
      },
    });
  } catch (error) {
    console.error("Image proxy error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
