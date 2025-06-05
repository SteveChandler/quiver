/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "staticmap.openstreetmap.de",
        pathname: "/staticmap.php",
      },
      {
        protocol: "https",
        hostname: "api.mapbox.com",
      },
      {
        protocol: "https",
        hostname: "maps.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "maps.geoapify.com",
      },
    ],
    // Add image loading configuration for better Vercel compatibility
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Allow unoptimized images for map services that have issues with Vercel
    unoptimized: process.env.NODE_ENV === "production",
  },
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
