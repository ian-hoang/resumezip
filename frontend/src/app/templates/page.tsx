"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { ArrowLeft, Search, Filter } from "lucide-react"

interface Template {
  id: string
  name: string
  category: "Professional" | "Creative" | "Simple" | "Modern"
  popular: boolean
  image: string
}

export default function TemplatesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState<string>("all")

  // Template data
  const templates: Template[] = [
    {
      id: "classic-pro",
      name: "Classic Professional",
      category: "Professional",
      popular: true,
      image: "/jakeresume.png",
    },
    {
      id: "modern-minimal",
      name: "Modern Minimal",
      category: "Modern",
      popular: true,
      image: "/levelsfyi.jpeg",
    },
    {
      id: "creative-bold",
      name: "Creative Bold",
      category: "Creative",
      popular: false,
      image: "/modernjack.jpeg",
    },
  ]


  // Filter templates based on search query and active category
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = activeCategory === "all" || template.category.toLowerCase() === activeCategory.toLowerCase()
    const matchesPopular = activeCategory === "popular" ? template.popular : true

    return matchesSearch && matchesCategory && matchesPopular
  })

  // Categories for filter
  const categories = [
    { id: "all", name: "All Templates" },
    { id: "popular", name: "Popular" },
    { id: "professional", name: "Professional" },
    { id: "creative", name: "Creative" },
    { id: "simple", name: "Simple" },
    { id: "modern", name: "Modern" },
  ]

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

      {/* Search and Filter Section */}
      <section className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto max-w-6xl px-4 py-4 md:py-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search Bar */}
            <div className="relative w-full md:w-auto md:min-w-[300px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Category Filters */}
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 no-scrollbar">
              <Filter className="h-5 w-5 text-gray-500 flex-shrink-0" />
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium ${
                    activeCategory === category.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {category.name}
                </button>
              ))}
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
              <p className="text-gray-600">Try adjusting your search or filter to find what you're looking for.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((template) => (
                <Link
                  key={template.id}
                  href={`/create/dashboard`}
                  className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200 hover:shadow-md transition-all duration-300 group"
                >
                  <div className="relative h-80 bg-gray-100">
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
                  </div>
                  <div className="p-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-gray-900">{template.name}</h3>
                        <p className="text-sm text-gray-500">{template.category}</p>
                      </div>
                      <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        Use
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
