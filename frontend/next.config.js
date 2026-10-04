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
        destination: 'https://www.youtube.com/',
      },
    ];
  },
};
