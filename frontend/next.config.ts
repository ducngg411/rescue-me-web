import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  },
};

export default nextConfig;


