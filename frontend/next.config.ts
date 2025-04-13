import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Your config here
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/__/auth/:path*',
          destination: `https://myapp.firebaseapp.com/__/auth/:path*`
        }
      ]
    }
  }
}

export default nextConfig
