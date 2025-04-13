import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*", // Match any Firebase auth helper route
        destination: "https://resumezip-io.firebaseapp.com/__/auth/:path*", // Proxy to Firebase hosting
      },
    ]
  },
}

export default nextConfig
