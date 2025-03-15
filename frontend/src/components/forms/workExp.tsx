"use client"

import { useResumeContext } from "@/context/ResumeContext"
import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"

interface WorkExperience {
  id: number;
  companyName: string;
  workLocation: string;
  workRole: string;
  workDescription: string;
  workStartDate: string;
  workEndDate: string;
}

export default function WorkExperienceForm() {

  const { formData, updateFormData } = useResumeContext();
  const [workExperiences, setWorkExperiences] = useState<WorkExperience[]>(formData?.workExperienceSection ?? []);

  const addWorkExperience = () => {
    const newId = workExperiences.length > 0 ? Math.max(...workExperiences.map((exp) => exp.id)) + 1 : 1;
    const newExperience: WorkExperience = { id: newId, companyName: "", workLocation: "", workRole: "", workDescription: "", workStartDate: "", workEndDate: "" };
    const updatedExperiences = [...workExperiences, newExperience];
    setWorkExperiences(updatedExperiences);
    updateFormData("workExperienceSection", updatedExperiences); // Update the workExperiences section
  };

  const removeWorkExperience = (id: number) => {
    const updatedExperiences = workExperiences
      .filter((exp) => exp.id !== id)
      .map((exp, index) => ({ ...exp, id: index + 1 })); // Reassign IDs sequentially
  
    setWorkExperiences(updatedExperiences);
    updateFormData("workExperienceSection", updatedExperiences); // Update the form data
  };

  const updateWorkExperience = (id: number, field: string, value: string | string[]) => {
    const updatedExperiences = workExperiences.map((exp) =>
      exp.id === id ? { ...exp, [field]: value } : exp
    );
    setWorkExperiences(updatedExperiences);
    updateFormData("workExperienceSection", updatedExperiences); // Update the workExperiences section
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-4">Work Experience</h2>

        {workExperiences.map((experience) => (
          <div key={experience.id} className="border border-gray-300 rounded-md p-4 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">Work Experience #{experience.id}</h3>

              {/* Trash icon to remove work experience */}
              <button
                className="inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                onClick={() => removeWorkExperience(experience.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label htmlFor={`companyName-${experience.id}`} className="text-sm font-medium">
                    Company
                  </label>
                  <input
                    id={`companyName-${experience.id}`}
                    value={experience.companyName}
                    onChange={(e) => updateWorkExperience(experience.id, "companyName", e.target.value)}
                    placeholder="Company Name"
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor={`workLocation-${experience.id}`} className="text-sm font-medium">
                    Location
                  </label>
                  <input
                    id={`workLocation-${experience.id}`}
                    value={experience.workLocation}
                    onChange={(e) => updateWorkExperience(experience.id, "workLocation", e.target.value)}
                    placeholder="Your job location"
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor={`workRole-${experience.id}`} className="text-sm font-medium">
                    Role
                  </label>
                  <input
                    id={`role-${experience.id}`}
                    value={experience.workRole}
                    onChange={(e) => updateWorkExperience(experience.id, "workRole", e.target.value)}
                    placeholder="Your role"
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor={`workDescription-${experience.id}`} className="text-sm font-medium">
                    Description
                  </label>
                  <textarea
                    id={`workDescription-${experience.id}`}
                    value={experience.workDescription || ''}
                    onChange={(e) => updateWorkExperience(experience.id, "workDescription", e.target.value)}
                    placeholder="Describe your responsibilities and achievements"
                    rows={4}
                    className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor={`workStartDate-${experience.id}`} className="text-sm font-medium">
                      Start Date
                    </label>
                    <input
                      id={`workStartDate-${experience.id}`}
                      value={experience.workStartDate || ''}
                      onChange={(e) => updateWorkExperience(experience.id, "workStartDate", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor={`workEndDate-${experience.id}`} className="text-sm font-medium">
                      End Date
                    </label>
                    <input
                      id={`workEndDate-${experience.id}`}
                      value={experience.workEndDate || ''}
                      onChange={(e) => updateWorkExperience(experience.id, "workEndDate", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          className="w-full mt-2 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
          onClick={addWorkExperience}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Work Experience
        </button>
      </div>
    </div>
  )
}
