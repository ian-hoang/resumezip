"use client"

import { useResumeContext } from "@/context/ResumeContext"
import { useState } from "react"
import { Plus, Trash2, Wrench, Sparkles } from "lucide-react"
import FormLabel from "../form-label"

interface Skill {
  id: number;
  skillName: string;
  skillDetails: string;
} 

export default function TechnicalSkillsForm() {
  const { formData, updateFormData } = useResumeContext()
  const [skills, setSkills] = useState<Skill[]>(formData?.skillsSection ?? [])

  const addSkill = () => {
    const newId = skills.length > 0 ? Math.max(...skills.map((skill) => skill.id)) + 1 : 1
    const newSkill = { id: newId, skillName: "", skillDetails: "" }
    const updatedSkills = [...skills, newSkill]
    setSkills(updatedSkills)
    updateFormData("skillsSection", updatedSkills) // Update the skills section
  }

  const removeSkill = (id: number) => {
    const updatedSkills = skills
      .filter((skill) => skill.id !== id)
      .map((skill, index) => ({ ...skill, id: index + 1 })) // Reassign IDs sequentially

    setSkills(updatedSkills)
    updateFormData("skillsSection", updatedSkills) // Update the form data
  }

  const updateSkill = (id: number, field: string, value: string) => {
    const updatedSkills = skills.map((skill) =>
      skill.id === id ? { ...skill, [field]: value } : skill
    )
    setSkills(updatedSkills)
    updateFormData("skillsSection", updatedSkills) // Update the skills section
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-4">Technical Skills</h2>

        {skills.map((skill) => (
          <div key={skill.id} className="border border-gray-300 rounded-md p-4 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">Skill #{skill.id}</h3>
              <button
                className="inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                onClick={() => removeSkill(skill.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>


            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <FormLabel
                  icon={Wrench}
                  title="Skill Category"
                  placeholderText="Programming Languages, Frameworks, Tools, etc."
                  id={`skillType-${skill.id}`}
                  value={skill.skillName}
                  onChange={(e) => updateSkill(skill.id, "skillName", e.target.value)}
                />

                <FormLabel
                  icon={Sparkles}
                  title="Skill Details"
                  placeholderText="TypeScript, C++, Python, Java"
                  id={`skillLevel-${skill.id}`}
                  value={skill.skillDetails}
                  onChange={(e) => updateSkill(skill.id, "skillDetails", e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}

        <button
          className="w-full mt-2 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
          onClick={addSkill}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Skill
        </button>
      </div>
    </div>
  )
}
