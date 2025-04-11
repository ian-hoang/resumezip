"use client"

import Link from "next/link"
import { ArrowLeft, Upload, PlusCircle, FileText, Cpu } from "lucide-react"

export default function CreateResumePage() {
  return (
    <main className="min-h-screen bg-[#f1efed] text-gray-800 py-12 px-4">
      <div className="container mx-auto max-w-7xl relative z-10">
        <div className="mb-6">
          <Link
            href="/create/dashboard"
            className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors group"
          >
            <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            Back to dashboard
          </Link>
        </div>

        <div className="mb-12">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-white shadow-sm text-blue-600 font-semibold text-sm mb-4">
            <Cpu className="h-4 w-4 mr-2" /> BUILD YOUR RESUME
          </div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Get Started</h1>
          <p className="mt-3 text-lg text-gray-600 max-w-2xl">
            Choose how you'd like to begin creating your professional resume
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Create New Resume Card */}
          <div className="group h-full">
            <Link
              href="/create/new"
              className="block rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden hover:shadow-md hover:border-blue-200 transition-all cursor-pointer relative h-full"
            >
              <div className="relative z-10 flex flex-col items-center justify-center text-center p-8 h-full">
                <div className="h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center mb-6 group-hover:bg-blue-100 transition-colors">
                  <PlusCircle className="h-8 w-8 text-blue-500" />
                </div>
                <h2 className="text-2xl font-bold mb-3 text-gray-900">Create New Resume</h2>
                <p className="text-gray-600 mb-6">
                  Start from scratch and build your professional resume with our AI-powered platform
                </p>
                <span className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors cursor-pointer">
                  Get Started
                </span>
              </div>
            </Link>
          </div>

          {/* Upload Existing Resume Card */}
          <div className="group h-full">
            <div className="rounded-xl bg-white border border-dashed border-gray-300 shadow-sm overflow-hidden hover:shadow-md hover:border-blue-200 transition-all h-full relative">
              <div className="relative z-10 flex flex-col items-center justify-center text-center p-8 h-full">
                <div className="h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center mb-6 group-hover:bg-blue-100 transition-colors">
                  <FileText className="h-8 w-8 text-blue-500" />
                </div>
                <h2 className="text-2xl font-bold mb-3 text-gray-900">Import Existing Resume</h2>
                <p className="text-gray-600 mb-6">
                  Upload an existing resume to enhance and optimize with our AI tools
                </p>
                <label className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Resume
                  <input type="file" className="hidden" accept=".pdf,.docx,.doc" />
                </label>
                <p className="text-xs text-gray-500 mt-3">Supports PDF, Word (.docx, .doc)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
