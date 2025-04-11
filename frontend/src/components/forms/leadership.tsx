"use client"

import { useResumeContext } from "@/context/ResumeContext"
import { useState } from "react"
import { Plus, Trash2, Building, MapPin, User, Calendar, Pencil, Sparkles, Trophy } from "lucide-react"
import FormLabel from "../form-label"
import FormDescription from "../form-description"

interface LeadershipExperience {
  id: number
  leadershipOrg: string
  leadershipLocation: string
  leadershipRole: string
  leadershipDescription: string
  leadershipStartDate: string
  leadershipEndDate: string
}

export default function LeadershipExperienceForm() {
  const { formData, updateFormData } = useResumeContext()
  const [leadershipExperienceList, setLeadershipExperienceList] = useState<LeadershipExperience[]>(
    formData?.leadershipExperienceSection || [],
  )
  const [title, setTitle] = useState<string>(formData?.headings?.leadership || "Leadership Experience")
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false)

  const addLeadershipExperience = () => {
    const newId =
      leadershipExperienceList.length > 0 ? Math.max(...leadershipExperienceList.map((exp) => exp.id)) + 1 : 1
    const newLeadershipExperience = {
      id: newId,
      leadershipOrg: "",
      leadershipLocation: "",
      leadershipRole: "",
      leadershipDescription: "",
      leadershipStartDate: "",
      leadershipEndDate: "",
    }
    const updatedLeadershipExperience = [...leadershipExperienceList, newLeadershipExperience]
    setLeadershipExperienceList(updatedLeadershipExperience)
    updateFormData("leadershipExperienceSection", updatedLeadershipExperience)
  }

  const removeLeadershipExperience = (id: number) => {
    const updatedLeadershipExperience = leadershipExperienceList
      .filter((exp) => exp.id !== id)
      .map((exp, index) => ({ ...exp, id: index + 1 }))

    setLeadershipExperienceList(updatedLeadershipExperience)
    updateFormData("leadershipExperienceSection", updatedLeadershipExperience)
  }

  const updateLeadershipExperience = (id: number, field: string, value: string) => {
    const updatedLeadershipExperience = leadershipExperienceList.map((exp) =>
      exp.id === id ? { ...exp, [field]: value } : exp,
    )
    setLeadershipExperienceList(updatedLeadershipExperience)
    updateFormData("leadershipExperienceSection", updatedLeadershipExperience)
  }

  return (
    <div className="h-full space-y-0 max-w-4xl mx-auto">
      <div className="bg-[#1f232e] text-white p-8 relative overflow-hidden rounded-t-lg">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-gray-800 text-blue-400 font-semibold text-sm mb-3">
              <Sparkles className="h-4 w-4 mr-2" /> LEADERSHIP ROLES
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
                  updateFormData("headings", { ...formData.headings, leadership: title })
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
            <p className="text-gray-300 mt-2">Add your leadership positions and organizational roles</p>
          </div>
          <div className="bg-gray-800 p-3 rounded-full">
            <Trophy className="h-10 w-10 text-white" />
          </div>
        </div> 
      </div>

      {leadershipExperienceList.length === 0 ? (
        <div className="h-full items-center text-center py-16 bg-white border border-dashed border-gray-300 shadow-sm hover:border-blue-300 transition-all duration-300 group rounded-b-lg">
          <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-6 group-hover:text-blue-500 transition-colors duration-300" />
          <h3 className="text-xl font-bold text-gray-900 mb-3">No leadership experience entries yet</h3>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Add your leadership experience to showcase your organizational roles and achievements.
          </p>
          <button
            className="inline-flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-[#f1efed] px-5 py-3 text-base font-bold text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
            onClick={addLeadershipExperience}
            aria-label="Add leadership experience entry"
          >
            <Plus className="mr-2 h-5 w-5" /> Add Leadership Entry
          </button>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-b-lg border border-gray-200 border-t-0">
          <div className="p-6 space-y-6">
            {leadershipExperienceList.map((exp, index) => (
              <div
                key={exp.id}
                className="border border-gray-200 rounded-xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md group"
              >
                <div className="bg-[#f1efed] px-6 py-4 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#1f232e] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm">
                        {index + 1}
                      </div>
                      <h3 className="font-bold text-lg text-gray-900">
                        {exp.leadershipOrg ? exp.leadershipOrg : `Leadership Experience Entry`}
                      </h3>
                    </div>
                    <button
                      onClick={() => removeLeadershipExperience(exp.id)}
                      className="h-9 w-9 rounded-md flex items-center justify-center text-gray-500 hover:bg-red-100/50 hover:text-red-600 transition-all duration-300 cursor-pointer transform hover:scale-110"
                      aria-label="Remove leadership experience entry"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="bg-white p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormLabel
                      icon={Building}
                      title="Organization"
                      placeholderText="Student Council"
                      id={`leadershipOrg-${exp.id}`}
                      value={exp.leadershipOrg || ""}
                      onChange={(e) => updateLeadershipExperience(exp.id, "leadershipOrg", e.target.value)}
                    />

                    <FormLabel
                      icon={MapPin}
                      title="Location"
                      placeholderText="University of California"
                      id={`leadershipLocation-${exp.id}`}
                      value={exp.leadershipLocation || ""}
                      onChange={(e) => updateLeadershipExperience(exp.id, "leadershipLocation", e.target.value)}
                    />
                  </div>

                  <FormLabel
                    icon={User}
                    title="Role"
                    placeholderText="President"
                    id={`leadershipRole-${exp.id}`}
                    value={exp.leadershipRole || ""}
                    onChange={(e) => updateLeadershipExperience(exp.id, "leadershipRole", e.target.value)}
                  />

                  <FormDescription
                    id={`leadershipDescription-${exp.id}`}
                    title="Leadership Description"
                    placeholderText="Describe your responsibilities and achievements..."
                    value={exp.leadershipDescription || ""}
                    onChange={(e) => updateLeadershipExperience(exp.id, "leadershipDescription", e.target.value)}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormLabel
                      icon={Calendar}
                      title="Start Date"
                      placeholderText="Jan 2020"
                      id={`leadershipStartDate-${exp.id}`}
                      value={exp.leadershipStartDate || ""}
                      onChange={(e) => updateLeadershipExperience(exp.id, "leadershipStartDate", e.target.value)}
                    />

                    <FormLabel
                      icon={Calendar}
                      title="End Date"
                      placeholderText="Dec 2022"
                      id={`leadershipEndDate-${exp.id}`}
                      value={exp.leadershipEndDate || ""}
                      onChange={(e) => updateLeadershipExperience(exp.id, "leadershipEndDate", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="text-center pt-4">
              <button
                className="inline-flex items-center justify-center w-full rounded-lg border border-dashed border-gray-300 bg-[#f1efed] px-5 py-3 text-base font-bold text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
                onClick={addLeadershipExperience}
                aria-label="Add leadership experience entry"
              >
                <Plus className="mr-2 h-5 w-5" /> Add Leadership Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
