module.exports = {
  async rewrites () {
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