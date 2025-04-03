import Link from "next/link"
import { ArrowRight, CheckCircle, Zap, Star, Sparkles } from "lucide-react"

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-[#D3D9D4] overflow-hidden">
      {/* Decorative elements */}
      <div className="fixed -top-24 -right-24 w-48 h-48 rounded-full bg-[#124E66]/10 blur-3xl"></div>
      <div className="fixed top-1/3 -left-24 w-48 h-48 rounded-full bg-[#124E66]/10 blur-3xl"></div>
      <div className="fixed -bottom-24 right-1/3 w-48 h-48 rounded-full bg-[#124E66]/10 blur-3xl"></div>

      <main className="flex-grow relative z-10">
        {/* Hero Section */}
        <section id="get-started" className="py-20 px-4 md:px-6 lg:px-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#124E66]/10 via-transparent to-[#124E66]/5"></div>

          {/* Animated shapes */}
          <div className="absolute top-20 right-10 w-20 h-20 bg-[#124E66]/20 rounded-full blur-xl animate-pulse"></div>
          <div
            className="absolute bottom-20 left-10 w-16 h-16 bg-[#124E66]/20 rounded-full blur-xl animate-pulse"
            style={{ animationDelay: "1s" }}
          ></div>

          <div className="container mx-auto max-w-6xl relative z-10">
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="flex-1 space-y-6">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#124E66]/10 text-[#124E66] font-semibold text-sm mb-2">
                  <Sparkles className="h-4 w-4 mr-2" /> AI-Powered Resume Builder
                </div>
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-[#212A31]">
                  Zip Through
                  <span className="block text-[#124E66] mt-2 relative">
                    Resume Creation
                    <svg
                      className="absolute -bottom-2 left-0 w-full"
                      viewBox="0 0 300 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M1 5.5C32.3333 1.16667 96.6 -4.5 144 5.5C191.4 15.5 277.667 11.1667 299 5.5"
                        stroke="#124E66"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </h1>
                <p className="text-lg text-[#2E3944] max-w-md font-medium">
                  Create professional resumes in minutes with our AI-powered platform. No cost, no hassle.
                </p>
                <div className="pt-4 flex items-center gap-4">
                  <Link href="/create">
                    <button className="inline-flex items-center justify-center rounded-lg bg-[#124E66] px-6 py-3.5 text-lg font-bold text-[#D3D9D4] hover:bg-[#124E66]/90 focus:outline-none focus:ring-2 focus:ring-[#748D92] focus:ring-offset-2 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-xl transform hover:-translate-y-1 border-b-[3px] border-[#124E66]/50">
                      Get started <ArrowRight className="ml-2 h-5 w-5" />
                    </button>
                  </Link>
                  <span className="text-[#2E3944] font-medium">It's 100% free</span>
                </div>
              </div>
              <div className="flex-1 relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[#124E66] to-[#748D92] rounded-2xl blur-sm opacity-70 group-hover:opacity-100 transition duration-1000 animate-pulse"></div>
                <div className="relative h-[400px] w-full rounded-2xl bg-gradient-to-br from-[#124E66] to-[#748D92] p-1 shadow-2xl transform rotate-1 hover:rotate-0 transition-all duration-500 group">
                  <div className="absolute inset-0 bg-white rounded-2xl m-0.5 flex items-center justify-center overflow-hidden">
                    {/* Decorative grid background */}
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMwLTkuOTQtOC4wNi0xOC0xOC0xOFYwaDQydjQySDM2VjE4eiIgZmlsbD0iI2VmZWZlZiIvPjwvZz48L3N2Zz4=')] opacity-5"></div>

                    <div className="text-center space-y-6 p-8">
                      <div className="inline-flex items-center justify-center rounded-full bg-[#124E66]/10 p-4 shadow-inner">
                        <Zap className="h-12 w-12 text-[#124E66]" />
                      </div>
                      <h3 className="text-2xl font-bold text-[#212A31]">AI-Powered Resume Builder</h3>
                      <p className="text-[#2E3944] font-medium max-w-xs mx-auto">
                        Create professional resumes in minutes with our cutting-edge AI technology
                      </p>

                      <div className="flex items-center justify-center gap-1 text-[#124E66]">
                        <Star className="h-5 w-5 fill-current" />
                        <Star className="h-5 w-5 fill-current" />
                        <Star className="h-5 w-5 fill-current" />
                        <Star className="h-5 w-5 fill-current" />
                        <Star className="h-5 w-5 fill-current" />
                        <span className="ml-2 text-sm font-medium text-[#2E3944]">5.0 (2.5k+ reviews)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section
          id="features"
          className="py-20 px-4 md:px-6 lg:px-8 bg-gradient-to-b from-[#212A31] to-[#2E3944] text-[#D3D9D4] relative overflow-hidden"
        >
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#124E66] to-transparent"></div>
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#124E66]/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[#124E66]/20 rounded-full blur-3xl"></div>

          <div className="container mx-auto max-w-6xl relative z-10">
            <div className="text-center mb-16">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#124E66]/20 text-[#D3D9D4] font-semibold text-sm mb-4">
                <Sparkles className="h-4 w-4 mr-2" /> FEATURES
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold text-[#D3D9D4] mb-4">Why Choose ResumeZip?</h2>
              <p className="mt-4 text-lg text-[#D3D9D4]/80 max-w-2xl mx-auto">
                Our platform offers everything you need to create a standout resume
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-gradient-to-br from-[#2E3944] to-[#212A31] rounded-xl p-8 shadow-xl border-l-4 border-[#124E66] transform transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl group">
                <div className="h-14 w-14 rounded-xl bg-[#124E66]/20 flex items-center justify-center mb-6 group-hover:bg-[#124E66]/30 transition-colors duration-300">
                  <CheckCircle className="h-7 w-7 text-[#124E66]" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-[#D3D9D4] group-hover:text-[#D3D9D4] transition-colors">
                  Various Templates
                </h3>
                <p className="text-[#D3D9D4]/80 group-hover:text-[#D3D9D4]/90 transition-colors">
                  Choose from our wide selection of professional templates designed for every industry
                </p>
              </div>

              <div className="bg-gradient-to-br from-[#2E3944] to-[#212A31] rounded-xl p-8 shadow-xl border-l-4 border-[#124E66] transform transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl group">
                <div className="h-14 w-14 rounded-xl bg-[#124E66]/20 flex items-center justify-center mb-6 group-hover:bg-[#124E66]/30 transition-colors duration-300">
                  <CheckCircle className="h-7 w-7 text-[#124E66]" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-[#D3D9D4] group-hover:text-[#D3D9D4] transition-colors">
                  AI Feedback
                </h3>
                <p className="text-[#D3D9D4]/80 group-hover:text-[#D3D9D4]/90 transition-colors">
                  Get detailed feedback from our AI model to improve your resume and stand out
                </p>
              </div>

              <div className="bg-gradient-to-br from-[#2E3944] to-[#212A31] rounded-xl p-8 shadow-xl border-l-4 border-[#124E66] transform transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl group">
                <div className="h-14 w-14 rounded-xl bg-[#124E66]/20 flex items-center justify-center mb-6 group-hover:bg-[#124E66]/30 transition-colors duration-300">
                  <CheckCircle className="h-7 w-7 text-[#124E66]" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-[#D3D9D4] group-hover:text-[#D3D9D4] transition-colors">
                  ATS Friendly
                </h3>
                <p className="text-[#D3D9D4]/80 group-hover:text-[#D3D9D4]/90 transition-colors">
                  Pass Applicant Tracking Systems with our optimized formats and get more interviews
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="py-20 px-4 md:px-6 lg:px-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-[#D3D9D4] to-[#748D92]/30"></div>

          <div className="container mx-auto max-w-6xl relative z-10">
            <div className="text-center mb-16">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#124E66]/10 text-[#124E66] font-semibold text-sm mb-4">
                <Sparkles className="h-4 w-4 mr-2" /> GET IN TOUCH
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold text-[#212A31] mb-4">Contact Us</h2>
              <p className="mt-4 text-lg text-[#2E3944] max-w-2xl mx-auto font-medium">
                Have questions or feedback? We'd love to hear from you.
              </p>
            </div>

            <div className="max-w-md mx-auto">
              <form className="space-y-6 bg-white p-8 rounded-xl shadow-2xl border-t-4 border-[#124E66] relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#124E66]/5 rounded-full blur-3xl"></div>

                <div className="grid grid-cols-1 gap-6 relative z-10">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-bold text-[#212A31] uppercase tracking-wider">
                      Name
                    </label>
                    <input
                      id="name"
                      className="flex h-12 w-full rounded-lg border-2 border-[#748D92]/30 bg-[#D3D9D4]/30 px-4 py-2 text-[#212A31] placeholder:text-[#2E3944]/40 focus:outline-none focus:ring-2 focus:ring-[#124E66] focus:border-[#124E66] focus:ring-offset-2 transition-all duration-300"
                      placeholder="Your name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-bold text-[#212A31] uppercase tracking-wider">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      className="flex h-12 w-full rounded-lg border-2 border-[#748D92]/30 bg-[#D3D9D4]/30 px-4 py-2 text-[#212A31] placeholder:text-[#2E3944]/40 focus:outline-none focus:ring-2 focus:ring-[#124E66] focus:border-[#124E66] focus:ring-offset-2 transition-all duration-300"
                      placeholder="Your email"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="message" className="text-sm font-bold text-[#212A31] uppercase tracking-wider">
                      Message
                    </label>
                    <textarea
                      id="message"
                      className="flex min-h-[120px] w-full rounded-lg border-2 border-[#748D92]/30 bg-[#D3D9D4]/30 px-4 py-2 text-[#212A31] placeholder:text-[#2E3944]/40 focus:outline-none focus:ring-2 focus:ring-[#124E66] focus:border-[#124E66] focus:ring-offset-2 transition-all duration-300"
                      placeholder="Your message"
                    />
                  </div>
                </div>
                <button className="w-full inline-flex items-center justify-center rounded-lg bg-[#124E66] px-4 py-3.5 text-base font-bold uppercase tracking-wider text-[#D3D9D4] hover:bg-[#124E66]/90 focus:outline-none focus:ring-2 focus:ring-[#748D92] focus:ring-offset-2 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-xl transform hover:-translate-y-1 border-b-[3px] border-[#124E66]/50">
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

