import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment (self-contained Node.js server)
  output: 'standalone',

  experimental: {
    // Tree-shake icon libraries — avoids importing all 1000+ icons on every compile
    optimizePackageImports: ['lucide-react'],
  },
  // Silence the "webpack config but no turbopack config" warning in Next.js 16+
  turbopack: {},
  images: {
    // Allow Next/Image to render .svg files from /public
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        // Cloudflare R2 public bucket
        protocol: 'https',
        hostname: 'pub-a9bf570d6d8445928c36336027160f9c.r2.dev',
      },
      {
        // Cloudinary
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
};

export default nextConfig;


