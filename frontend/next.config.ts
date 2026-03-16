import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Tree-shake icon libraries — avoids importing all 1000+ icons on every compile
    optimizePackageImports: ['lucide-react'],
  },
  // Silence the "webpack config but no turbopack config" warning in Next.js 16+
  turbopack: {},
};

export default nextConfig;

