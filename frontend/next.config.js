module.exports = {
  async rewrites () {
    return {
      beforeFiles: [
        {
          source: '/__/auth/:path*',
          destination: `https://resumezip-io.firebaseapp.com/__/auth/:path*`
        }
      ]
    }
  }
}