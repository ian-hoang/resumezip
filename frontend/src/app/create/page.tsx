// eslint-disable-next-line react/no-unescaped-entities
import Link from "next/link"
import { ArrowLeft, Upload, PlusCircle, FileText, Sparkles } from 'lucide-react'

export default function CreateResumePage() {
  return (
    <main className="min-h-screen bg-[#D3D9D4] py-12 px-4 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="fixed -top-24 -right-24 w-48 h-48 rounded-full bg-[#124E66]/10 blur-3xl"></div>
      <div className="fixed -bottom-24 left-1/3 w-48 h-48 rounded-full bg-[#124E66]/10 blur-3xl"></div>
      
      <div className="container mx-auto max-w-6xl relative z-10">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-sm font-medium text-[#2E3944] hover:text-[#124E66] transition-colors group">
            <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            Back to home
          </Link>
        </div>

        <div className="mb-10">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#124E66]/10 text-[#124E66] font-semibold text-sm mb-4">
            <Sparkles className="h-4 w-4 mr-2" /> CREATE YOUR RESUME
          </div>
          <h1 className="text-4xl font-extrabold text-[#212A31] tracking-tight">Get Started</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#124E66] to-[#748D92] rounded-xl blur-sm opacity-75 group-hover:opacity-100 transition duration-300"></div>
            <Link href="/create/new" className="relative block rounded-xl bg-white shadow-xl overflow-hidden transform transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-2xl">
              <div className="flex flex-col items-center justify-center text-center h-72 p-8">
                <div className="h-16 w-16 rounded-full bg-[#124E66]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <PlusCircle className="h-8 w-8 text-[#124E66]" />
                </div>
                <h2 className="text-2xl font-bold mb-3 text-[#212A31]">Create New Resume</h2>
                <p className="text-[#2E3944] mb-6">Start from scratch and build your perfect resume with our AI-powered tools</p>
                <span className="inline-flex items-center justify-center rounded-lg bg-[#124E66] px-4 py-2 text-sm font-bold text-[#D3D9D4] group-hover:bg-[#124E66]/90 transition-colors">
                  Get Started
                </span>
              </div>
            </Link>
          </div>

          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#748D92] to-[#124E66] rounded-xl blur-sm opacity-75 group-hover:opacity-100 transition duration-300"></div>
            <div className="relative rounded-xl bg-white shadow-xl overflow-hidden transform transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-2xl">
              <div className="flex flex-col items-center justify-center text-center h-72 p-8">
                <div className="h-16 w-16 rounded-full bg-[#124E66]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <FileText className="h-8 w-8 text-[#124E66]" />
                </div>
                <h2 className="text-2xl font-bold mb-3 text-[#212A31]">Upload Existing Resume</h2>
                <p className="text-[#2E3944] mb-6">Upload an existing resume to edit and improve with AI suggestions</p>
                <label className="inline-flex items-center justify-center rounded-lg border-2 border-[#124E66] bg-transparent px-4 py-2 text-sm font-bold text-[#124E66] hover:bg-[#124E66]/10 cursor-pointer transition-colors">
                  <Upload className="mr-2 h-4 w-4" />
                  Select File
                  <input type="file" className="hidden" />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
