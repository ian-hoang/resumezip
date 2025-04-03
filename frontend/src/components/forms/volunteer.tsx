"use client"

import { useResumeContext } from "@/context/ResumeContext"
import { useState } from "react"
import { Plus, Trash2, Building, MapPin, User, Calendar, Pencil, Sparkles } from "lucide-react"
import FormLabel from "../form-label"
import FormDescription from "../form-description"

interface VolunteerExperience {
  id: number
  volunteerOrg: string
  volunteerLocation: string
  volunteerRole: string
  volunteerDescription: string
  volunteerStartDate: string
  volunteerEndDate: string
}

export default function VolunteerExperienceForm() {
  const { formData, updateFormData } = useResumeContext()
  const [volunteerExperienceList, setVolunteerExperienceList] = useState<VolunteerExperience[]>(formData?.volunteerExperienceSection || [])
  const [title, setTitle] = useState<string>(formData?.headings?.volunteer || "Volunteer Experience")
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false)

  const addVolunteerExperience = () => {
    const newId = volunteerExperienceList.length > 0 ? Math.max(...volunteerExperienceList.map((exp) => exp.id)) + 1 : 1
    const newVolunteerExperience = {
      id: newId,
      volunteerOrg: "",
      volunteerLocation: "",
      volunteerRole: "",
      volunteerDescription: "",
      volunteerStartDate: "",
      volunteerEndDate: "",
    }
    const updatedVolunteerExperience = [...volunteerExperienceList, newVolunteerExperience]
    setVolunteerExperienceList(updatedVolunteerExperience)
    updateFormData("volunteerExperienceSection", updatedVolunteerExperience)
  }

  const removeVolunteerExperience = (id: number) => {
    const updatedVolunteerExperience = volunteerExperienceList
      .filter((exp) => exp.id !== id)
      .map((exp, index) => ({ ...exp, id: index + 1 }))

    setVolunteerExperienceList(updatedVolunteerExperience)
    updateFormData("volunteerExperienceSection", updatedVolunteerExperience)
  }

  const updateVolunteerExperience = (id: number, field: string, value: string) => {
    const updatedVolunteerExperience = volunteerExperienceList.map((exp) => (exp.id === id ? { ...exp, [field]: value } : exp))
    setVolunteerExperienceList(updatedVolunteerExperience)
    updateFormData("volunteerExperienceSection", updatedVolunteerExperience)
  }

  return (
    <div className="h-full space-y-0 max-w-4xl mx-auto">
      <div className="bg-gradient-to-r from-[#212A31] to-[#124E66] shadow-xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-[#124E66]/20 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#124E66]/20 text-[#D3D9D4] font-semibold text-sm mb-3">
              <Sparkles className="h-4 w-4 mr-2" /> COMMUNITY CONTRIBUTIONS
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
                  updateFormData("headings", { ...formData.headings, volunteer: title })
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
            <p className="text-[#D3D9D4]/80 mt-2">Add your volunteer experience and community contributions</p>
          </div>
          <div className="bg-[#124E66]/20 p-3 rounded-full">
            <User className="h-10 w-10 text-[#D3D9D4]" />
          </div>
        </div>
      </div>

      {volunteerExperienceList.length === 0 ? (
        <div className="h-full items-center text-center py-16 bg-white border-2 border-dashed border-[#748D92]/30 shadow-lg hover:border-[#124E66]/50 transition-all duration-300 group">
          <User className="h-16 w-16 text-[#748D92]/70 mx-auto mb-6 group-hover:text-[#124E66]/70 transition-colors duration-300" />
          <h3 className="text-xl font-bold text-[#212A31] mb-3">No volunteer experience entries yet</h3>
          <p className="text-[#2E3944] mb-8 max-w-md mx-auto">
            Add your volunteer experience to showcase your community involvement and contributions.
          </p>
          <button
            onClick={addVolunteerExperience}
            className="inline-flex items-center justify-center rounded-lg bg-[#124E66] px-6 py-3 text-base font-bold text-[#D3D9D4] hover:bg-[#124E66]/90 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#748D92] focus:ring-offset-2 cursor-pointer shadow-lg hover:shadow-xl transform hover:-translate-y-1 border-b-[3px] border-[#124E66]/50"
          >
            <Plus className="mr-2 h-5 w-5" /> Add Volunteer Experience
          </button>
        </div>
      ) : (
        <div className="bg-white shadow-xl overflow-hidden">
          <div className="p-6 space-y-6">
            {volunteerExperienceList.map((exp, index) => (
              <div
                key={exp.id}
                className="bg-[#D3D9D4]/20 border-2 border-[#748D92]/20 rounded-xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-[#124E66]/30 group"
              >
                <div className="bg-gradient-to-r from-[#212A31]/5 to-[#124E66]/10 px-6 py-4 border-b border-[#748D92]/20">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#124E66] text-[#D3D9D4] w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-md">
                        {index + 1}
                      </div>
                      <h3 className="font-bold text-lg text-[#212A31]">
                        {exp.volunteerOrg ? exp.volunteerOrg : `Volunteer Experience Entry`}
                      </h3>
                    </div>
                    <button
                      onClick={() => removeVolunteerExperience(exp.id)}
                      className="h-9 w-9 rounded-md flex items-center justify-center text-[#748D92] hover:bg-red-100/50 hover:text-red-600 transition-all duration-300 cursor-pointer transform hover:scale-110"
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
                      placeholderText="Nonprofit Organization"
                      id={`volunteerOrg-${exp.id}`}
                      value={exp.volunteerOrg || ""}
                      onChange={(e) => updateVolunteerExperience(exp.id, "volunteerOrg", e.target.value)}
                    />

                    <FormLabel
                      icon={MapPin}
                      title="Location"
                      placeholderText="City, State"
                      id={`volunteerLocation-${exp.id}`}
                      value={exp.volunteerLocation || ""}
                      onChange={(e) => updateVolunteerExperience(exp.id, "volunteerLocation", e.target.value)}
                    />
                  </div>

                  <FormLabel
                    icon={User}
                    title="Role"
                    placeholderText="Volunteer Coordinator"
                    id={`volunteerRole-${exp.id}`}
                    value={exp.volunteerRole || ""}
                    onChange={(e) => updateVolunteerExperience(exp.id, "volunteerRole", e.target.value)}
                  />

                  <FormDescription
                    id={`volunteerDescription-${exp.id}`}
                    title="Volunteer Description"
                    placeholderText="Describe your responsibilities and achievements..."
                    value={exp.volunteerDescription || ""}
                    onChange={(e) => updateVolunteerExperience(exp.id, "volunteerDescription", e.target.value)}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormLabel
                      icon={Calendar}
                      title="Start Date"
                      placeholderText="Jan 2020"
                      id={`volunteerStartDate-${exp.id}`}
                      value={exp.volunteerStartDate || ""}
                      onChange={(e) => updateVolunteerExperience(exp.id, "volunteerStartDate", e.target.value)}
                    />

                    <FormLabel
                      icon={Calendar}
                      title="End Date"
                      placeholderText="Dec 2022"
                      id={`volunteerEndDate-${exp.id}`}
                      value={exp.volunteerEndDate || ""}
                      onChange={(e) => updateVolunteerExperience(exp.id, "volunteerEndDate", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="text-center pt-4">
              <button
                className="inline-flex items-center justify-center w-full rounded-lg border-2 border-dashed border-[#748D92]/30 bg-[#124E66]/5 px-5 py-3 text-base font-bold text-[#124E66] hover:bg-[#124E66]/10 hover:border-[#124E66]/30 transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
                onClick={addVolunteerExperience}
                aria-label="Add volunteer experience entry"
              >
                <Plus className="mr-2 h-5 w-5" /> Add Another Volunteer Experience Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}