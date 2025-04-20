import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function ComingSoonPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#f1efed]">
      {/* Header Section - Dark Theme */}
      <section className="bg-black text-white py-16 px-4 md:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15),transparent_50%)]"></div>
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="flex flex-col items-center text-center gap-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              resumezip.<span className="text-blue-500">feed</span>
            </h1>
            <p className="text-lg text-gray-300 max-w-3xl font-medium">
              This feature will be available soon. Check back later!
            </p>
          </div>
        </div>
      </section>

      {/* Back to Home Button */}
      <section className="flex-grow flex items-center justify-center py-16 px-4">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full bg-blue-600 px-8 py-3 text-base text-white hover:bg-blue-500 transition-colors duration-300"
        >
          GO TO HOMEPAGE
        </Link>
      </section>
    </div>
  )
}
