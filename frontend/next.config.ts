import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: "https://resumezip-io.firebaseapp.com/__/auth/:path*",
      },
    ]
  },
};

export default nextConfig;
