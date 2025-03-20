"use client"

import { useResumeContext } from "@/context/ResumeContext"
import { useState } from "react"
import {
  Plus,
  Trash2,
  GraduationCap,
  MapPin,
  Award,
  BarChart,
  Calendar,
  BookOpen,
  Users,
} from "lucide-react"
import FormLabel from "../form-label"

interface Education {
  id: number
  schoolName: string
  schoolLocation: string
  degree: string
  gpa: string
  schoolStartDate: string
  schoolEndDate: string
  coursework: string
  involvement: string
}

export default function EducationForm() {
  const { formData, updateFormData } = useResumeContext()
  const [educationList, setEducationList] = useState<Education[]>(formData?.educationSection || [])

  const addEducation = () => {
    const newId = educationList.length > 0 ? Math.max(...educationList.map((edu) => edu.id)) + 1 : 1
    const newEducation = {
      id: newId,
      schoolName: "",
      schoolLocation: "",
      degree: "",
      gpa: "",
      schoolStartDate: "",
      schoolEndDate: "",
      coursework: "",
      involvement: "",
    }
    const updatedEducation = [...educationList, newEducation]
    setEducationList(updatedEducation)
    updateFormData("educationSection", updatedEducation)
  }

  const removeEducation = (id: number) => {
    const updatedEducation = educationList
      .filter((edu) => edu.id !== id)
      .map((edu, index) => ({ ...edu, id: index + 1 }))

    setEducationList(updatedEducation)
    updateFormData("educationSection", updatedEducation)
  }

  const updateEducation = (id: number, field: string, value: string) => {
    const updatedEducation = educationList.map((edu) => (edu.id === id ? { ...edu, [field]: value } : edu))
    setEducationList(updatedEducation)
    updateFormData("educationSection", updatedEducation)
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="bg-blue-600 shadow-lg p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Education</h2>
            <p className="text-blue-100 mt-1">Add your academic background and achievements</p>
          </div>
          <div className="">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
        </div>
      </div>

      {educationList.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 border border-dashed border-gray-300 hover:shadow-md transition-shadows duration-300">
          <GraduationCap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No education entries yet</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Add your educational background to showcase your academic achievements and qualifications.
          </p>
          <button
            onClick={addEducation}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer active:scale-105 transition-transform duration-200"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Education
          </button>
        </div>
      ) : (
        <>
          {educationList.map((edu, index) => (
            <div
              key={edu.id}
              className="bg-white border border-gray-200 shadow-sm overflow-hidden transition-all hover:shadow-md"
            >
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <h3 className="font-semibold text-lg text-gray-800">
                      {edu.schoolName ? edu.schoolName : `Education Entry`}
                    </h3>
                  </div>
                  <button
                    onClick={() => removeEducation(edu.id)}
                    className="h-9 w-9 rounded-md flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer active:scale-110 transition-transform duration-200"
                    aria-label="Remove education entry"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormLabel
                    icon={GraduationCap}
                    title="School Name"
                    placeholderText="Stanford University"
                    id={`schoolName-${edu.id}`}
                    value={edu.schoolName || ""}
                    onChange={(e) => updateEducation(edu.id, "schoolName", e.target.value)}
                  />

                  <FormLabel
                    icon={MapPin}
                    title="Location"
                    placeholderText="Stanford, CA"
                    id={`schoolLocation-${edu.id}`}
                    value={edu.schoolLocation || ""}
                    onChange={(e) => updateEducation(edu.id, "schoolLocation", e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormLabel
                    icon={Award}
                    title="Degree"
                    placeholderText="B.S. in Computer Science"
                    id={`degree-${edu.id}`}
                    value={edu.degree || ""}
                    onChange={(e) => updateEducation(edu.id, "degree", e.target.value)}
                  />

                  <FormLabel
                    icon={BarChart}
                    title="GPA"
                    placeholderText="3.9 / 4.0"
                    id={`gpa-${edu.id}`}
                    value={edu.gpa || ""}
                    onChange={(e) => updateEducation(edu.id, "gpa", e.target.value)}
                  />
                </div>

                <FormLabel
                  icon={BookOpen}
                  title="Relevant Coursework"
                  placeholderText="Data Structures & Algorithms, Computer Networking,..."
                  id={`coursework-${edu.id}`}
                  value={edu.coursework || ""}
                  onChange={(e) => updateEducation(edu.id, "coursework", e.target.value)}
                />

                <FormLabel
                  icon={Users}
                  title="Involvement"
                  placeholderText="Association for Computing Machinery, Google Developer Student Club,..."
                  id={`involvement-${edu.id}`}
                  value={edu.involvement || ""}
                  onChange={(e) => updateEducation(edu.id, "involvement", e.target.value)}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormLabel
                    icon={Calendar}
                    title="Start Date"
                    placeholderText="Sep 2024"
                    id={`schoolStartDate-${edu.id}`}
                    value={edu.schoolStartDate || ""}
                    onChange={(e) => updateEducation(edu.id, "schoolStartDate", e.target.value)}
                  />

                  <FormLabel
                    icon={Calendar}
                    title="End Date"
                    placeholderText="Jun 2028"
                    id={`schoolEndDate-${edu.id}`}
                    value={edu.schoolEndDate || ""}
                    onChange={(e) => updateEducation(edu.id, "schoolEndDate", e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="m-6 text-center">
            <button
              className="inline-flex items-center justify-center w-full rounded-md border-2 border-dashed border-blue-300 bg-blue-50 px-5 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-all cursor-pointer active:scale-105"
              onClick={addEducation}
              aria-label="Add education entry"
            >
              <Plus className="mr-2 h-5 w-5" /> Add Another Education Entry
            </button>
          </div>
        </>
      )}
    </div>
  )
}

