"use client"

import { useResumeContext } from "@/context/ResumeContext"
import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Building, MapPin, User, Calendar } from "lucide-react"
import FormLabel from "../form-label"
import FormDescription from "../form-description"

interface VolunteerExperience {
  id: number
  volunteerOrg: string
  volunteerLocation: string
  volunteerRole: string
  volunteerStartDate: string
  volunteerEndDate: string
  volunteerDescription: string
}

export default function VolunteerExperienceForm() {
  const { formData, updateFormData } = useResumeContext()
  const [volunteerExperiences, setVolunteerExperiences] = useState<VolunteerExperience[]>(
    formData?.volunteerExperienceSection || []
  )

  const addVolunteerExperience = () => {
    const newId =
      volunteerExperiences.length > 0
        ? Math.max(...volunteerExperiences.map((exp) => exp.id)) + 1
        : 1
    const newExperience: VolunteerExperience = {
      id: newId,
      volunteerOrg: "",
      volunteerLocation: "",
      volunteerRole: "",
      volunteerStartDate: "",
      volunteerEndDate: "",
      volunteerDescription: "",
    }
    const updatedExperiences = [...volunteerExperiences, newExperience]
    setVolunteerExperiences(updatedExperiences)
    updateFormData("volunteerExperienceSection", updatedExperiences)
  }

  const removeVolunteerExperience = (id: number) => {
    const updatedExperiences = volunteerExperiences
      .filter((exp) => exp.id !== id)
      .map((exp, index) => ({ ...exp, id: index + 1 }))

    setVolunteerExperiences(updatedExperiences)
    updateFormData("volunteerExperienceSection", updatedExperiences)
  }

  const updateVolunteerExperience = (id: number, field: string, value: string) => {
    const updatedExperiences = volunteerExperiences.map((exp) =>
      exp.id === id ? { ...exp, [field]: value } : exp
    )
    setVolunteerExperiences(updatedExperiences)
    updateFormData("volunteerExperienceSection", updatedExperiences)
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="bg-blue-600 shadow-lg p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Volunteer Experience</h2>
            <p className="text-blue-100 mt-1">Add your volunteer roles and contributions</p>
          </div>
          <div className="">
            <User className="h-8 w-8 text-white" />
          </div>
        </div>
      </div>

      {volunteerExperiences.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No volunteer experiences added yet</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Add your volunteer experiences to showcase your roles, responsibilities, and achievements.
          </p>
          <button
            onClick={addVolunteerExperience}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Plus className="mr-2 h-4 w-4" /> Add First Volunteer Experience
          </button>
        </div>
      ) : (
        <>
          {volunteerExperiences.map((experience, index) => (
            <div
              key={experience.id}
              className="bg-white border border-gray-200 shadow-sm overflow-hidden transition-all hover:shadow-md"
            >
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <h3 className="font-semibold text-lg text-gray-800">
                      {experience.volunteerOrg ? experience.volunteerOrg : `Volunteer Entry`}
                    </h3>
                  </div>
                  <button
                    onClick={() => removeVolunteerExperience(experience.id)}
                    className="h-9 w-9 rounded-md flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                    aria-label="Remove volunteer experience entry"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormLabel
                    icon={Building}
                    title="Organization"
                    placeholderText="Organization Name"
                    id={`volunteerOrg-${experience.id}`}
                    value={experience.volunteerOrg || ""}
                    onChange={(e) =>
                      updateVolunteerExperience(experience.id, "volunteerOrg", e.target.value)
                    }
                  />

                  <FormLabel
                    icon={MapPin}
                    title="Location"
                    placeholderText="Location"
                    id={`volunteerLocation-${experience.id}`}
                    value={experience.volunteerLocation || ""}
                    onChange={(e) =>
                      updateVolunteerExperience(experience.id, "volunteerLocation", e.target.value)
                    }
                  />
                </div>

                <FormLabel
                  icon={User}
                  title="Role"
                  placeholderText="Your Role"
                  id={`volunteerRole-${experience.id}`}
                  value={experience.volunteerRole || ""}
                  onChange={(e) =>
                    updateVolunteerExperience(experience.id, "volunteerRole", e.target.value)
                  }
                />

                <FormDescription
                  id={`volunteerDescription-${experience.id}`}
                  title="Volunteer Description"
                  placeholderText="Describe your responsibilities and contributions"
                  value={experience.volunteerDescription || ""}
                  onChange={(e) =>
                    updateVolunteerExperience(experience.id, "volunteerDescription", e.target.value)
                  }
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormLabel
                    icon={Calendar}
                    title="Start Date"
                    placeholderText="Month Year"
                    id={`volunteerStartDate-${experience.id}`}
                    value={experience.volunteerStartDate || ""}
                    onChange={(e) =>
                      updateVolunteerExperience(experience.id, "volunteerStartDate", e.target.value)
                    }
                  />

                  <FormLabel
                    icon={Calendar}
                    title="End Date"
                    placeholderText="Month Year"
                    id={`volunteerEndDate-${experience.id}`}
                    value={experience.volunteerEndDate || ""}
                    onChange={(e) =>
                      updateVolunteerExperience(experience.id, "volunteerEndDate", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="m-6 text-center">
            <button
              className="inline-flex items-center justify-center w-full rounded-md border-2 border-dashed border-blue-300 bg-blue-50 px-5 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-all cursor-pointer"
              onClick={addVolunteerExperience}
              aria-label="Add volunteer experience entry"
            >
              <Plus className="mr-2 h-5 w-5" /> Add Another Volunteer Experience
            </button>
          </div>
        </>
      )}
    </div>
  )
}
