"use client"

import { useResumeContext } from "@/context/ResumeContext"
import { useState } from "react"
import { Plus, Trash2, GraduationCap, MapPin, Award, BarChart, Calendar, BookOpen, Users, Pencil, Sparkles } from "lucide-react"
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
  const [title, setTitle] = useState<string>(formData?.headings?.edu || "Education")
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false)

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
    <div className="h-full space-y-0 max-w-4xl mx-auto">
      <div className="bg-gradient-to-r from-[#212A31] to-[#124E66] shadow-xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-[#124E66]/20 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#124E66]/20 text-[#D3D9D4] font-semibold text-sm mb-3">
              <Sparkles className="h-4 w-4 mr-2" /> ACADEMIC BACKGROUND
            </div>

            {isEditingTitle ? (
              <input
                type="text"
                className="text-3xl font-extrabold text-white tracking-tight bg-transparent border-b-2 border-[#748D92] focus:outline-none focus:border-[#D3D9D4] px-1 py-0.5 w-full"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                }}
                onBlur={() => {
                  setIsEditingTitle(false)
                  updateFormData("headings", { ...formData.headings, edu: title })
                }}
                autoFocus
              />
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-3xl font-extrabold text-white tracking-tight">{title}</h2>
                <Pencil
                  className="h-5 w-5 text-[#748D92] hover:text-[#D3D9D4] cursor-pointer transition-colors"
                  onClick={() => setIsEditingTitle(true)}
                />
              </div>
            )}
            <p className="text-[#D3D9D4]/80 mt-2">Add your academic background and achievements</p>
          </div>
          <div className="bg-[#124E66]/20 p-3 rounded-full">
            <GraduationCap className="h-10 w-10 text-[#D3D9D4]" />
          </div>
        </div>
      </div>

      {educationList.length === 0 ? (
        <div className="h-full items-center text-center py-16 bg-white border-2 border-dashed border-[#748D92]/30 shadow-lg hover:border-[#124E66]/50 transition-all duration-300 group">
          <GraduationCap className="h-16 w-16 text-[#748D92]/70 mx-auto mb-6 group-hover:text-[#124E66]/70 transition-colors duration-300" />
          <h3 className="text-xl font-bold text-[#212A31] mb-3">No education entries yet</h3>
          <p className="text-[#2E3944] mb-8 max-w-md mx-auto">
            Add your educational background to showcase your academic achievements and qualifications.
          </p>
          <button
            onClick={addEducation}
            className="inline-flex items-center justify-center rounded-lg bg-[#124E66] px-6 py-3 text-base font-bold text-[#D3D9D4] hover:bg-[#124E66]/90 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#748D92] focus:ring-offset-2 cursor-pointer shadow-lg hover:shadow-xl transform hover:-translate-y-1 border-b-[3px] border-[#124E66]/50"
          >
            <Plus className="mr-2 h-5 w-5" /> Add Education
          </button>
        </div>
      ) : (
        <div className="bg-white shadow-xl overflow-hidden">
          <div className="p-6 space-y-6">
            {educationList.map((edu, index) => (
              <div
                key={edu.id}
                className="bg-[#D3D9D4]/20 border-2 border-[#748D92]/20 rounded-xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-[#124E66]/30 group"
              >
                <div className="bg-gradient-to-r from-[#212A31]/5 to-[#124E66]/10 px-6 py-4 border-b border-[#748D92]/20">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#124E66] text-[#D3D9D4] w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-md">
                        {index + 1}
                      </div>
                      <h3 className="font-bold text-lg text-[#212A31]">
                        {edu.schoolName ? edu.schoolName : `Education Entry`}
                      </h3>
                    </div>
                    <button
                      onClick={() => removeEducation(edu.id)}
                      className="h-9 w-9 rounded-md flex items-center justify-center text-[#748D92] hover:bg-red-100/50 hover:text-red-600 transition-all duration-300 cursor-pointer transform hover:scale-110"
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

            <div className="text-center pt-4">
              <button
                className="inline-flex items-center justify-center w-full rounded-lg border-2 border-dashed border-[#748D92]/30 bg-[#124E66]/5 px-5 py-3 text-base font-bold text-[#124E66] hover:bg-[#124E66]/10 hover:border-[#124E66]/30 transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
                onClick={addEducation}
                aria-label="Add education entry"
              >
                <Plus className="mr-2 h-5 w-5" /> Add Another Education Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}