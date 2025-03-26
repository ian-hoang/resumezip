"use client"

import { useResumeContext } from "@/context/ResumeContext"
import { useState } from "react"
import { Plus, Trash2, Wrench, Sparkles, Pencil } from "lucide-react"
import FormLabel from "../form-label"

interface Skill {
  id: number
  skillName: string
  skillDetails: string
}

export default function TechnicalSkillsForm() {
  const { formData, updateFormData } = useResumeContext()
  const [skills, setSkills] = useState<Skill[]>(formData?.skillsSection || [])
  const [title, setTitle] = useState<string>(formData?.headings?.skills || "Skills")
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false)

  const addSkill = () => {
    const newId = skills.length > 0 ? Math.max(...skills.map((skill) => skill.id)) + 1 : 1
    const newSkill = { id: newId, skillName: "", skillDetails: "" }
    const updatedSkills = [...skills, newSkill]
    setSkills(updatedSkills)
    updateFormData("skillsSection", updatedSkills)
  }

  const removeSkill = (id: number) => {
    const updatedSkills = skills
      .filter((skill) => skill.id !== id)
      .map((skill, index) => ({ ...skill, id: index + 1 }))

    setSkills(updatedSkills)
    updateFormData("skillsSection", updatedSkills)
  }

  const updateSkill = (id: number, field: string, value: string) => {
    const updatedSkills = skills.map((skill) =>
      skill.id === id ? { ...skill, [field]: value } : skill
    )
    setSkills(updatedSkills)
    updateFormData("skillsSection", updatedSkills)
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="bg-blue-600 shadow-lg p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            {isEditingTitle ? (
              <input
                type="text"
                className="text-3xl font-bold text-white tracking-tight bg-transparent border-b border-white focus:outline-none"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                }}
                onBlur={() => {
                  setIsEditingTitle(false)
                  updateFormData("headings", { ...formData.headings, skills: title })
                }}
                autoFocus
              />
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-3xl font-bold text-white tracking-tight">{title}</h2>
                <Pencil
                  className="h-5 w-5 text-white cursor-pointer"
                  onClick={() => setIsEditingTitle(true)}
                />
              </div>
            )}
            <p className="text-blue-100 mt-1">Add your technical skills and expertise</p>
          </div>
          <Wrench className="h-8 w-8 text-white" />
        </div>
      </div>

      {skills.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 border border-dashed border-gray-300 hover:shadow-md transition-shadows duration-300">
          <Wrench className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No technical skills added yet</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Add your technical skills to showcase your expertise and proficiency.
          </p>
          <button
            onClick={addSkill}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer active:scale-105 transition-transform duration-200"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Skill
          </button>
        </div>
      ) : (
        <>
          {skills.map((skill, index) => (
            <div
              key={skill.id}
              className="bg-white border border-gray-200 shadow-sm overflow-hidden transition-all hover:shadow-md"
            >
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <h3 className="font-semibold text-lg text-gray-800">
                      {skill.skillName ? skill.skillName : `Skill Entry`}
                    </h3>
                  </div>
                  <button
                    onClick={() => removeSkill(skill.id)}
                    className="h-9 w-9 rounded-md flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer active:scale-110 transition-transform duration-200"
                    aria-label="Remove skill entry"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                  <FormLabel
                    icon={Wrench}
                    title="Skill Category"
                    placeholderText="Programming Languages, Frameworks, Tools, etc."
                    id={`skillName-${skill.id}`}
                    value={skill.skillName || ""}
                    onChange={(e) => updateSkill(skill.id, "skillName", e.target.value)}
                  />

                  <FormLabel
                    icon={Sparkles}
                    title="Skill Details"
                    placeholderText="TypeScript, C++, Python, Java"
                    id={`skillDetails-${skill.id}`}
                    value={skill.skillDetails || ""}
                    onChange={(e) => updateSkill(skill.id, "skillDetails", e.target.value)}
                  />
              </div>
            </div>
          ))}

          <div className="m-6 text-center">
            <button
              className="inline-flex items-center justify-center w-full rounded-md border-2 border-dashed border-blue-300 bg-blue-50 px-5 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-all cursor-pointer active:scale-105"
              onClick={addSkill}
              aria-label="Add skill entry"
            >
              <Plus className="mr-2 h-5 w-5" /> Add Another Skill
            </button>
          </div>
        </>
      )}
    </div>
  )
}