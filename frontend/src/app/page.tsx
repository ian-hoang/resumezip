import Link from "next/link"
import Image from "next/image"
import { Cpu, Network, BarChart, Server, Shield, Zap, ArrowRight } from "lucide-react"

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen overflow-hidden">
      <main className="flex-grow">
        {/* Hero Section - Dark Theme */}
        <section className="bg-black text-white pt-10 px-4 md:px-6 lg:px-8 relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15),transparent_50%)]"></div>
          <div className="absolute inset-0 bg-[url('/dots-pattern.png')] bg-repeat opacity-20"></div>
          <div className="container mx-auto max-w-6xl relative z-10">
            <div className="flex flex-col items-center text-center">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8">
                AI <span className="text-blue-500"> Resume </span> Builder
              </h1>
              <p className="text-xl text-gray-300 max-w-3xl font-medium mb-8">
                Create professional resumes in minutes with our platform.
                <br />
                Zip through the process with no cost, no hassle.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Link href="/create/dashboard">
                  <button className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-500 transition-colors duration-300">
                    Get Started
                  </button>
                </Link>
                <Link href="/contact-sales">
                  <button className="inline-flex items-center justify-center rounded-md border border-gray-700 bg-transparent px-6 py-3 text-base font-medium text-gray-300 hover:bg-gray-800 transition-colors duration-300">
                    Pricing Plan
                  </button>
                </Link>
              </div>
              <div className="flex justify-center">
                <Image
                  src="/ThreeResumes.png"
                  alt="Three sample resumes"
                  width={1200}
                  height={700}
                  className="rounded-lg shadow-lg w-full max-w-4xl h-auto"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section - Light Theme */}
        <section className="bg-[#f1efed] py-20 px-4 md:px-6 lg:px-8">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                <span className="text-blue-500">Build</span> a standout resume. Powered by{" "}
                <span className="text-blue-500">smart design</span> and automation.
              </h2>
              <p className="mt-4 text-gray-600 max-w-4xl mx-auto">
                Our platform helps developers create clean, professional resumes in minutes — no design skills needed. Just focus on your experience, and let us handle the rest.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-16">
              {/* Feature 1 */}
              <div className="flex flex-col">
                <div className="text-blue-500 mb-4">
                  <Cpu className="h-10 w-10 transition-transform duration-200 hover:scale-110 transition-transform duration-200 hover:scale-110" />
                </div>
                <h3 className="text-xl font-bold mb-2">AI-Powered Suggestions</h3>
                <p className="text-gray-600 text-sm">
                  Get tailored bullet points and phrasing based on your experience, powered by intelligent language models.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="flex flex-col">
                <div className="text-blue-500 mb-4">
                  <Server className="h-10 w-10 transition-transform duration-200 hover:scale-110" />
                </div>
                <h3 className="text-xl font-bold mb-2">Clean, Developer-Focused Templates</h3>
                <p className="text-gray-600 text-sm">
                  Choose from modern, ATS-friendly templates designed with software engineers in mind.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="flex flex-col">
                <div className="text-blue-500 mb-4">
                  <Network className="h-10 w-10 transition-transform duration-200 hover:scale-110" />
                </div>
                <h3 className="text-xl font-bold mb-2">Easy PDF Export</h3>
                <p className="text-gray-600 text-sm">
                  Export your resume as a polished PDF with one click — ready to submit to any job board or recruiter.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="flex flex-col">
                <div className="text-blue-500 mb-4">
                  <Zap className="h-10 w-10 transition-transform duration-200 hover:scale-110" />
                </div>
                <h3 className="text-xl font-bold mb-2">Instant Live Preview</h3>
                <p className="text-gray-600 text-sm">
                  See changes in real time as you edit — no reloading or waiting around.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="flex flex-col">
                <div className="text-blue-500 mb-4">
                  <BarChart className="h-10 w-10 transition-transform duration-200 hover:scale-110" />
                </div>
                <h3 className="text-xl font-bold mb-2">Guidance & Tips</h3>
                <p className="text-gray-600 text-sm">
                  Unsure what to write? Get writing tips, section suggestions, and layout best practices as you go.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="flex flex-col">
                <div className="text-blue-500 mb-4">
                  <Shield className="h-10 w-10 transition-transform duration-200 hover:scale-110" />
                </div>
                <h3 className="text-xl font-bold mb-2">Privacy First</h3>
                <p className="text-gray-600 text-sm">
                  Your data stays secure. We don’t store resumes or personal info without your consent.
                </p>
              </div>
            </div>

            <div className="flex justify-center mt-16">
              <Link href="/create">
                <button className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-500 transition-colors duration-300">
                  Create My Resume
                </button>
              </Link>
            </div>
          </div>
        </section>


        {/* How It Works Section - Dark Theme */}
        <section className="bg-black text-white py-20 px-4 md:px-6 lg:px-8">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                How to <span className="text-blue-500">Build</span> Your Resume
              </h2>
              <p className="mt-4 text-gray-400 max-w-3xl mx-auto text-lg">
                Follow these five simple steps to create and download your perfect resume — fast, easy, and totally free.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-8 text-center">
              <div className="flex flex-col items-center">
                <div className="text-blue-500 mb-4">
                  <Shield className="h-10 w-10 transition-transform duration-200 hover:scale-110" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Step 1</h3>
                <p className="text-gray-300 text-sm">Log in to your account to get started.</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-blue-500 mb-4">
                  <ArrowRight className="h-10 w-10 transition-transform duration-200 hover:scale-110" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Step 2</h3>
                <p className="text-gray-300 text-sm">Click "Get Started" on the homepage to begin.</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-blue-500 mb-4">
                  <BarChart className="h-10 w-10 transition-transform duration-200 hover:scale-110" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Step 3</h3>
                <p className="text-gray-300 text-sm">Fill in your details: education, experience, skills, and more.</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-blue-500 mb-4">
                  <Server className="h-10 w-10 transition-transform duration-200 hover:scale-110" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Step 4</h3>
                <p className="text-gray-300 text-sm">Pick your favorite template that suits your style.</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-blue-500 mb-4">
                  <Cpu className="h-10 w-10 transition-transform duration-200 hover:scale-110" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Step 5</h3>
                <p className="text-gray-300 text-sm">Compile your resume and download it instantly as a PDF.</p>
              </div>
            </div>

            <div className="flex justify-center mt-16">
              <Link href="/create">
                <button className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-500 transition-colors duration-300">
                  Start Building
                </button>
              </Link>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}
