// next.config.js
module.exports = {
  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: 'https://resumezip-io.firebaseapp.com/__/auth/:path*',
      },
    ];
  },
};
