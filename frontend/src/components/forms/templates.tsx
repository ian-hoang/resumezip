"use client"

import type React from "react"

import { useResumeContext } from "@/context/ResumeContext"
import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Layout, CheckCircle, Sparkles, X, ExternalLink } from "lucide-react"

interface Template {
  id: string
  name: string
  imageSrc: string
}

export default function TemplatesForm() {
  const { formData, updateFormData } = useResumeContext()
  const [selectedTemplate, setSelectedTemplate] = useState<string>(formData?.selectedTemplate || "jake")
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const templates: Template[] = [
    {
      id: "jake",
      name: "Jake's Resume",
      imageSrc: "/jakeresume.webp",
    },
    {
      id: "modernjack",
      name: "Modern Jack's",
      imageSrc: "/modernjack.webp",
    },
    {
      id: "levelsfyi",
      name: "levels.fyi",
      imageSrc: "/levelsfyi.webp",
    },
    {
      id: "referme",
      name: "refer.me",
      imageSrc: "/referme.webp",
    },
  ]

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplate(templateId)
    updateFormData("selectedTemplate", templateId)
  }

  const handleUseTemplate = (templateId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    setSelectedTemplate(templateId)
    updateFormData("selectedTemplate", templateId)
  }

  const handleImageClick = (imageSrc: string, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent the card click handler from firing
    setPreviewImage(imageSrc)
  }

  const closePreview = () => {
    setPreviewImage(null)
  }

  return (
    <div className="h-full space-y-0 max-w-3xl mx-auto">
      <div className="bg-[#1f232e] text-white p-8 relative overflow-hidden rounded-t-lg">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-gray-800 text-blue-400 font-semibold text-sm mb-3">
              <Sparkles className="h-4 w-4 mr-2" /> DESIGN OPTIONS
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Choose a Template</h2>
            <p className="text-gray-300 mt-2">Select a template that best represents your professional style</p>
          </div>
          <div className="bg-gray-800 p-3 rounded-full">
            <Layout className="h-10 w-10 text-white" />
          </div>
        </div>
      </div>

      <div className="h-full bg-white p-8 shadow-sm relative border border-gray-200 border-t-0 rounded-b-lg">
        <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className={cn(
                "relative border border-2 rounded-xl overflow-hidden transition-all duration-300 group",
                selectedTemplate === template.id
                  ? "border-blue-500 shadow-md"
                  : "border-gray-200 hover:border-blue-300 hover:shadow-md",
              )}
              onClick={() => handleSelectTemplate(template.id)}
            >
              {/* Selected Badge */}
              {selectedTemplate === template.id && (
                <div className="absolute top-3 right-3 z-10 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-md">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>Selected</span>
                </div>
              )}

              {/* Image Container */}
              <div
                className="relative h-56 bg-white flex items-center justify-center overflow-hidden cursor-pointer"
                onClick={(e) => handleImageClick(template.imageSrc, e)}
              >
                <Image
                  src={template.imageSrc || "/placeholder.svg"}
                  alt={template.name}
                  width={240}
                  height={160}
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {/* Preview hint overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <div className="bg-white/90 rounded-full p-2 shadow-lg">
                    <ExternalLink className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </div>

              {/* Template Info and Use Button */}
              <div className="bg-[#1f232e] text-white p-3 flex items-center justify-between">
                <h3 className="font-bold text-lg">{template.name}</h3>
                <button
                  onClick={(e) => handleUseTemplate(template.id, e)}
                  className="cursor-pointer px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                >
                  Use
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

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
            <div className="relative h-[70vh] w-full border-b border-black">
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
