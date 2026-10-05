module.exports = {
  webpack(config) {
    // Typst resume templates are imported as source strings (src/lib/typst).
    config.module.rules.push({ test: /\.typ$/, type: "asset/source" });
    return config;
  },
  // Sends visitors on to YouTube rather than serving it through this site.
  async redirects() {
    return [
      {
        source: '/sike',
        destination: 'https://www.youtube.com/',
        permanent: false,
      },
    ];
  },
};
