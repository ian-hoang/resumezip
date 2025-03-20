"use client"

import { useResumeContext } from "@/context/ResumeContext"
import { useState } from "react"
import { Plus, Trash2, Briefcase, MapPin, User, Calendar } from "lucide-react"
import FormLabel from "../form-label"
import FormDescription from "../form-description" // Added FormDescription import

interface WorkExperience {
  id: number
  companyName: string
  workLocation: string
  workRole: string
  workDescription: string
  workStartDate: string
  workEndDate: string
}

export default function WorkExperienceForm() {
  const { formData, updateFormData } = useResumeContext()
  const [workExperienceList, setWorkExperienceList] = useState<WorkExperience[]>(
    formData?.workExperienceSection || []
  )

  const addWorkExperience = () => {
    const newId =
      workExperienceList.length > 0 ? Math.max(...workExperienceList.map((exp) => exp.id)) + 1 : 1
    const newWorkExperience = {
      id: newId,
      companyName: "",
      workLocation: "",
      workRole: "",
      workDescription: "",
      workStartDate: "",
      workEndDate: "",
    }
    const updatedWorkExperience = [...workExperienceList, newWorkExperience]
    setWorkExperienceList(updatedWorkExperience)
    updateFormData("workExperienceSection", updatedWorkExperience)
  }

  const removeWorkExperience = (id: number) => {
    const updatedWorkExperience = workExperienceList
      .filter((exp) => exp.id !== id)
      .map((exp, index) => ({ ...exp, id: index + 1 }))

    setWorkExperienceList(updatedWorkExperience)
    updateFormData("workExperienceSection", updatedWorkExperience)
  }

  const updateWorkExperience = (id: number, field: string, value: string) => {
    const updatedWorkExperience = workExperienceList.map((exp) =>
      exp.id === id ? { ...exp, [field]: value } : exp
    )
    setWorkExperienceList(updatedWorkExperience)
    updateFormData("workExperienceSection", updatedWorkExperience)
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="bg-blue-600 shadow-lg p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Work Experience</h2>
            <p className="text-blue-100 mt-1">Add your professional experience and achievements</p>
          </div>
          <div className="">
            <Briefcase className="h-8 w-8 text-white" />
          </div>
        </div>
      </div>

      {workExperienceList.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 border border-dashed border-gray-300 hover:shadow-md transition-shadows duration-300">
          <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No work experience entries yet</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Add your professional experience to showcase your skills and accomplishments.
          </p>
          <button
            onClick={addWorkExperience}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer active:scale-105 transition-transform duration-200"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Work Experience
          </button>
        </div>
      ) : (
        <>
          {workExperienceList.map((exp, index) => (
            <div
              key={exp.id}
              className="bg-white border border-gray-200 shadow-sm overflow-hidden transition-all hover:shadow-md"
            >
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <h3 className="font-semibold text-lg text-gray-800">
                      {exp.companyName ? exp.companyName : `Work Experience Entry`}
                    </h3>
                  </div>
                  <button
                    onClick={() => removeWorkExperience(exp.id)}
                    className="h-9 w-9 rounded-md flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer active:scale-110 transition-transform duration-200"
                    aria-label="Remove work experience entry"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormLabel
                    icon={Briefcase}
                    title="Company Name"
                    placeholderText="Google"
                    id={`companyName-${exp.id}`}
                    value={exp.companyName || ""}
                    onChange={(e) => updateWorkExperience(exp.id, "companyName", e.target.value)}
                  />

                  <FormLabel
                    icon={MapPin}
                    title="Location"
                    placeholderText="Mountain View, CA"
                    id={`workLocation-${exp.id}`}
                    value={exp.workLocation || ""}
                    onChange={(e) => updateWorkExperience(exp.id, "workLocation", e.target.value)}
                  />
                </div>

                <FormLabel
                  icon={User}
                  title="Role"
                  placeholderText="Software Engineer"
                  id={`workRole-${exp.id}`}
                  value={exp.workRole || ""}
                  onChange={(e) => updateWorkExperience(exp.id, "workRole", e.target.value)}
                />

                {/* Replaced FormLabel with FormDescription for workDescription */}
                <FormDescription
                  id={`workDescription-${exp.id}`}
                  title="Job Description"
                  placeholderText="Describe your responsibilities and achievements..."
                  value={exp.workDescription || ""}
                  onChange={(e) => updateWorkExperience(exp.id, "workDescription", e.target.value)}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormLabel
                    icon={Calendar}
                    title="Start Date"
                    placeholderText="Jan 2020"
                    id={`workStartDate-${exp.id}`}
                    value={exp.workStartDate || ""}
                    onChange={(e) => updateWorkExperience(exp.id, "workStartDate", e.target.value)}
                  />

                  <FormLabel
                    icon={Calendar}
                    title="End Date"
                    placeholderText="Dec 2022"
                    id={`workEndDate-${exp.id}`}
                    value={exp.workEndDate || ""}
                    onChange={(e) => updateWorkExperience(exp.id, "workEndDate", e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="m-6 text-center">
            <button
              className="inline-flex items-center justify-center w-full rounded-md border-2 border-dashed border-blue-300 bg-blue-50 px-5 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-all cursor-pointer active:scale-105"
              onClick={addWorkExperience}
              aria-label="Add work experience entry"
            >
              <Plus className="mr-2 h-5 w-5" /> Add Another Work Experience Entry
            </button>
          </div>
        </>
      )}
    </div>
  )
}