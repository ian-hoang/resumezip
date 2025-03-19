"use client"

import { useResumeContext } from "@/context/ResumeContext"
import { useState } from "react"
import { Plus, Trash2, Award, Building, Calendar, Medal } from "lucide-react"
import FormLabel from "../form-label"

interface CertificationAward {
  id: number
  awardName: string
  awardOrg: string
  awardDate: string
}

export default function CertificationAwardsForm() {
  const { formData, updateFormData } = useResumeContext()
  const [certifications, setCertifications] = useState<CertificationAward[]>(
    formData?.awardsSection || []
  )

  const addCertification = () => {
    const newId =
      certifications.length > 0 ? Math.max(...certifications.map((cert) => cert.id)) + 1 : 1
    const newCertification: CertificationAward = {
      id: newId,
      awardName: "",
      awardOrg: "",
      awardDate: "",
    }
    const updatedCertifications = [...certifications, newCertification]
    setCertifications(updatedCertifications)
    updateFormData("awardsSection", updatedCertifications)
  }

  const removeCertification = (id: number) => {
    const updatedCertifications = certifications
      .filter((cert) => cert.id !== id)
      .map((cert, index) => ({ ...cert, id: index + 1 }))

    setCertifications(updatedCertifications)
    updateFormData("awardsSection", updatedCertifications)
  }

  const updateCertification = (id: number, field: string, value: string) => {
    const updatedCertifications = certifications.map((cert) =>
      cert.id === id ? { ...cert, [field]: value } : cert
    )
    setCertifications(updatedCertifications)
    updateFormData("awardsSection", updatedCertifications)
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="bg-blue-600 shadow-lg p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Certifications & Awards</h2>
            <p className="text-blue-100 mt-1">Add your certifications, awards, and recognitions</p>
          </div>
          <div className="">
            <Medal className="h-8 w-8 text-white" />
          </div>
        </div>
      </div>

      {certifications.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <Medal className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            No certifications or awards added yet
          </h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Add your certifications and awards to showcase your achievements and recognitions.
          </p>
          <button
            onClick={addCertification}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Plus className="mr-2 h-4 w-4" /> Add First Certification/Award
          </button>
        </div>
      ) : (
        <>
          {certifications.map((cert, index) => (
            <div
              key={cert.id}
              className="bg-white border border-gray-200 shadow-sm overflow-hidden transition-all hover:shadow-md"
            >
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <h3 className="font-semibold text-lg text-gray-800">
                      {cert.awardName ? cert.awardName : `Certification/Award Entry`}
                    </h3>
                  </div>
                  <button
                    onClick={() => removeCertification(cert.id)}
                    className="h-9 w-9 rounded-md flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                    aria-label="Remove certification/award entry"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <FormLabel
                  icon={Award}
                  title="Certification/Award Name"
                  placeholderText="AWS Certified Solutions Architect, Dean's List, etc."
                  id={`awardName-${cert.id}`}
                  value={cert.awardName || ""}
                  onChange={(e) => updateCertification(cert.id, "awardName", e.target.value)}
                />

                <FormLabel
                  icon={Building}
                  title="Issuing Organization"
                  placeholderText="Amazon Web Services, University of Washington, etc."
                  id={`awardOrg-${cert.id}`}
                  value={cert.awardOrg || ""}
                  onChange={(e) => updateCertification(cert.id, "awardOrg", e.target.value)}
                />

                <FormLabel
                  icon={Calendar}
                  title="Date Received"
                  placeholderText="Month Year"
                  id={`awardDate-${cert.id}`}
                  value={cert.awardDate || ""}
                  onChange={(e) => updateCertification(cert.id, "awardDate", e.target.value)}
                />
              </div>
            </div>
          ))}

          <div className="m-6 text-center">
            <button
              className="inline-flex items-center justify-center w-full rounded-md border-2 border-dashed border-blue-300 bg-blue-50 px-5 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-all cursor-pointer"
              onClick={addCertification}
              aria-label="Add certification/award entry"
            >
              <Plus className="mr-2 h-5 w-5" /> Add Another Certification/Award
            </button>
          </div>
        </>
      )}
    </div>
  )
}