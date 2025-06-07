import { Cpu, Network, BarChart, Server, Shield, Zap } from "lucide-react"

const features = [
  {
    icon: Cpu,
    title: "AI-Powered Suggestions",
    description: "Get tailored bullet points and phrasing based on your experience, powered by large language models."
  },
  {
    icon: Server,
    title: "Clean, Developer-Focused Templates",
    description: "Choose from modern, ATS-friendly templates designed with software engineers in mind."
  },
  {
    icon: Network,
    title: "Easy PDF Export",
    description: "Export your resume as a polished PDF with one click — ready to submit to any job board or recruiter."
  },
  {
    icon: Zap,
    title: "Instant Compilation",
    description: "See changes as you edit."
  },
  {
    icon: BarChart,
    title: "Guidance & Tips",
    description: "Unsure what to write? Get writing tips, section suggestions, and layout best practices as you go."
  },
  {
    icon: Shield,
    title: "Privacy First",
    description: "Your data stays secure. We don't store resumes or personal info without your consent."
  }
]

export default function Features() {
  return (
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
          {features.map((feature, index) => (
            <div key={index} className="flex flex-col">
              <div className="text-blue-500 mb-4">
                <feature.icon className="h-10 w-10 transition-transform duration-200 hover:scale-110" />
              </div>
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-gray-600 text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
} 