"use client"

import type React from "react"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { ArrowLeft, Search, X, ExternalLink } from "lucide-react"

interface Template {
  id: string
  name: string
  category: "Professional" | "Creative" | "Simple" | "Modern"
  popular: boolean
  image: string
}

export default function TemplatesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // Template data
  const templates: Template[] = [
    {
      id: "jake",
      name: "Jake's Resume",
      category: "Professional",
      popular: true,
      image: "/jakeresume.webp",
    },
    {
      id: "levelsfyi",
      name: "levels.fyi",
      category: "Modern",
      popular: true,
      image: "/levelsfyi.webp",
    },
    {
      id: "modernjack",
      name: "Modern Jack's",
      category: "Creative",
      popular: false,
      image: "/modernjack.webp",
    },
    {
      id: "referme",
      name: "refer.me",
      category: "Simple",
      popular: false,
      image: "/referme.webp",
    },
  ]

  // Filter templates based on search query only
  const filteredTemplates = templates.filter((template) => {
    return template.name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const handleImageClick = (image: string, e: React.MouseEvent) => {
    e.preventDefault() // Prevent the Link navigation
    setPreviewImage(image)
  }

  const closePreview = () => {
    setPreviewImage(null)
  }

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
              Resume <span className="text-blue-500">Templates</span>
            </h1>
            <p className="text-lg text-gray-300 max-w-3xl font-medium">
              Browse our collection of professionally designed templates to create your perfect resume.
            </p>
          </div>
        </div>
      </section>

      {/* Search Section */}
      <section className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto max-w-6xl px-4 py-4 md:py-6">
          <div className="flex justify-center">
            {/* Search Bar */}
            <div className="relative w-full max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search templates by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Templates Grid */}
      <section className="bg-[#f1efed] py-12 px-4 md:px-6 lg:px-8 flex-grow">
        <div className="container mx-auto max-w-6xl">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-200 mb-6">
                <Search className="h-8 w-8 text-gray-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">No templates found</h2>
              <p className="text-gray-600">Try adjusting your search to find what you're looking for.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200 hover:shadow-md transition-all duration-300 group"
                >
                  {/* Image Container with Preview Functionality */}
                  <div
                    className="relative h-64 bg-gray-100 cursor-pointer"
                    onClick={(e) => handleImageClick(template.image, e)}
                  >
                    <Image
                      src={template.image || "/placeholder.svg"}
                      alt={template.name}
                      fill
                      className="object-contain group-hover:scale-[1.02] transition-transform duration-300"
                      onError={(e) => {
                        // Fallback for missing images
                        const target = e.target as HTMLImageElement
                        target.src = `/placeholder.svg?height=400&width=300&query=resume template ${template.name}`
                      }}
                    />
                    {template.popular && (
                      <div className="absolute top-3 right-3 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                        Popular
                      </div>
                    )}

                    {/* Preview hint overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <div className="bg-white/90 rounded-full p-2 shadow-lg">
                        <ExternalLink className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                  </div>

                  {/* Template Info and Use Button */}
                  <div className="p-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-gray-900">{template.name}</h3>
                        <p className="text-sm text-gray-500">{template.category}</p>
                      </div>
                      <Link href="/create/dashboard">
                        <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors">
                          Use
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={closePreview}>
          <div className="relative max-w-3xl w-full max-h-[80vh] bg-gray-100 rounded-lg shadow-2xl overflow-hidden">
            <button
              onClick={closePreview}
              className="cursor-pointer absolute top-4 right-4 bg-black/50 hover:bg-black text-white rounded-full p-1 transition-colors z-10"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="relative h-[70vh] w-full">
              <Image
                src={previewImage || "/placeholder.svg"}
                alt="Template Preview"
                fill
                className="object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
