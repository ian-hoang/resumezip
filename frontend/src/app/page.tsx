import Link from "next/link"
import { ArrowRight, CheckCircle } from "lucide-react"

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow">
        {/* Hero Section */}
        <section id="get-started" className="py-20 px-4 md:px-6 lg:px-8">
          <div className="container mx-auto max-w-6xl">
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="flex-1 space-y-6">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                  Zip Through Resume Generation
                  <span className="block text-blue-600 mt-2">with AI At No Cost</span>
                </h1>
                <p className="text-lg text-gray-500 max-w-md">
                  ResumeZip helps developers build their resumes with ease and no cost.
                </p>
                <div className="pt-4">
                  <Link href="/create">
                    <button className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-lg font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-300 cursor-pointer">
                      Get started! <ArrowRight className="ml-2 h-5 w-5" />
                    </button>
                  </Link>
                </div>
              </div>
              <div className="flex-1">
                <div className="relative h-[350px] w-full rounded-lg bg-gradient-to-br from-blue-100 to-blue-50 p-2">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <div className="inline-block rounded-full bg-blue-100 p-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-medium">AI-Powered Resume Builder</h3>
                      <p className="text-gray-500">Create professional resumes in minutes</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 px-4 md:px-6 lg:px-8 bg-gray-50">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold">Why Choose ResumeZip?</h2>
              <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
                Our platform offers everything you need to create a standout resume
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                  <CheckCircle className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-medium mb-2">50+ Templates</h3>
                <p className="text-gray-500">Choose from our wide selection of professional templates</p>
              </div>

              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                  <CheckCircle className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-medium mb-2">AI Feedback</h3>
                <p className="text-gray-500">Get detailed feedback from our AI model to improve your resume</p>
              </div>

              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                  <CheckCircle className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-medium mb-2">ATS Friendly</h3>
                <p className="text-gray-500">Pass Applicant Tracking Systems with our optimized formats</p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="py-20 px-4 md:px-6 lg:px-8">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold">Get In Touch</h2>
              <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
                Have questions or feedback? We'd love to hear from you.
              </p>
            </div>

            <div className="max-w-md mx-auto">
              <form className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">
                      Name
                    </label>
                    <input
                      id="name"
                      className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      placeholder="Your name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      placeholder="Your email"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="message" className="text-sm font-medium">
                      Message
                    </label>
                    <textarea
                      id="message"
                      className="flex min-h-[120px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      placeholder="Your message"
                    />
                  </div>
                </div>
                <button className="w-full inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2  transition-colors duration-300 cursor-pointer">
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

