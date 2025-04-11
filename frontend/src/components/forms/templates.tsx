"use client"

import { useResumeContext } from "@/context/ResumeContext"
import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Layout, CheckCircle, Sparkles } from "lucide-react"

interface Template {
  id: string
  name: string
  imageSrc: string
}

export default function TemplatesForm() {
  const { formData, updateFormData } = useResumeContext()
  const [selectedTemplate, setSelectedTemplate] = useState<string>(formData?.selectedTemplate || "jake")

  const templates: Template[] = [
    {
      id: "jake",
      name: "Jake's Resume",
      imageSrc: "/jakeresume.png",
    },
    {
      id: "modernjack",
      name: "Modern Jack's",
      imageSrc: "/modernjack.jpeg",
    },
    {
      id: "levelsfyi",
      name: "levels.fyi",
      imageSrc: "/levelsfyi.jpeg",
    },
    {
      id: "referme",
      name: "refer.me",
      imageSrc: "/referme.jpeg",
    },
  ]

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplate(templateId)
    updateFormData("selectedTemplate", templateId)
  }

  return (
    <div className="h-full space-y-0 max-w-4xl mx-auto">
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

        <div className="grid grid-cols-2 gap-6 mt-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className={cn(
                "relative border border-2 rounded-xl overflow-hidden transition-all duration-300 group cursor-pointer",
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
              <div className="relative h-64 bg-white flex items-center justify-center overflow-hidden">
                <Image
                  src={template.imageSrc || "/placeholder.svg"}
                  alt={template.name}
                  width={300}
                  height={200}
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-12">
                  <button className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg font-bold transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-lg">
                    Select Template
                  </button>
                </div>
              </div>

              {/* Template Info */}
              <div className="bg-[#1f232e] text-white p-3 text-center">
                <h3 className="font-bold text-lg">{template.name}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
