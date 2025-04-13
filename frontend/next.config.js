module.exports = {
  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: 'https://resumezip-io.firebaseapp.com/__/auth/:path*', // Ensure Firebase path is used
      },
      {
        source: '/__/auth/callback', // If callback should also redirect correctly
        destination: 'https://resumezip-io.firebaseapp.com/__/auth/callback',
      },
    ];
  },
};
