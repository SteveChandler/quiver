import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/middleware/api-wrappers";
import { validateURL } from "@/lib/security/ip-validation";

// Force dynamic rendering - this route uses request.url
export const dynamic = 'force-dynamic';

/**
 * Image Proxy API Route
 *
 * Proxies external images (Openverse, Flickr, etc.) to enable Next.js Image Optimization.
 * This solves CORS issues and allows Next.js to optimize, resize, and serve images in modern formats (WebP, AVIF).
 *
 * Security Hardening (SSRF Prevention):
 * - Rate limited (10 req/min, 100 req/hour) to prevent abuse
 * - Domain whitelist with exact matching (prevents subdomain bypass)
 * - DNS resolution validation (prevents DNS rebinding attacks)
 * - Private IP blocking (prevents AWS metadata/internal network access)
 * - Response size limit (10MB max, prevents memory exhaustion)
 * - Request timeout (10 seconds, prevents slowloris attacks)
 * - Protocol validation (http/https only)
 *
 * Attack Vectors Prevented:
 * - Subdomain bypass: evil.api.openverse.org ❌
 * - AWS metadata: http://169.254.169.254/latest/meta-data/ ❌
 * - Internal networks: http://192.168.1.1 ❌
 * - DNS rebinding: public DNS -> private IP ❌
 * - Memory exhaustion: unlimited response size ❌
 * - Slowloris: hanging connections ❌
 *
 * Usage: /api/image-proxy?url=<encoded_image_url>
 *
 * Performance benefits:
 * - Enables automatic WebP/AVIF conversion
 * - Allows responsive image sizing
 * - Provides caching headers
 * - Reduces bandwidth usage
 */

/**
 * Base allowed domains for production
 *
 * Only images from these exact domains (or their legitimate subdomains) are allowed.
 * Prevents SSRF attacks by restricting proxy to trusted sources.
 */
const BASE_ALLOWED_DOMAINS = [
  "api.openverse.org",
  "upload.wikimedia.org",
  "thumb.wikimedia.org",
  "live.staticflickr.com",
  "i0.wp.com",
  "i1.wp.com",
  "i2.wp.com",
  "files.wordpress.com",
];

/**
 * Additional domains allowed only in development/test environments
 *
 * placehold.co: Used by E2E tests for placeholder images
 *
 * Note: These domains are NOT allowed in production to maintain security.
 * Consider migrating to local test assets (/public/test-images/) in the future.
 */
const DEV_TEST_ALLOWED_DOMAINS = ["placehold.co"];

/**
 * Allowed image source domains (environment-aware)
 *
 * In production: Only BASE_ALLOWED_DOMAINS
 * In dev/test: BASE_ALLOWED_DOMAINS + DEV_TEST_ALLOWED_DOMAINS
 */
const ALLOWED_DOMAINS =
  process.env.NODE_ENV === "production"
    ? BASE_ALLOWED_DOMAINS
    : [...BASE_ALLOWED_DOMAINS, ...DEV_TEST_ALLOWED_DOMAINS];

/**
 * Maximum allowed response size: 10MB
 *
 * Prevents memory exhaustion attacks where an attacker requests
 * extremely large files to consume server memory and cause DoS.
 */
const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

/**
 * Request timeout: 10 seconds
 *
 * Prevents slowloris-style attacks where an attacker sends data
 * very slowly to keep connections open and exhaust server resources.
 */
const REQUEST_TIMEOUT = 10000; // 10 seconds in milliseconds

async function imageProxyHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get("url");

    if (!imageUrl) {
      return new NextResponse("Missing url parameter", { status: 400 });
    }

    // ============================================================================
    // SECURITY VALIDATION: Comprehensive SSRF Prevention
    // ============================================================================

    // Validate URL against whitelist, DNS resolution, and private IP ranges
    // This prevents:
    // - Subdomain bypass attacks (evil.api.openverse.org)
    // - DNS rebinding attacks (public DNS -> private IP)
    // - AWS metadata access (169.254.169.254)
    // - Internal network scanning (192.168.x.x, 10.x.x.x, 172.16.x.x)
    // - Localhost access (127.x.x.x)
    const validation = await validateURL(imageUrl, ALLOWED_DOMAINS);

    if (!validation.isValid) {
      console.warn('Image proxy: URL validation failed', {
        url: imageUrl,
        reason: validation.reason,
      });
      return new NextResponse(`URL validation failed: ${validation.reason}`, {
        status: 403,
      });
    }

    // ============================================================================
    // FETCH WITH SECURITY CONTROLS
    // ============================================================================

    // Create AbortController for timeout protection
    // Prevents slowloris attacks where connections are kept open indefinitely
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      // Fetch the image with security headers and timeout
      const response = await fetch(imageUrl, {
        headers: {
          "User-Agent": "QuiverApp/1.0",
        },
        signal: controller.signal,
        // Cache for 7 days
        next: { revalidate: 604800 },
      });

      // Clear timeout on successful response
      clearTimeout(timeoutId);

      if (!response.ok) {
        return new NextResponse(`Failed to fetch image: ${response.statusText}`, {
          status: response.status,
        });
      }

      // ============================================================================
      // RESPONSE SIZE VALIDATION
      // ============================================================================

      // Check Content-Length header if available
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        const size = parseInt(contentLength, 10);
        if (size > MAX_RESPONSE_SIZE) {
          return new NextResponse(
            `Image too large: ${(size / 1024 / 1024).toFixed(2)}MB exceeds 10MB limit`,
            { status: 413 } // 413 Payload Too Large
          );
        }
      }

      // Get the image data with size validation
      // Even if Content-Length is missing, validate actual size
      const imageBuffer = await response.arrayBuffer();

      if (imageBuffer.byteLength > MAX_RESPONSE_SIZE) {
        return new NextResponse(
          `Image too large: ${(imageBuffer.byteLength / 1024 / 1024).toFixed(2)}MB exceeds 10MB limit`,
          { status: 413 } // 413 Payload Too Large
        );
      }

      const contentType = response.headers.get("content-type") || "image/jpeg";

      // Return the image with appropriate caching headers
      return new NextResponse(imageBuffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=604800, immutable", // 7 days
          "CDN-Cache-Control": "public, max-age=2592000", // 30 days for CDN
        },
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      // Handle timeout errors specifically
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return new NextResponse(
          'Request timeout: Image fetch took longer than 10 seconds',
          { status: 504 } // 504 Gateway Timeout
        );
      }

      throw fetchError; // Re-throw other errors to be caught by outer try/catch
    }
  } catch (error) {
    console.error("Image proxy error:", error);

    // Provide more specific error messages for debugging
    if (error instanceof Error) {
      return new NextResponse(`Internal server error: ${error.message}`, {
        status: 500,
      });
    }

    return new NextResponse("Internal server error", { status: 500 });
  }
}

// Apply rate limiting to prevent SSRF attacks
export const GET = withRateLimit(imageProxyHandler, "image-proxy");
