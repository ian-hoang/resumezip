import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Heart, Sparkles, Code, FileText } from "lucide-react"

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header Section - Dark Theme */}
      <section className="bg-black text-white py-16 px-4 md:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[url('/dots-pattern.png')] bg-repeat opacity-20"></div>
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center text-sm font-medium text-gray-300 hover:text-white transition-colors group"
            >
              <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              Back to home
            </Link>
          </div>
          <div className="flex flex-col items-center text-center gap-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              resumezip<span className="text-blue-500">.about</span>
            </h1>
            <p className="text-lg text-gray-300 max-w-3xl font-medium">
              A personal project built to help job seekers create professional resumes easily and effectively.
            </p>
          </div>
        </div>
      </section>

      {/* My Story Section */}
      <section className="bg-[#f1efed] py-16 px-4 md:px-6 lg:px-8">
        <div className="container mx-auto max-w-3xl">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-8 md:p-10">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mb-6">
                <Sparkles className="h-4 w-4 mr-2" /> MY STORY
              </div>

              <div className="flex flex-col md:flex-row gap-8 items-center mb-8">
                <div className="w-32 h-32 relative rounded-full overflow-hidden border-4 border-blue-100 flex-shrink-0">
                  <Image src="/myself.webp" alt="Creator" fill className="object-cover" />
                </div>

                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                    Hi, I'm Ian Hoang.
                  </h2>
                  <p className="text-gray-600">
                    I built resumezip.io because I wanted to help people, especially developers, create their resumes with ease and zero cost.
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-gray-700">
                <p>
                  This started as a personal project in March 2025. As someone who has difficulty writing resumes, I often found myself spending hours trying to format my resume correctly and make it look professional. I know how frustrating it can be to have a great skill set but struggle to present it effectively on paper.
                </p>

                <p>
                  resumezip.io isn't about making profits. It's about helping people. The tool combines clean design templates with helpful suggestions to help you create a professional resume quickly and easily. I'm constantly working to improve it based on user feedback and the latest best practices in resume writing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-[#f1efed] py-8 px-4 md:px-6 lg:px-8">
        <div className="container mx-auto max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm text-center">
              <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Simple Templates</h3>
              <p className="text-gray-600 text-sm">
                Clean, professional templates designed to highlight your experience
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm text-center">
              <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <Code className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Easy to Use</h3>
              <p className="text-gray-600 text-sm">Built with simplicity in mind so you can focus on your content</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm text-center">
              <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Free to Use</h3>
              <p className="text-gray-600 text-sm">
                I have no plans to charge for this tool.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why I Built This Section */}
      <section className="bg-white py-16 px-4 md:px-6 lg:px-8">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-10">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mb-4">
              <Heart className="h-4 w-4 mr-2" /> FINAL THOUGHTS
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">What can you do to help?</h2>
          </div>

          <div className="space-y-6 text-gray-700">
            <p>
              This tool is completely free to use, and I have no plans to charge for it. However, if you find it helpful and want to support its development, here are a few ways you can help:
            </p>
            <p>
                <strong>1. Provide feedback.</strong> I want to hear your thoughts on how to improve the tool. Your feedback is invaluable.
            </p>
            <p>
                <strong>2. Spread the word.</strong> If you know someone who could benefit from this tool, please share it with them. The more people we can help, the better.
            </p>
            <p>
                <strong>3. Contribute to the code.</strong> If you're a developer and interested in our mission, email me to be part of the team and contribute.
            </p>
            <p>
                <strong>4. Follow me on social media and dm me.</strong> I love to connect with people and share updates about the project. You can find me on LinkedIn or GitHub.
            </p>
            <p>
                <strong>5. Give back to the community.</strong> Build your own projects and share them with others. I believe in the power of community-driven projects.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-black text-white py-12 px-4 md:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15),transparent_50%)]"></div>
        <div className="container mx-auto max-w-3xl relative z-10 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to create your resume?</h2>
          <p className="text-gray-300 mb-6">It's free, simple, and designed to help you put your best foot forward.</p>
          <Link
            href="/create/dashboard"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-500 transition-colors duration-300 shadow-sm"
          >
            Get Started
          </Link>
        </div>
      </section>
    </div>
  )
}
