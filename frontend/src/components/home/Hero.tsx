import Link from "next/link"
import Image from "next/image"

export default function Hero() {
  return (
    <section className="bg-black text-white pt-10 px-4 md:px-6 lg:px-8 relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15),transparent_50%)]"></div>
      <div className="container mx-auto max-w-6xl relative z-10">
        <div className="flex flex-col items-center text-center gap-5">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
            Build <span className="text-blue-500"> Resume </span> in a Zip
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl font-medium">
            Create a professional resume in minutes.
            <br />
            Easy, free, and saved on your local browser forever.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 relative">
            <Link
              href="/create/dashboard"
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-8 py-3 text-base text-white hover:bg-blue-500 transition-colors duration-300"
            >
              Get Started
            </Link>
          </div>
          <div className="flex justify-center">
            <Image
              src="/ThreeResumesFinal.webp"
              alt="Three sample resumes"
              width={1200}
              height={600}
              className="rounded-lg shadow-lg w-full max-w-4xl h-auto"
              priority
              quality={85}
            />
          </div>
        </div>
      </div>
    </section>
  )
} 