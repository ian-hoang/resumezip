"use client"

import { useResumeContext } from "@/context/ResumeContext"
import { useState } from "react"
import { Plus, Trash2, Award, Building, Calendar, Pencil, Sparkles, Medal } from "lucide-react"
import FormLabel from "../form-label"

interface CertificationAward {
  id: number
  awardName: string
  awardOrg: string
  awardDate: string
}

export default function CertificationAwardsForm() {
  const { formData, updateFormData } = useResumeContext()
  const [certificationList, setCertificationList] = useState<CertificationAward[]>(formData?.awardsSection || [])
  const [title, setTitle] = useState<string>(formData?.headings?.awards || "Certifications & Awards")
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false)

  const addCertification = () => {
    const newId = certificationList.length > 0 ? Math.max(...certificationList.map((cert) => cert.id)) + 1 : 1
    const newCertification = {
      id: newId,
      awardName: "",
      awardOrg: "",
      awardDate: "",
    }
    const updatedCertificationList = [...certificationList, newCertification]
    setCertificationList(updatedCertificationList)
    updateFormData("awardsSection", updatedCertificationList)
  }

  const removeCertification = (id: number) => {
    const updatedCertificationList = certificationList
      .filter((cert) => cert.id !== id)
      .map((cert, index) => ({ ...cert, id: index + 1 }))

    setCertificationList(updatedCertificationList)
    updateFormData("awardsSection", updatedCertificationList)
  }

  const updateCertification = (id: number, field: string, value: string) => {
    const updatedCertificationList = certificationList.map((cert) =>
      cert.id === id ? { ...cert, [field]: value } : cert,
    )
    setCertificationList(updatedCertificationList)
    updateFormData("awardsSection", updatedCertificationList)
  }

  return (
    <div className="h-full space-y-0 max-w-4xl mx-auto">
      <div className="bg-[#1f232e] text-white p-8 relative overflow-hidden rounded-t-lg">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-gray-800 text-blue-400 font-semibold text-sm mb-3">
              <Sparkles className="h-4 w-4 mr-2" /> ACHIEVEMENTS
            </div>

            {isEditingTitle ? (
              <input
                type="text"
                className="text-3xl font-bold text-white tracking-tight bg-transparent border-b-2 border-gray-600 focus:outline-none focus:border-gray-300 px-1 py-0.5 w-full"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                }}
                onBlur={() => {
                  setIsEditingTitle(false)
                  updateFormData("headings", { ...formData.headings, awards: title })
                }}
                autoFocus
              />
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-3xl font-bold text-white tracking-tight">{title}</h2>
                <Pencil
                  className="h-5 w-5 text-gray-400 hover:text-white cursor-pointer transition-colors"
                  onClick={() => setIsEditingTitle(true)}
                />
              </div>
            )}
            <p className="text-gray-300 mt-2">Add your certifications, awards, and recognitions</p>
          </div>
          <div className="bg-gray-800 p-3 rounded-full">
            <Medal className="h-10 w-10 text-white" />
          </div>
        </div>
      </div>

      {certificationList.length === 0 ? (
        <div className="h-full items-center text-center py-16 bg-white border border-dashed border-gray-300 shadow-sm hover:border-blue-300 transition-all duration-300 group rounded-b-lg">
          <Medal className="h-16 w-16 text-gray-400 mx-auto mb-6 group-hover:text-blue-500 transition-colors duration-300" />
          <h3 className="text-xl font-bold text-gray-900 mb-3">No certifications or awards added yet</h3>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Add your certifications and awards to showcase your achievements and recognitions.
          </p>
          <button
            className="inline-flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-[#f1efed] px-5 py-3 text-base font-bold text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
            onClick={addCertification}
            aria-label="Add certification/award entry"
          >
            <Plus className="mr-2 h-5 w-5" /> Add Certification Entry
          </button>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-b-lg border border-gray-200 border-t-0">
          <div className="p-6 space-y-6">
            {certificationList.map((cert, index) => (
              <div
                key={cert.id}
                className="border border-gray-200 rounded-xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md group"
              >
                <div className="bg-[#f1efed] px-6 py-4 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#1f232e] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm">
                        {index + 1}
                      </div>
                      <h3 className="font-bold text-lg text-gray-900">
                        {cert.awardName ? cert.awardName : `Certification/Award Entry`}
                      </h3>
                    </div>
                    <button
                      onClick={() => removeCertification(cert.id)}
                      className="h-9 w-9 rounded-md flex items-center justify-center text-gray-500 hover:bg-red-100/50 hover:text-red-600 transition-all duration-300 cursor-pointer transform hover:scale-110"
                      aria-label="Remove certification/award entry"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="bg-white p-6 space-y-6">
                  <FormLabel
                    icon={Award}
                    title="Certification/Award Name"
                    placeholderText="AWS Certified Solutions Architect"
                    id={`awardName-${cert.id}`}
                    value={cert.awardName || ""}
                    onChange={(e) => updateCertification(cert.id, "awardName", e.target.value)}
                  />

                  <FormLabel
                    icon={Building}
                    title="Issuing Organization"
                    placeholderText="Amazon Web Services"
                    id={`awardOrg-${cert.id}`}
                    value={cert.awardOrg || ""}
                    onChange={(e) => updateCertification(cert.id, "awardOrg", e.target.value)}
                  />

                  <FormLabel
                    icon={Calendar}
                    title="Date Received"
                    placeholderText="May 2023"
                    id={`awardDate-${cert.id}`}
                    value={cert.awardDate || ""}
                    onChange={(e) => updateCertification(cert.id, "awardDate", e.target.value)}
                  />
                </div>
              </div>
            ))}

            <div className="text-center pt-4">
              <button
                className="inline-flex items-center justify-center w-full rounded-lg border border-dashed border-gray-300 bg-[#f1efed] px-5 py-3 text-base font-bold text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
                onClick={addCertification}
                aria-label="Add certification/award entry"
              >
                <Plus className="mr-2 h-5 w-5" /> Add Certification Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
