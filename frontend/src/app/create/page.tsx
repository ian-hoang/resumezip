import Link from "next/link"
import { ArrowLeft, Upload } from "lucide-react"

export default function CreateResumePage() {
  return (
    <main className="container mx-auto max-w-6xl py-12 px-4">
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to home
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">Get Started</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="rounded-lg border-2 border-gray-200 hover:border-blue-600 transition-colors cursor-pointer overflow-hidden">
          <Link href="/create/new" className="block p-6">
            <div className="flex flex-col items-center justify-center text-center h-64">
              <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-blue-600"
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>
              <h2 className="text-xl font-medium mb-2">Create New Resume</h2>
              <p className="text-gray-500">Start from scratch and build your perfect resume</p>
            </div>
          </Link>
        </div>

        <div className="rounded-lg border-2 border-dashed border-gray-200 hover:border-blue-600 transition-colors cursor-pointer overflow-hidden">
          <div className="flex flex-col items-center justify-center text-center h-64 p-6">
            <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <Upload className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-medium mb-2">Drop your resume here</h2>
            <p className="text-gray-500 mb-4">Upload an existing resume to edit and improve</p>
            <button className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              Select File
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

