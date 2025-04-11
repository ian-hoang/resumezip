"use client"

import Link from "next/link"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Plus, Clock, Edit, Download, Trash2, Sparkles, ChevronDown, X } from "lucide-react"

interface Resume {
  id: string
  title: string
  updatedAt: string
  type: "Personal" | "Professional" | "Academic"
}

interface Template {
  id: string
  name: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newResumeName, setNewResumeName] = useState("My Resume")
  const [selectedTemplate, setSelectedTemplate] = useState("default")
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const templates: Template[] = [
    { id: "default", name: "Default Boilerplate" },
    { id: "professional", name: "Professional Template" },
    { id: "creative", name: "Creative Template" },
    { id: "academic", name: "Academic Template" },
  ]

  const [resumes, setResumes] = useState<Resume[]>([
    { id: "1", title: "Software Engineer Resume", updatedAt: "2025-03-15", type: "Professional" },
    { id: "2", title: "Product Manager Application", updatedAt: "2025-02-28", type: "Professional" },
    { id: "3", title: "University Application", updatedAt: "2025-01-10", type: "Academic" },
    { id: "4", title: "Freelance Portfolio", updatedAt: "2024-12-05", type: "Personal" },
    { id: "5", title: "Tech Internship", updatedAt: "2024-11-20", type: "Academic" },
    { id: "6", title: "Startup Pitch", updatedAt: "2024-10-15", type: "Professional" },
    { id: "7", title: "General Resume", updatedAt: "2024-09-01", type: "Personal" },
  ])

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setIsModalOpen(false)
      }
    }

    if (isModalOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isModalOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isDropdownOpen])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })
  }

  const getTagColor = (type: string) => {
    switch (type) {
      case "Professional":
        return "bg-blue-100 text-blue-600"
      case "Academic":
        return "bg-green-100 text-green-600"
      case "Personal":
      default:
        return "bg-purple-100 text-purple-600"
    }
  }

  const deleteResume = (id: string) => {
    setResumes(resumes.filter((resume) => resume.id !== id))
  }

  const handleCreateResume = () => {
    // Close the modal
    setIsModalOpen(false)

    // Navigate to the create page with the name and template as query parameters
    router.push(`/create?name=${encodeURIComponent(newResumeName)}&template=${selectedTemplate}`)
  }

  const getSelectedTemplateName = () => {
    return templates.find((template) => template.id === selectedTemplate)?.name || "Select a template"
  }

  return (
    <div className="min-h-screen bg-[#f1efed]">
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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-900/30 text-blue-400 font-semibold text-sm mb-3">
                <Sparkles className="h-4 w-4 mr-2" /> RESUME MANAGEMENT
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                Your <span className="text-blue-500">Resumes</span>
              </h1>
              <p className="mt-3 text-gray-300 max-w-2xl">
                Manage all your resume versions in one place. Create, edit, and download your professional documents.
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-500 transition-colors duration-300 shadow-sm"
            >
              <Plus className="mr-2 h-5 w-5" />
              Create New Resume
            </button>
          </div>
        </div>
      </section>

      {/* Dashboard Content */}
      <section className="py-12 px-4 md:px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resumes.map((resume) => (
              <div
                key={resume.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow group"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-900 mb-1 truncate">{resume.title}</h3>
                      <div className="flex items-center text-gray-500 text-sm">
                        <Clock className="h-3.5 w-3.5 mr-1.5" />
                        <span>Updated: {formatDate(resume.updatedAt)}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getTagColor(resume.type)}`}>
                      {resume.type}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-6">
                    <Link
                      href={`/create/new?id=${resume.id}`}
                      className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors"
                    >
                      <Edit className="mr-1.5 h-4 w-4" />
                      Edit
                    </Link>
                    <div className="flex items-center gap-3">
                      <button
                        className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                        aria-label="Download resume"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteResume(resume.id)}
                        className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-red-600 transition-colors"
                        aria-label="Delete resume"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Add New Resume Card */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex flex-col items-center justify-center text-center p-6 bg-white rounded-xl border border-dashed border-gray-300 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group h-full"
            >
              <div className="h-12 w-12 rounded-full bg-[#f1efed] flex items-center justify-center mb-4 group-hover:bg-blue-50 transition-colors">
                <Plus className="h-6 w-6 text-blue-500" />
              </div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">Create New Resume</h3>
              <p className="text-gray-500 text-sm">Start building a new professional resume</p>
            </button>
          </div>
        </div>
      </section>

      {/* Custom Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div ref={modalRef} className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Create New Resume</h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-gray-600 mt-2 text-sm">
                If you want to create a resume from a template, go clone one on the{" "}
                <Link href="/templates" className="text-blue-500 hover:underline">
                  Templates
                </Link>{" "}
                page.
              </p>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="space-y-4">
                {/* Name Input */}
                <div className="space-y-2">
                  <label htmlFor="resume-name" className="block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    type="text"
                    id="resume-name"
                    value={newResumeName}
                    onChange={(e) => setNewResumeName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Template Dropdown */}
                <div className="space-y-2">
                  <label htmlFor="template" className="block text-sm font-medium text-gray-700">
                    Create from
                  </label>
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    >
                      <span>{getSelectedTemplateName()}</span>
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    </button>

                    {isDropdownOpen && (
                      <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 py-1">
                        {templates.map((template) => (
                          <button
                            key={template.id}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                            onClick={() => {
                              setSelectedTemplate(template.id)
                              setIsDropdownOpen(false)
                            }}
                          >
                            {template.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateResume}
                className="px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
