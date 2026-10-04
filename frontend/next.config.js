module.exports = {
  webpack(config) {
    // Typst resume templates are imported as source strings (src/lib/typst).
    config.module.rules.push({ test: /\.typ$/, type: "asset/source" });
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/sike',
        destination: 'https://www.youtube.com/', // Ensure Firebase path is used
      },
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
