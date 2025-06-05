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
    ],
  },
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
