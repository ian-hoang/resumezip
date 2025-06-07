import Link from "next/link"
import { Shield, ArrowRight, BarChart, Server, Cpu } from "lucide-react"

const steps = [
  {
    icon: Shield,
    title: "Step 1",
    description: "Log in to your account to get started."
  },
  {
    icon: ArrowRight,
    title: "Step 2",
    description: "Click \"Get Started\" on the homepage to begin."
  },
  {
    icon: BarChart,
    title: "Step 3",
    description: "Fill in your details: education, experience, skills, and more."
  },
  {
    icon: Server,
    title: "Step 4",
    description: "Pick your favorite template that suits your style."
  },
  {
    icon: Cpu,
    title: "Step 5",
    description: "Compile your resume and download it instantly as a PDF."
  }
]

export default function HowItWorks() {
  return (
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
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center">
              <div className="text-blue-500 mb-4">
                <step.icon className="h-10 w-10 transition-transform duration-200 hover:scale-110" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
              <p className="text-gray-300 text-sm">{step.description}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-center mt-16">
          <Link
            href="/create/dashboard"
            className="inline-flex items-center justify-center rounded-full bg-blue-600 px-8 py-3 text-base text-white hover:bg-blue-500 transition-colors duration-300"
          >
            START BUILDING
          </Link>
        </div>
      </div>
    </section>
  )
} 